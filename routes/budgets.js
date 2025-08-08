const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, '..', 'database', 'buytrack.db'));

// Helper to map boolean-ish to integer
function toIntBool(v) {
    if (v === undefined || v === null) return undefined;
    if (typeof v === 'boolean') return v ? 1 : 0;
    const n = Number(v);
    if (!Number.isNaN(n)) return n ? 1 : 0;
    return v ? 1 : 0;
}

// Listar presupuestos (opcional por mes o centro)
router.get('/', (req, res) => {
    const { month, period, cost_center_id } = req.query;
    const targetMonth = period || month;
    let sql = `SELECT b.*, cc.code as cost_center_code, cc.name as cost_center_name 
               FROM budgets b 
               JOIN cost_centers cc ON cc.id = b.cost_center_id`;
    const params = [];
    const where = [];
    if (targetMonth) { where.push('b.month = ?'); params.push(targetMonth); }
    if (cost_center_id) { where.push('b.cost_center_id = ?'); params.push(cost_center_id); }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY b.month DESC, cc.name ASC';
    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ success:false, error: err.message });
        res.json({ success:true, data: rows });
    });
});

// Obtener un presupuesto por id
router.get('/:id', (req, res) => {
    const sql = `SELECT b.*, cc.code as cost_center_code, cc.name as cost_center_name
                 FROM budgets b JOIN cost_centers cc ON cc.id = b.cost_center_id
                 WHERE b.id = ?`;
    db.get(sql, [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ success:false, error: err.message });
        if (!row) return res.status(404).json({ success:false, error: 'Presupuesto no encontrado' });
        res.json({ success:true, data: row });
    });
});

// Crear presupuesto con campos avanzados
router.post('/', (req, res) => {
    const body = req.body || {};
    const cost_center_id = body.cost_center_id;
    const month = body.period || body.month;
    const currency = body.currency || 'CLP';
    const amount = body.amount;
    if (!cost_center_id || !month || amount == null) {
        return res.status(400).json({ success:false, error: 'cost_center_id, month/period y amount son requeridos' });
    }

    const sql = `INSERT INTO budgets (
                    cost_center_id, month, currency, amount,
                    category, description, priority, approver,
                    warning_threshold, critical_threshold, overspend_limit,
                    auto_adjust, rollover_unused, require_approval, email_alerts
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const params = [
        cost_center_id, month, currency, Number(amount) || 0,
        body.category || null,
        body.description || null,
        body.priority || null,
        body.approver || null,
        body.warning_threshold != null ? parseInt(body.warning_threshold) : null,
        body.critical_threshold != null ? parseInt(body.critical_threshold) : null,
        body.overspend_limit != null ? parseInt(body.overspend_limit) : null,
        toIntBool(body.auto_adjust) ?? 0,
        toIntBool(body.rollover_unused) ?? 0,
        toIntBool(body.require_approval) ?? 0,
        toIntBool(body.email_alerts) ?? 0
    ];

    db.run(sql, params, function(err) {
        if (err) return res.status(500).json({ success:false, error: err.message });
        res.json({ success:true, id: this.lastID });
    });
});

// Actualizar presupuesto por id
router.put('/:id', (req, res) => {
    const b = req.body || {};
    const month = b.period || b.month;

    const sql = `UPDATE budgets SET
        cost_center_id = COALESCE(?, cost_center_id),
        month = COALESCE(?, month),
        currency = COALESCE(?, currency),
        amount = COALESCE(?, amount),
        category = COALESCE(?, category),
        description = COALESCE(?, description),
        priority = COALESCE(?, priority),
        approver = COALESCE(?, approver),
        warning_threshold = COALESCE(?, warning_threshold),
        critical_threshold = COALESCE(?, critical_threshold),
        overspend_limit = COALESCE(?, overspend_limit),
        auto_adjust = COALESCE(?, auto_adjust),
        rollover_unused = COALESCE(?, rollover_unused),
        require_approval = COALESCE(?, require_approval),
        email_alerts = COALESCE(?, email_alerts),
        updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`;

    const params = [
        b.cost_center_id,
        month,
        b.currency,
        b.amount != null ? Number(b.amount) : undefined,
        b.category,
        b.description,
        b.priority,
        b.approver,
        b.warning_threshold != null ? parseInt(b.warning_threshold) : undefined,
        b.critical_threshold != null ? parseInt(b.critical_threshold) : undefined,
        b.overspend_limit != null ? parseInt(b.overspend_limit) : undefined,
        toIntBool(b.auto_adjust),
        toIntBool(b.rollover_unused),
        toIntBool(b.require_approval),
        toIntBool(b.email_alerts),
        req.params.id
    ];

    db.run(sql, params, function(err) {
        if (err) return res.status(500).json({ success:false, error: err.message });
        if (this.changes === 0) return res.status(404).json({ success:false, error: 'Presupuesto no encontrado' });
        res.json({ success:true });
    });
});

// Eliminar presupuesto por id
router.delete('/:id', (req, res) => {
    const sql = `DELETE FROM budgets WHERE id = ?`;
    db.run(sql, [req.params.id], function(err) {
        if (err) return res.status(500).json({ success:false, error: err.message });
        if (this.changes === 0) return res.status(404).json({ success:false, error: 'Presupuesto no encontrado' });
        res.json({ success:true });
    });
});

// Duplicar presupuesto a otro mes
router.post('/:id/duplicate', (req, res) => {
    const { target_month, target_period } = req.body || {};
    const dest = target_period || target_month;
    if (!dest) return res.status(400).json({ success:false, error: 'target_month/target_period es requerido' });

    const getSql = `SELECT * FROM budgets WHERE id = ?`;
    db.get(getSql, [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ success:false, error: err.message });
        if (!row) return res.status(404).json({ success:false, error: 'Presupuesto no encontrado' });

        const insSql = `INSERT INTO budgets (
            cost_center_id, month, currency, amount,
            category, description, priority, approver,
            warning_threshold, critical_threshold, overspend_limit,
            auto_adjust, rollover_unused, require_approval, email_alerts
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const params = [
            row.cost_center_id, dest, row.currency, row.amount,
            row.category, row.description, row.priority, row.approver,
            row.warning_threshold, row.critical_threshold, row.overspend_limit,
            row.auto_adjust, row.rollover_unused, row.require_approval, row.email_alerts
        ];
        db.run(insSql, params, function(e2) {
            if (e2) return res.status(500).json({ success:false, error: e2.message });
            res.json({ success:true, id: this.lastID });
        });
    });
});

// Compatibilidad: Upsert presupuesto
router.post('/upsert', (req, res) => {
    const { cost_center_id, month, period, currency = 'CLP', amount } = req.body || {};
    const m = period || month;
    if (!cost_center_id || !m || amount == null) {
        return res.status(400).json({ success:false, error: 'cost_center_id, month/period y amount son requeridos' });
    }
    const sql = `INSERT INTO budgets (cost_center_id, month, currency, amount)
                 VALUES (?, ?, ?, ?)
                 ON CONFLICT(cost_center_id, month, currency) DO UPDATE SET amount = excluded.amount, updated_at = CURRENT_TIMESTAMP`;
    db.run(sql, [cost_center_id, m, currency, amount], function(err) {
        if (err) return res.status(500).json({ success:false, error: err.message });
        res.json({ success:true });
    });
});

// Eliminar presupuesto específico por llaves
router.delete('/', (req, res) => {
    const { cost_center_id, month, period, currency } = req.query || {};
    const m = period || month;
    if (!cost_center_id || !m || !currency) {
        return res.status(400).json({ success:false, error: 'cost_center_id, month/period y currency son requeridos' });
    }
    const sql = `DELETE FROM budgets WHERE cost_center_id = ? AND month = ? AND currency = ?`;
    db.run(sql, [cost_center_id, m, currency], function(err) {
        if (err) return res.status(500).json({ success:false, error: err.message });
        if (this.changes === 0) return res.status(404).json({ success:false, error: 'Presupuesto no encontrado' });
        res.json({ success:true });
    });
});

module.exports = router;
