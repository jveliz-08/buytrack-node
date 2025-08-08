const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, '..', 'database', 'buytrack.db'));

// Helper para formatear montos por moneda de forma consistente
function formatByCurrency(value, currency = 'CLP') {
    const n = Number(value) || 0;
    if (currency === 'UF') {
        return new Intl.NumberFormat('es-CL', { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(n);
    }
    if (currency === 'USD') {
        return new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
    }
    return new Intl.NumberFormat('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

// Obtener estadísticas del dashboard
router.get('/stats', (req, res) => {
    const queries = {
        totalOrders: `SELECT COUNT(*) as count FROM purchase_orders`,
        totalAmount: `SELECT SUM(total_amount) as total, currency FROM purchase_orders GROUP BY currency`,
        activeSuppliers: `SELECT COUNT(*) as count FROM suppliers`,
        pendingOrders: `SELECT COUNT(*) as count FROM purchase_orders WHERE status = 'pending'`,
        statusCounts: `SELECT status, COUNT(*) as count FROM purchase_orders GROUP BY status`,
        recentOrders: `
            SELECT po.*, s.name as supplier_name 
            FROM purchase_orders po 
            LEFT JOIN suppliers s ON po.supplier_id = s.id 
            ORDER BY po.created_at DESC 
            LIMIT 5
        `
    };

    const results = {};

    // Función para ejecutar consulta
    const executeQuery = (key, query) => {
        return new Promise((resolve, reject) => {
            db.all(query, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    };

    // Ejecutar todas las consultas
    Promise.all([
        executeQuery('totalOrders', queries.totalOrders),
        executeQuery('totalAmount', queries.totalAmount),
        executeQuery('activeSuppliers', queries.activeSuppliers),
        executeQuery('pendingOrders', queries.pendingOrders),
        executeQuery('statusCounts', queries.statusCounts),
        executeQuery('recentOrders', queries.recentOrders)
    ]).then(([totalOrders, totalAmount, activeSuppliers, pendingOrders, statusCounts, recentOrders]) => {
        
        // Procesar resultados
        const stats = {
            totalOrders: totalOrders[0]?.count || 0,
            totalAmount: totalAmount.reduce((acc, curr) => {
                acc[curr.currency] = Number(curr.total) || 0;
                return acc;
            }, {}),
            activeSuppliers: activeSuppliers[0]?.count || 0,
            pendingOrders: pendingOrders[0]?.count || 0,
            statusCounts: statusCounts.reduce((acc, row) => {
                acc[row.status] = row.count;
                return acc;
            }, {}),
            recentOrders: recentOrders.map(order => ({
                ...order,
                order_date: new Date(order.order_date).toLocaleDateString('es-CL'),
                // devolver valor numérico para permitir formateo consistente en el frontend
                total_amount: Number(order.total_amount) || 0,
                formatted_total_amount: formatByCurrency(order.total_amount, order.currency)
            }))
        };

        res.json({
            success: true,
            data: stats
        });

    }).catch(error => {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener estadísticas del dashboard'
        });
    });
});

// Tendencia de órdenes por mes y moneda (últimos 6 meses)
router.get('/orders-trend', (req, res) => {
    const query = `
        SELECT strftime('%Y-%m', COALESCE(order_date, created_at)) as ym,
               currency,
               COUNT(*) as count,
               SUM(total_amount) as total
        FROM purchase_orders
        WHERE COALESCE(order_date, created_at) >= date('now','-6 months')
        GROUP BY ym, currency
        ORDER BY ym ASC
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error fetching orders trend:', err);
            return res.status(500).json({ success: false, message: 'Error al obtener tendencia de órdenes' });
        }

        // Organizar por mes
        const data = {};
        rows.forEach(r => {
            if (!data[r.ym]) data[r.ym] = {};
            data[r.ym][r.currency] = {
                count: Number(r.count) || 0,
                total: Number(r.total) || 0
            };
        });

        res.json({ success: true, data });
    });
});

// Obtener resumen de gastos por proveedor
router.get('/spending-summary', (req, res) => {
    const query = `
        SELECT 
            s.name as supplier_name,
            COUNT(po.id) as order_count,
            SUM(po.total_amount) as total_spent,
            po.currency,
            AVG(po.total_amount) as avg_order_amount
        FROM purchase_orders po
        LEFT JOIN suppliers s ON po.supplier_id = s.id
        WHERE po.status != 'cancelled'
        GROUP BY po.supplier_id, po.currency
        ORDER BY total_spent DESC
        LIMIT 10
    `;

    db.all(query, (err, rows) => {
        if (err) {
            console.error('Error fetching spending summary:', err);
            return res.status(500).json({
                success: false,
                message: 'Error al obtener resumen de gastos'
            });
        }

        const summary = rows.map(row => ({
            supplier_name: row.supplier_name || 'Proveedor Desconocido',
            order_count: row.order_count,
            total_spent: Number(row.total_spent) || 0,
            currency: row.currency,
            avg_order_amount: Number(row.avg_order_amount) || 0,
            formatted_total_spent: formatByCurrency(row.total_spent, row.currency),
            formatted_avg_order_amount: formatByCurrency(row.avg_order_amount, row.currency)
        }));

        res.json({
            success: true,
            data: summary
        });
    });
});

module.exports = router;
