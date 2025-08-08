const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, '..', 'database', 'buytrack.db'));

console.log('Generando órdenes de ejemplo...');

async function generateSampleOrders() {
    return new Promise((resolve, reject) => {
        // Obtener datos necesarios
        db.all(`
            SELECT 
                cc.id as cost_center_id,
                s.id as supplier_id,
                sp.id as product_id,
                sp.product_name,
                sp.product_code,
                sp.description,
                sp.unit_price,
                sp.unit_of_measure
            FROM cost_centers cc
            CROSS JOIN suppliers s
            CROSS JOIN supplier_products sp
            WHERE cc.is_active = 1 AND s.id = sp.supplier_id
            ORDER BY RANDOM()
            LIMIT 10
        `, (err, combinations) => {
            if (err) return reject(err);
            
            const currentMonth = new Date().toISOString().substr(0, 7);
            const lastMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().substr(0, 7);
            
            let orderCount = 0;
            const generateOrder = (combo, month) => {
                const orderDate = `${month}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`;
                const quantity = Math.floor(Math.random() * 5) + 1;
                const unitPrice = combo.unit_price;
                const subtotal = quantity * unitPrice;
                const taxAmount = subtotal * 0.19;
                const totalAmount = subtotal + taxAmount;
                
                // Generar número de orden simple
                const orderNumber = `ORD-${month.replace('-', '')}-${String(orderCount + 1).padStart(3, '0')}`;
                
                db.run(`
                    INSERT INTO purchase_orders 
                    (order_number, supplier_id, cost_center_id, order_date, subtotal, tax_amount, total_amount, currency, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'CLP', 'received')
                `, [orderNumber, combo.supplier_id, combo.cost_center_id, orderDate, subtotal, taxAmount, totalAmount], function(err) {
                    if (err) {
                        console.error('Error creando orden:', err);
                        return;
                    }
                    
                    const orderId = this.lastID;
                    
                    // Insertar item de la orden
                    db.run(`
                        INSERT INTO purchase_order_items 
                        (order_id, product_id, product_name, product_code, description, quantity, unit_price, total_price, unit_of_measure)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [orderId, combo.product_id, combo.product_name, combo.product_code, combo.description, quantity, unitPrice, subtotal, combo.unit_of_measure], (err) => {
                        if (err) {
                            console.error('Error creando item:', err);
                        }
                    });
                });
                
                orderCount++;
            };
            
            // Generar órdenes para mes actual y anterior
            combinations.forEach((combo, index) => {
                if (index < 5) {
                    generateOrder(combo, currentMonth);
                }
                if (index < 8) {
                    generateOrder(combo, lastMonth);
                }
            });
            
            setTimeout(() => {
                console.log(`${orderCount} órdenes de ejemplo generadas`);
                resolve();
            }, 1000);
        });
    });
}

generateSampleOrders().then(() => {
    db.close();
    console.log('Proceso completado');
}).catch(console.error);
