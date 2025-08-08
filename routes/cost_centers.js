const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, '..', 'database', 'buytrack.db'));

// Listar centros de costos
router.get('/', (req, res) => {
    const sql = `SELECT * FROM cost_centers ORDER BY is_active DESC, name ASC`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ success:false, error: err.message });
        res.json({ success:true, data: rows });
    });
});

// Crear centro de costo
router.post('/', (req, res) => {
    const {
        code, name, description, owner, is_active = 1,
        type, manager, email, department, currency = 'CLP',
        approval_limit, requires_approval = 0
    } = req.body || {};

    if (!code || !name) return res.status(400).json({ success:false, error: 'code y name son requeridos' });

    const sql = `INSERT INTO cost_centers (code, name, description, owner, is_active, type, manager, email, department, currency, approval_limit, requires_approval)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    db.run(sql, [
        code, name, description || '', owner || '', is_active ? 1 : 0,
        type || null, manager || null, email || null, department || null,
        currency || 'CLP', typeof approval_limit === 'number' ? approval_limit : (approval_limit ? Number(approval_limit) : null),
        requires_approval ? 1 : 0
    ], function(err) {
        if (err) return res.status(500).json({ success:false, error: err.message });
        res.json({ success:true, id: this.lastID });
    });
});

// Actualizar centro de costo
router.put('/:id', (req, res) => {
    const {
        code, name, description, owner, is_active, type,
        manager, email, department, currency, approval_limit, requires_approval
    } = req.body || {};

    const sql = `UPDATE cost_centers SET 
                    code = COALESCE(?, code), 
                    name = COALESCE(?, name), 
                    description = COALESCE(?, description), 
                    owner = COALESCE(?, owner), 
                    is_active = COALESCE(?, is_active),
                    type = COALESCE(?, type),
                    manager = COALESCE(?, manager),
                    email = COALESCE(?, email),
                    department = COALESCE(?, department),
                    currency = COALESCE(?, currency),
                    approval_limit = COALESCE(?, approval_limit),
                    requires_approval = COALESCE(?, requires_approval),
                    updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?`;

    db.run(sql, [
        code, name, description, owner,
        typeof is_active === 'number' ? is_active : (typeof is_active === 'boolean' ? (is_active ? 1 : 0) : undefined),
        type, manager, email, department, currency,
        (approval_limit !== undefined && approval_limit !== null) ? Number(approval_limit) : undefined,
        (requires_approval !== undefined && requires_approval !== null) ? (requires_approval ? 1 : 0) : undefined,
        req.params.id
    ], function(err) {
        if (err) return res.status(500).json({ success:false, error: err.message });
        if (this.changes === 0) return res.status(404).json({ success:false, error: 'No encontrado' });
        res.json({ success:true });
    });
});

// Desactivar/activar
router.delete('/:id', (req, res) => {
    const sql = `UPDATE cost_centers SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    db.run(sql, [req.params.id], function(err) {
        if (err) return res.status(500).json({ success:false, error: err.message });
        if (this.changes === 0) return res.status(404).json({ success:false, error: 'No encontrado' });
        res.json({ success:true });
    });
});

// Uso vs presupuesto por centro (mes)
router.get('/usage', (req, res) => {
    const { month } = req.query;
    if (!month) return res.status(400).json({ success:false, error: 'month (YYYY-MM) es requerido' });
    const budgetsSql = `
        SELECT b.cost_center_id, cc.name as cost_center_name, b.currency, b.amount as budget
        FROM budgets b
        JOIN cost_centers cc ON cc.id = b.cost_center_id
        WHERE b.month = ?
    `;
    const spendSql = `
        SELECT cost_center_id, currency, SUM(total_amount) as spent
        FROM purchase_orders
        WHERE cost_center_id IS NOT NULL
          AND strftime('%Y-%m', COALESCE(order_date, created_at)) = ?
        GROUP BY cost_center_id, currency
    `;
    db.all(budgetsSql, [month], (err, budgets) => {
        if (err) return res.status(500).json({ success:false, error: err.message });
        db.all(spendSql, [month], (err2, spends) => {
            if (err2) return res.status(500).json({ success:false, error: err2.message });
            const key = (cc, cur) => `${cc}_${cur}`;
            const spentMap = Object.fromEntries(spends.map(s => [key(s.cost_center_id, s.currency), Number(s.spent)||0]));
            const summary = budgets.map(b => {
                const spent = spentMap[key(b.cost_center_id, b.currency)] || 0;
                return {
                    cost_center_id: b.cost_center_id,
                    cost_center_name: b.cost_center_name,
                    currency: b.currency,
                    budget: Number(b.budget)||0,
                    spent,
                    remaining: (Number(b.budget)||0) - spent
                };
            });
            res.json({ success:true, data: summary });
        });
    });
});

// Estadísticas y métricas de centros de costo
router.get('/metrics', (req, res) => {
    const { period = new Date().toISOString().substr(0, 7) } = req.query;
    
    const metricsSql = `
        SELECT 
            cc.id,
            cc.code,
            cc.name,
            cc.is_active,
            cc.type,
            cc.department,
            cc.currency,
            COALESCE(b.amount, 0) as budget_amount,
            COALESCE(spending.total_spent, 0) as total_spent,
            COALESCE(spending.orders_count, 0) as orders_count,
            CASE 
                WHEN COALESCE(b.amount, 0) > 0 
                THEN (COALESCE(spending.total_spent, 0) / b.amount) * 100 
                ELSE 0 
            END as utilization_percentage,
            COALESCE(b.amount, 0) - COALESCE(spending.total_spent, 0) as remaining_budget
        FROM cost_centers cc
        LEFT JOIN budgets b ON cc.id = b.cost_center_id AND b.month = ?
        LEFT JOIN (
            SELECT 
                cost_center_id,
                SUM(total_amount) as total_spent,
                COUNT(*) as orders_count
            FROM purchase_orders 
            WHERE strftime('%Y-%m', COALESCE(order_date, created_at)) = ?
            GROUP BY cost_center_id
        ) spending ON cc.id = spending.cost_center_id
        ORDER BY cc.is_active DESC, cc.name ASC
    `;
    
    db.all(metricsSql, [period, period], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        
        // Calcular métricas globales
        const totalCenters = rows.length;
        const activeCenters = rows.filter(r => r.is_active).length;
        const totalBudget = rows.reduce((sum, r) => sum + (r.budget_amount || 0), 0);
        const totalSpent = rows.reduce((sum, r) => sum + (r.total_spent || 0), 0);
        const avgUtilization = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
        const overbudgetCenters = rows.filter(r => r.utilization_percentage > 100).length;
        
        res.json({
            success: true,
            data: {
                period,
                metrics: {
                    totalCenters,
                    activeCenters,
                    totalBudget,
                    totalSpent,
                    avgUtilization,
                    overbudgetCenters,
                    available: totalBudget - totalSpent
                },
                centers: rows
            }
        });
    });
});

// Comparación de rendimiento entre períodos
router.get('/performance-comparison', (req, res) => {
    const { periods } = req.query;
    if (!periods) {
        return res.status(400).json({ success: false, error: 'Se requiere parámetro periods (comma-separated)' });
    }
    
    const periodList = periods.split(',').map(p => p.trim());
    const placeholders = periodList.map(() => '?').join(',');
    
    const comparisonSql = `
        SELECT 
            b.month as period,
            cc.code as center_code,
            cc.name as center_name,
            COALESCE(b.amount, 0) as budget,
            COALESCE(spending.total_spent, 0) as spent,
            COALESCE(spending.orders_count, 0) as orders_count
        FROM budgets b
        JOIN cost_centers cc ON b.cost_center_id = cc.id
        LEFT JOIN (
            SELECT 
                cost_center_id,
                strftime('%Y-%m', COALESCE(order_date, created_at)) as period,
                SUM(total_amount) as total_spent,
                COUNT(*) as orders_count
            FROM purchase_orders 
            WHERE strftime('%Y-%m', COALESCE(order_date, created_at)) IN (${placeholders})
            GROUP BY cost_center_id, period
        ) spending ON cc.id = spending.cost_center_id AND b.month = spending.period
        WHERE b.month IN (${placeholders})
        ORDER BY cc.name, b.month
    `;
    
    db.all(comparisonSql, [...periodList, ...periodList], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        
        // Agrupar por centro
        const groupedByCenter = rows.reduce((acc, row) => {
            if (!acc[row.center_code]) {
                acc[row.center_code] = {
                    center_code: row.center_code,
                    center_name: row.center_name,
                    periods: {}
                };
            }
            acc[row.center_code].periods[row.period] = {
                budget: row.budget,
                spent: row.spent,
                utilization: row.budget > 0 ? (row.spent / row.budget) * 100 : 0,
                orders_count: row.orders_count
            };
            return acc;
        }, {});
        
        res.json({
            success: true,
            data: {
                periods: periodList,
                centers: Object.values(groupedByCenter)
            }
        });
    });
});

module.exports = router;
