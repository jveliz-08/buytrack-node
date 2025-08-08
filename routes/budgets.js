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

// Análisis de tendencias y proyecciones
router.get('/trends', (req, res) => {
    const { cost_center_id, months = 6 } = req.query;
    
    let sql = `
        SELECT 
            b.month,
            b.cost_center_id,
            cc.name as center_name,
            cc.code as center_code,
            b.currency,
            b.amount as budget,
            COALESCE(spending.total_spent, 0) as spent,
            COALESCE(spending.orders_count, 0) as orders_count,
            CASE 
                WHEN b.amount > 0 
                THEN (COALESCE(spending.total_spent, 0) / b.amount) * 100 
                ELSE 0 
            END as utilization
        FROM budgets b
        JOIN cost_centers cc ON b.cost_center_id = cc.id
        LEFT JOIN (
            SELECT 
                cost_center_id,
                strftime('%Y-%m', COALESCE(order_date, created_at)) as period,
                SUM(total_amount) as total_spent,
                COUNT(*) as orders_count
            FROM purchase_orders 
            GROUP BY cost_center_id, period
        ) spending ON b.cost_center_id = spending.cost_center_id AND b.month = spending.period
        WHERE 1=1
    `;
    
    const params = [];
    
    if (cost_center_id) {
        sql += ' AND b.cost_center_id = ?';
        params.push(cost_center_id);
    }
    
    sql += ` ORDER BY b.month DESC LIMIT ?`;
    params.push(parseInt(months));
    
    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        
        // Calcular tendencias
        const trends = {
            budget_trend: calculateTrend(rows.map(r => r.budget)),
            spending_trend: calculateTrend(rows.map(r => r.spent)),
            utilization_trend: calculateTrend(rows.map(r => r.utilization))
        };
        
        // Proyección simple para próximo mes
        const avgSpending = rows.reduce((sum, r) => sum + r.spent, 0) / (rows.length || 1);
        const lastBudget = rows.length > 0 ? rows[0].budget : 0;
        const projection = {
            estimated_spending: avgSpending,
            estimated_utilization: lastBudget > 0 ? (avgSpending / lastBudget) * 100 : 0,
            risk_level: avgSpending > lastBudget ? 'high' : avgSpending > lastBudget * 0.9 ? 'medium' : 'low'
        };
        
        res.json({
            success: true,
            data: {
                historical: rows.reverse(), // Ordenar cronológicamente
                trends,
                projection
            }
        });
    });
});

// Función helper para calcular tendencias
function calculateTrend(values) {
    if (values.length < 2) return 0;
    const recent = values.slice(0, Math.ceil(values.length / 2));
    const older = values.slice(Math.ceil(values.length / 2));
    const recentAvg = recent.reduce((sum, v) => sum + v, 0) / recent.length;
    const olderAvg = older.reduce((sum, v) => sum + v, 0) / older.length;
    return olderAvg === 0 ? 0 : ((recentAvg - olderAvg) / olderAvg) * 100;
}

// Exportar datos de presupuestos
router.get('/export', (req, res) => {
    const { format = 'csv', period } = req.query;
    
    let sql = `
        SELECT 
            cc.code as "Código Centro",
            cc.name as "Nombre Centro",
            cc.department as "Departamento",
            b.month as "Período",
            b.currency as "Moneda",
            b.amount as "Presupuesto",
            b.category as "Categoría",
            b.priority as "Prioridad",
            b.approver as "Aprobador",
            COALESCE(spending.total_spent, 0) as "Gastado",
            COALESCE(spending.orders_count, 0) as "Órdenes",
            CASE 
                WHEN b.amount > 0 
                THEN ROUND((COALESCE(spending.total_spent, 0) / b.amount) * 100, 2)
                ELSE 0 
            END as "Utilización %",
            (b.amount - COALESCE(spending.total_spent, 0)) as "Disponible"
        FROM budgets b
        JOIN cost_centers cc ON b.cost_center_id = cc.id
        LEFT JOIN (
            SELECT 
                cost_center_id,
                strftime('%Y-%m', COALESCE(order_date, created_at)) as period,
                SUM(total_amount) as total_spent,
                COUNT(*) as orders_count
            FROM purchase_orders 
            GROUP BY cost_center_id, period
        ) spending ON b.cost_center_id = spending.cost_center_id AND b.month = spending.period
    `;
    
    const params = [];
    if (period) {
        sql += ' WHERE b.month = ?';
        params.push(period);
    }
    
    sql += ' ORDER BY cc.name, b.month';
    
    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        
        if (format === 'csv') {
            const headers = Object.keys(rows[0] || {});
            const csvContent = [
                headers.join(','),
                ...rows.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
            ].join('\n');
            
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename=presupuestos_${period || 'todos'}.csv`);
            res.send('\ufeff' + csvContent); // BOM para UTF-8
        } else {
            res.json({ success: true, data: rows });
        }
    });
});

// Importar presupuestos masivos
router.post('/import', (req, res) => {
    const { budgets } = req.body;
    
    if (!Array.isArray(budgets) || budgets.length === 0) {
        return res.status(400).json({ success: false, error: 'Se requiere array de presupuestos' });
    }
    
    // Validar estructura
    const requiredFields = ['cost_center_id', 'month', 'amount'];
    const invalidBudgets = budgets.filter(b => 
        !requiredFields.every(field => b.hasOwnProperty(field))
    );
    
    if (invalidBudgets.length > 0) {
        return res.status(400).json({ 
            success: false, 
            error: 'Presupuestos inválidos encontrados',
            details: invalidBudgets 
        });
    }
    
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO budgets (
                cost_center_id, month, currency, amount, category, description, 
                priority, approver, warning_threshold, critical_threshold, 
                overspend_limit, auto_adjust, rollover_unused, require_approval, email_alerts
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        let processed = 0;
        let errors = [];
        
        budgets.forEach((budget, index) => {
            const params = [
                budget.cost_center_id,
                budget.month,
                budget.currency || 'CLP',
                Number(budget.amount) || 0,
                budget.category,
                budget.description,
                budget.priority,
                budget.approver,
                budget.warning_threshold != null ? parseInt(budget.warning_threshold) : null,
                budget.critical_threshold != null ? parseInt(budget.critical_threshold) : null,
                budget.overspend_limit != null ? parseInt(budget.overspend_limit) : null,
                toIntBool(budget.auto_adjust) ?? 0,
                toIntBool(budget.rollover_unused) ?? 0,
                toIntBool(budget.require_approval) ?? 0,
                toIntBool(budget.email_alerts) ?? 0
            ];
            
            stmt.run(params, function(err) {
                if (err) {
                    errors.push({ index, error: err.message });
                } else {
                    processed++;
                }
            });
        });
        
        stmt.finalize((err) => {
            if (err || errors.length > 0) {
                db.run('ROLLBACK');
                res.status(500).json({ 
                    success: false, 
                    error: 'Error en importación', 
                    processed, 
                    errors 
                });
            } else {
                db.run('COMMIT');
                res.json({ 
                    success: true, 
                    message: `${processed} presupuestos importados exitosamente`,
                    processed 
                });
            }
        });
    });
});

// Actualización masiva de presupuestos
router.put('/bulk-update', (req, res) => {
    const { budget_ids, updates } = req.body;
    
    if (!Array.isArray(budget_ids) || budget_ids.length === 0) {
        return res.status(400).json({ success: false, error: 'Se requiere array de IDs' });
    }
    
    if (!updates || Object.keys(updates).length === 0) {
        return res.status(400).json({ success: false, error: 'Se requieren campos a actualizar' });
    }
    
    // Construir query dinámicamente
    const allowedFields = [
        'amount', 'category', 'priority', 'approver', 'warning_threshold',
        'critical_threshold', 'overspend_limit', 'auto_adjust', 'rollover_unused',
        'require_approval', 'email_alerts'
    ];
    
    const setClause = [];
    const params = [];
    
    Object.entries(updates).forEach(([field, value]) => {
        if (allowedFields.includes(field)) {
            setClause.push(`${field} = ?`);
            if (['auto_adjust', 'rollover_unused', 'require_approval', 'email_alerts'].includes(field)) {
                params.push(toIntBool(value));
            } else {
                params.push(value);
            }
        }
    });
    
    if (setClause.length === 0) {
        return res.status(400).json({ success: false, error: 'No hay campos válidos para actualizar' });
    }
    
    const placeholders = budget_ids.map(() => '?').join(',');
    const sql = `
        UPDATE budgets 
        SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP 
        WHERE id IN (${placeholders})
    `;
    
    db.run(sql, [...params, ...budget_ids], function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ 
            success: true, 
            message: `${this.changes} presupuestos actualizados`,
            updated: this.changes 
        });
    });
});

module.exports = router;
