const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, '..', 'database', 'buytrack.db'));

// Obtener todos los proveedores
router.get('/', (req, res) => {
    const sql = `
        SELECT s.*, 
               COUNT(sp.id) as product_count
        FROM suppliers s
        LEFT JOIN supplier_products sp ON s.id = sp.supplier_id
        GROUP BY s.id
        ORDER BY s.name
    `;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ suppliers: rows });
    });
});

// Obtener un proveedor específico
router.get('/:id', (req, res) => {
    const sql = 'SELECT * FROM suppliers WHERE id = ?';
    
    db.get(sql, [req.params.id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: 'Proveedor no encontrado' });
            return;
        }
        res.json({ supplier: row });
    });
});

// Crear nuevo proveedor
router.post('/', (req, res) => {
    const {
        name, contact_person, email, phone, address,
        city, country, tax_id, payment_terms
    } = req.body;

    if (!name) {
        res.status(400).json({ error: 'El nombre del proveedor es requerido' });
        return;
    }

    const sql = `
        INSERT INTO suppliers (name, contact_person, email, phone, address, city, country, tax_id, payment_terms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(sql, [name, contact_person, email, phone, address, city, country, tax_id, payment_terms], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({
            message: 'Proveedor creado exitosamente',
            supplier_id: this.lastID
        });
    });
});

// Actualizar proveedor
router.put('/:id', (req, res) => {
    const {
        name, contact_person, email, phone, address,
        city, country, tax_id, payment_terms
    } = req.body;

    const sql = `
        UPDATE suppliers 
        SET name = ?, contact_person = ?, email = ?, phone = ?, 
            address = ?, city = ?, country = ?, tax_id = ?, 
            payment_terms = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `;

    db.run(sql, [name, contact_person, email, phone, address, city, country, tax_id, payment_terms, req.params.id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ error: 'Proveedor no encontrado' });
            return;
        }
        res.json({ message: 'Proveedor actualizado exitosamente' });
    });
});

// Eliminar proveedor
router.delete('/:id', (req, res) => {
    const sql = 'DELETE FROM suppliers WHERE id = ?';
    
    db.run(sql, [req.params.id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ error: 'Proveedor no encontrado' });
            return;
        }
        res.json({ message: 'Proveedor eliminado exitosamente' });
    });
});

// ========== RUTAS PARA PRODUCTOS DEL PROVEEDOR ==========

// Obtener productos de un proveedor
router.get('/:id/products', (req, res) => {
    const sql = 'SELECT * FROM supplier_products WHERE supplier_id = ? ORDER BY product_name';
    
    db.all(sql, [req.params.id], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ products: rows });
    });
});

// Agregar producto a un proveedor
// Crear producto para un proveedor
router.post('/:id/products', (req, res) => {
    const {
        product_name, description,
        unit_price, currency, unit_of_measure, availability_status
    } = req.body;

    if (!product_name || !product_name.trim()) {
        res.status(400).json({ error: 'El nombre del producto es requerido' });
        return;
    }

    // Verificar que el producto no exista ya para este proveedor
    const checkProductSql = 'SELECT id FROM supplier_products WHERE supplier_id = ? AND LOWER(product_name) = LOWER(?)';
    db.get(checkProductSql, [req.params.id, product_name.trim()], (err, existingProduct) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (existingProduct) {
            res.status(400).json({ error: 'Ya existe un producto con este nombre para este proveedor' });
            return;
        }

        // Generar código automático
        const generateProductCode = (supplierId, callback) => {
            const countSql = 'SELECT COUNT(*) as count FROM supplier_products WHERE supplier_id = ?';
            db.get(countSql, [supplierId], (err, row) => {
                if (err) {
                    callback(err, null);
                    return;
                }
                const nextNumber = (row.count + 1).toString().padStart(3, '0');
                const autoCode = `PROV${supplierId}-PROD${nextNumber}`;
                
                // Verificar que el código generado no exista (por seguridad)
                const checkCodeSql = 'SELECT id FROM supplier_products WHERE product_code = ?';
                db.get(checkCodeSql, [autoCode], (err, codeExists) => {
                    if (err) {
                        callback(err, null);
                        return;
                    }
                    if (codeExists) {
                        // Si existe, intentar con el siguiente número
                        const nextNumber2 = (row.count + 2).toString().padStart(3, '0');
                        const autoCode2 = `PROV${supplierId}-PROD${nextNumber2}`;
                        callback(null, autoCode2);
                    } else {
                        callback(null, autoCode);
                    }
                });
            });
        };

        generateProductCode(req.params.id, (err, finalCode) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            const sql = `
                INSERT INTO supplier_products 
                (supplier_id, product_name, product_code, description, unit_price, currency, unit_of_measure, availability_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            db.run(sql, [
                req.params.id, product_name.trim(), finalCode, description,
                unit_price, currency || 'CLP', unit_of_measure, availability_status || 'available'
            ], function(err) {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({
                    message: 'Producto creado exitosamente',
                    product_id: this.lastID,
                    product_code: finalCode
                });
            });
        });
    });
});

// Actualizar producto
router.put('/:supplierId/products/:productId', (req, res) => {
    const {
        product_name, product_code, description,
        unit_price, currency, unit_of_measure, availability_status
    } = req.body;

    const sql = `
        UPDATE supplier_products 
        SET product_name = ?, product_code = ?, description = ?, 
            unit_price = ?, currency = ?, unit_of_measure = ?, 
            availability_status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND supplier_id = ?
    `;

    db.run(sql, [
        product_name, product_code, description, unit_price, 
        currency, unit_of_measure, availability_status,
        req.params.productId, req.params.supplierId
    ], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ error: 'Producto no encontrado' });
            return;
        }
        res.json({ message: 'Producto actualizado exitosamente' });
    });
});

// Eliminar producto
router.delete('/:supplierId/products/:productId', (req, res) => {
    const sql = 'DELETE FROM supplier_products WHERE id = ? AND supplier_id = ?';
    
    db.run(sql, [req.params.productId, req.params.supplierId], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ error: 'Producto no encontrado' });
            return;
        }
        res.json({ message: 'Producto eliminado exitosamente' });
    });
});

module.exports = router;
