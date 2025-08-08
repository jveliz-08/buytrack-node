const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, '..', 'database', 'buytrack.db'));

// Generar número de orden único por proveedor
async function generateOrderNumber(supplierId) {
    return new Promise((resolve, reject) => {
        // Obtener el nombre del proveedor y contar órdenes existentes del año actual
        const supplierSql = 'SELECT name FROM suppliers WHERE id = ?';
        const countSql = `
            SELECT COUNT(*) as count 
            FROM purchase_orders 
            WHERE supplier_id = ? 
              AND strftime('%Y', COALESCE(order_date, created_at)) = ?
        `;
        
        const currentYear = new Date().getFullYear().toString();
        
        db.get(supplierSql, [supplierId], (err, supplier) => {
            if (err) {
                reject(err);
                return;
            }
            if (!supplier) {
                reject(new Error('Proveedor no encontrado'));
                return;
            }
            
            db.get(countSql, [supplierId, currentYear], (err, result) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                // Generar código del proveedor (primeras 3 letras en mayúsculas de las iniciales)
                const supplierCode = supplier.name
                    .replace(/[^a-zA-Z\s]/g, '') // Remover caracteres especiales
                    .split(' ')
                    .filter(Boolean)
                    .map(word => word.charAt(0))
                    .join('')
                    .substring(0, 3)
                    .toUpperCase()
                    .padEnd(3, 'X'); // Rellenar con X si es necesario
                
                // Número secuencial con padding (reinicia por año)
                const orderCount = (result.count || 0) + 1;
                const orderNumber = String(orderCount).padStart(4, '0');
                
                // Año actual
                const year = currentYear;
                
                // Formato: ABC-2025-0001
                const finalOrderNumber = `${supplierCode}-${year}-${orderNumber}`;
                resolve(finalOrderNumber);
            });
        });
    });
}

// Obtener todas las órdenes de compra
router.get('/', (req, res) => {
    const sql = `
        SELECT po.*, 
               s.name as supplier_name,
               s.contact_person,
               COUNT(poi.id) as items_count
        FROM purchase_orders po
        LEFT JOIN suppliers s ON po.supplier_id = s.id
        LEFT JOIN purchase_order_items poi ON po.id = poi.order_id
        GROUP BY po.id
        ORDER BY po.created_at DESC
    `;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ orders: rows });
    });
});

// Obtener una orden específica con sus items
router.get('/:id', (req, res) => {
    const orderSql = `
        SELECT po.*, 
               s.name as supplier_name,
               s.contact_person,
               s.email as supplier_email,
               s.phone as supplier_phone,
               s.address as supplier_address,
               s.city as supplier_city,
               s.country as supplier_country,
               s.tax_id as supplier_tax_id,
               s.payment_terms
        FROM purchase_orders po
        LEFT JOIN suppliers s ON po.supplier_id = s.id
        WHERE po.id = ?
    `;
    
    const itemsSql = `
        SELECT * FROM purchase_order_items 
        WHERE order_id = ?
        ORDER BY id
    `;
    
    db.get(orderSql, [req.params.id], (err, order) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!order) {
            res.status(404).json({ error: 'Orden no encontrada' });
            return;
        }
        
        db.all(itemsSql, [req.params.id], (err, items) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            res.json({ 
                order: order,
                items: items 
            });
        });
    });
});

// Crear nueva orden de compra
router.post('/', async (req, res) => {
    try {
        const {
            supplier_id, delivery_date, notes, billing_address, 
            shipping_address, items, currency = 'CLP', cost_center_id
        } = req.body;

        if (!supplier_id || !items || items.length === 0) {
            res.status(400).json({ error: 'Proveedor e items son requeridos' });
            return;
        }

        // Nuevo: exigir centro de costo
        if (!cost_center_id) {
            res.status(400).json({ error: 'Cada orden debe estar asociada a un centro de costo (cost_center_id).' });
            return;
        }

        // Validar que el centro de costo exista y esté activo
        const cc = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM cost_centers WHERE id = ? AND is_active = 1`, [cost_center_id], (err, row) => {
                if (err) reject(err); else resolve(row);
            });
        });
        if (!cc) {
            res.status(400).json({ error: 'Centro de costo inválido o inactivo.' });
            return;
        }

        // Validar que todos los items estén en la misma moneda que la orden
        const mismatched = (items || []).find(it => (it.currency || currency) !== currency);
        if (mismatched) {
            res.status(400).json({ error: `Todos los items deben estar en la moneda de la orden (${currency}).` });
            return;
        }

        // Generar número de orden único por proveedor (reinicia cada año)
        const order_number = await generateOrderNumber(supplier_id);
        const order_date = new Date().toISOString().split('T')[0];

        // Calcular totales
        let subtotal = 0;
        items.forEach(item => {
            subtotal += parseFloat(item.quantity) * parseFloat(item.unit_price);
        });
        
        const tax_amount = subtotal * 0.19; // 19% IVA
        const total_amount = subtotal + tax_amount;

        const orderSql = `
            INSERT INTO purchase_orders 
            (order_number, supplier_id, order_date, delivery_date, subtotal, tax_amount, total_amount, currency, notes, billing_address, shipping_address, cost_center_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.run(orderSql, [
            order_number, supplier_id, order_date, delivery_date,
            subtotal, tax_amount, total_amount, currency, notes, billing_address, shipping_address, cost_center_id
        ], function(err) {
            if (err) {
                console.error('Error creando orden:', err);
                res.status(500).json({ error: err.message });
                return;
            }

            const order_id = this.lastID;

            // Insertar items de la orden
            const itemSql = `
                INSERT INTO purchase_order_items 
                (order_id, product_id, product_name, product_code, description, quantity, unit_price, total_price, unit_of_measure)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const stmt = db.prepare(itemSql);
            
            items.forEach(item => {
                const qty = parseFloat(item.quantity);
                const price = parseFloat(item.unit_price);
                const total_price = qty * price;
                stmt.run([
                    order_id, item.product_id, item.product_name, item.product_code,
                    item.description, qty, price, total_price, item.unit_of_measure
                ]);
            });

            stmt.finalize((err) => {
                if (err) {
                    console.error('Error insertando items:', err);
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({
                    message: 'Orden de compra creada exitosamente',
                    order_id: order_id,
                    order_number: order_number
                });
            });
        });
    } catch (error) {
        console.error('Error en creación de orden:', error);
        res.status(500).json({ error: error.message });
    }
});

// Actualizar estado de orden
router.put('/:id/status', (req, res) => {
    const { status } = req.body;
    
    const validStatuses = ['pending', 'approved', 'sent', 'received', 'cancelled'];
    if (!validStatuses.includes(status)) {
        res.status(400).json({ error: 'Estado no válido' });
        return;
    }

    const sql = `
        UPDATE purchase_orders 
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `;

    db.run(sql, [status, req.params.id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ error: 'Orden no encontrada' });
            return;
        }
        res.json({ message: 'Estado actualizado exitosamente' });
    });
});

// Eliminar orden de compra
router.delete('/:id', (req, res) => {
    // Primero eliminar los items
    const deleteItemsSql = 'DELETE FROM purchase_order_items WHERE order_id = ?';
    
    db.run(deleteItemsSql, [req.params.id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        // Luego eliminar la orden
        const deleteOrderSql = 'DELETE FROM purchase_orders WHERE id = ?';
        
        db.run(deleteOrderSql, [req.params.id], function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (this.changes === 0) {
                res.status(404).json({ error: 'Orden no encontrada' });
                return;
            }
            res.json({ message: 'Orden eliminada exitosamente' });
        });
    });
});

// Obtener productos disponibles para una orden
router.get('/products/available', (req, res) => {
    const sql = `
        SELECT sp.*, s.name as supplier_name
        FROM supplier_products sp
        JOIN suppliers s ON sp.supplier_id = s.id
        WHERE sp.availability_status = 'available'
        ORDER BY s.name, sp.product_name
    `;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ products: rows });
    });
});

module.exports = router;
