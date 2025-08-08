const express = require('express');
const router = express.Router();
const puppeteer = require('puppeteer');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database(path.join(__dirname, '..', 'database', 'buytrack.db'));

// Template HTML para la orden de compra
const pdfTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Orden de Compra {{order_number}}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #2c3e50;
            background: white;
            font-size: 14px;
        }
        
        .container {
            max-width: 900px;
            margin: 0 auto;
            padding: 30px;
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 40px;
            border-bottom: 3px solid #3498db;
            padding-bottom: 25px;
        }
        
        .company-section {
            flex: 1;
        }
        
        .company-info h1 {
            color: #2c3e50;
            font-size: 28px;
            margin-bottom: 8px;
            font-weight: 700;
            letter-spacing: -0.5px;
        }
        
        .company-info h2 {
            color: #7f8c8d;
            font-size: 16px;
            margin-bottom: 15px;
            font-weight: 400;
        }
        
        .company-details {
            color: #34495e;
            font-size: 13px;
        }
        
        .company-details strong {
            color: #2c3e50;
        }
        
        .order-section {
            text-align: right;
            flex: 0 0 250px;
            background: linear-gradient(135deg, #3498db, #2980b9);
            color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(52, 152, 219, 0.2);
        }
        
        .order-section h2 {
            font-size: 22px;
            margin-bottom: 15px;
            font-weight: 600;
        }
        
        .order-details {
            font-size: 14px;
        }
        
        .order-details div {
            margin-bottom: 8px;
        }
        
        .parties-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 35px;
        }
        
        .party-box {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #3498db;
        }
        
        .party-box h3 {
            color: #2c3e50;
            font-size: 16px;
            margin-bottom: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .party-info {
            color: #34495e;
            font-size: 13px;
            line-height: 1.7;
        }
        
        .party-info strong {
            color: #2c3e50;
        }
        
        .items-section {
            margin-bottom: 30px;
        }
        
        .section-title {
            color: #2c3e50;
            font-size: 18px;
            margin-bottom: 20px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 2px solid #ecf0f1;
            padding-bottom: 8px;
        }
        
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
            border-radius: 8px;
            overflow: hidden;
        }
        
        .items-table th {
            background: linear-gradient(135deg, #34495e, #2c3e50);
            color: white;
            padding: 15px 12px;
            text-align: left;
            font-weight: 600;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .items-table th:last-child,
        .items-table td:last-child {
            text-align: right;
        }
        
        .items-table td {
            padding: 12px;
            border-bottom: 1px solid #ecf0f1;
            font-size: 13px;
            background: white;
        }
        
        .items-table tr:nth-child(even) td {
            background: #f8f9fa;
        }
        
        .items-table tr:hover td {
            background: #e3f2fd;
        }
        
        .product-code {
            color: #7f8c8d;
            font-size: 11px;
            font-style: italic;
        }
        
        .totals-section {
            display: flex;
            justify-content: flex-end;
            margin-top: 30px;
        }
        
        .totals-box {
            background: white;
            border: 2px solid #ecf0f1;
            border-radius: 8px;
            padding: 25px;
            min-width: 300px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.05);
        }
        
        .totals-table {
            width: 100%;
        }
        
        .totals-table td {
            padding: 8px 0;
            font-size: 14px;
        }
        
        .totals-table .label {
            color: #34495e;
            font-weight: 500;
        }
        
        .totals-table .amount {
            text-align: right;
            color: #2c3e50;
            font-weight: 600;
        }
        
        .total-final {
            border-top: 2px solid #3498db;
            padding-top: 12px !important;
            margin-top: 8px;
        }
        
        .total-final .label {
            color: #2c3e50;
            font-size: 16px;
            font-weight: 700;
            text-transform: uppercase;
        }
        
        .total-final .amount {
            color: #3498db;
            font-size: 18px;
            font-weight: 700;
        }
        
        .footer {
            margin-top: 40px;
            text-align: center;
            color: #7f8c8d;
            font-size: 12px;
            border-top: 1px solid #ecf0f1;
            padding-top: 20px;
        }
        
        .currency {
            font-size: 12px;
            color: #7f8c8d;
            margin-left: 4px;
        }
        
        @media print {
            body { print-color-adjust: exact; }
            .container { max-width: none; margin: 0; padding: 20px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <div class="company-section">
                <div class="company-info">
                    <h1>Consorcio O&C</h1>
                    <h2>Nera Group</h2>
                    <div class="company-details">
                        <div><strong>RUT:</strong> 12.345.678-9</div>
                        <div><strong>Dirección:</strong> Oficina Consorcio 123, Santiago, Chile</div>
                        <div><strong>Teléfono:</strong> +56 2 2XXX XXXX</div>
                        <div><strong>Email:</strong> contacto@consorcio-oc.cl</div>
                    </div>
                </div>
            </div>
            
            <div class="order-section">
                <h2>ORDEN DE COMPRA</h2>
                <div class="order-details">
                    <div><strong>N°:</strong> {{order_number}}</div>
                    <div><strong>Fecha:</strong> {{formatted_date}}</div>
                    <div><strong>Estado:</strong> {{status_label}}</div>
                    <div><strong>Total:</strong> ${{formatted_total}} {{currency}}</div>
                </div>
            </div>
        </div>

        <!-- Parties Section -->
        <div class="parties-section">
            <div class="party-box">
                <h3>Datos del Proveedor</h3>
                <div class="party-info">
                    <div><strong>Empresa:</strong> {{supplier_name}}</div>
                    {{#if supplier_contact_person}}<div><strong>Contacto:</strong> {{supplier_contact_person}}</div>{{/if}}
                    {{#if supplier_email}}<div><strong>Email:</strong> {{supplier_email}}</div>{{/if}}
                    {{#if supplier_phone}}<div><strong>Teléfono:</strong> {{supplier_phone}}</div>{{/if}}
                    {{#if supplier_address}}<div><strong>Dirección:</strong> {{supplier_address}}</div>{{/if}}
                    {{#if supplier_city}}<div><strong>Ciudad:</strong> {{supplier_city}}, {{supplier_country}}</div>{{/if}}
                    {{#if supplier_tax_id}}<div><strong>RUT:</strong> {{supplier_tax_id}}</div>{{/if}}
                </div>
            </div>
            
            <div class="party-box">
                <h3>Información de Entrega</h3>
                <div class="party-info">
                    <div><strong>Entregar a:</strong> Consorcio O&C - Nera Group</div>
                    <div><strong>Dirección:</strong> Oficina Consorcio 123</div>
                    <div><strong>Santiago, Chile</strong></div>
                    <div><strong>Fecha Estimada:</strong> {{delivery_date}}</div>
                    {{#if notes}}<div><strong>Observaciones:</strong> {{notes}}</div>{{/if}}
                </div>
            </div>
        </div>

        <!-- Items Section -->
        <div class="items-section">
            <h3 class="section-title">Detalle de Productos y Servicios</h3>
            <table class="items-table">
                <thead>
                    <tr>
                        <th>Código</th>
                        <th>Descripción</th>
                        <th>Cantidad</th>
                        <th>Precio Unitario</th>
                        <th>Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    {{#each items}}
                    <tr>
                        <td>
                            <div>{{product_code}}</div>
                            <div class="product-code">{{unit_of_measure}}</div>
                        </td>
                        <td>
                            <div><strong>{{product_name}}</strong></div>
                            {{#if description}}<div style="color: #7f8c8d; font-size: 12px; margin-top: 4px;">{{description}}</div>{{/if}}
                        </td>
                        <td>{{quantity}}</td>
                        <td>${{formatted_unit_price}} <span class="currency">{{currency}}</span></td>
                        <td>${{formatted_subtotal}} <span class="currency">{{currency}}</span></td>
                    </tr>
                    {{/each}}
                </tbody>
            </table>
        </div>

        <!-- Totals Section -->
        <div class="totals-section">
            <div class="totals-box">
                <table class="totals-table">
                    <tr>
                        <td class="label">Subtotal (Neto):</td>
                        <td class="amount">${{formatted_subtotal_neto}} {{currency}}</td>
                    </tr>
                    <tr>
                        <td class="label">IVA (19%):</td>
                        <td class="amount">${{formatted_iva}} {{currency}}</td>
                    </tr>
                    <tr class="total-final">
                        <td class="label">Total:</td>
                        <td class="amount">${{formatted_total}} {{currency}}</td>
                    </tr>
                </table>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p>Este documento ha sido generado automáticamente por el sistema de gestión de compras de Consorcio O&C.</p>
            <p>Para consultas, contactar a: compras@consorcio-oc.cl</p>
        </div>
    </div>
</body>
</html>
`;
        }
        
        .company-info p {
            color: #666;
            font-size: 14px;
        }
        
        .order-info {
            text-align: right;
        }
        
        .order-info h2 {
            color: #e74c3c;
            font-size: 28px;
            margin-bottom: 10px;
        }
        
        .order-info p {
            font-size: 14px;
            margin-bottom: 5px;
        }
        
        .details-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
        }
        
        .detail-box {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 20px;
            background: #f8f9fa;
        }
        
        .detail-box h3 {
            color: #2c3e50;
            margin-bottom: 15px;
            font-size: 16px;
            border-bottom: 2px solid #3498db;
            padding-bottom: 5px;
        }
        
        .detail-box p {
            margin-bottom: 8px;
            font-size: 14px;
        }
        
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            border-radius: 8px;
            overflow: hidden;
        }
        
        .items-table th {
            background: linear-gradient(135deg, #2c3e50, #3498db);
            color: white;
            padding: 15px 10px;
            text-align: left;
            font-weight: 600;
            font-size: 14px;
        }
        
        .items-table td {
            padding: 12px 10px;
            border-bottom: 1px solid #eee;
            font-size: 13px;
        }
        
        .items-table tbody tr:hover {
            background: #f8f9fa;
        }
        
        .items-table tbody tr:nth-child(even) {
            background: #fdfdfd;
        }
        
        .text-right {
            text-align: right;
        }
        
        .totals-section {
            max-width: 400px;
            margin-left: auto;
            border: 2px solid #2c3e50;
            border-radius: 8px;
            overflow: hidden;
        }
        
        .totals-row {
            display: flex;
            justify-content: space-between;
            padding: 12px 20px;
            border-bottom: 1px solid #eee;
        }
        
        .totals-row:last-child {
            border-bottom: none;
            background: linear-gradient(135deg, #2c3e50, #34495e);
            color: white;
            font-weight: bold;
            font-size: 16px;
        }
        
        .totals-row.subtotal {
            background: #f8f9fa;
        }
        
        .totals-row.tax {
            background: #f1f2f6;
        }
        
        .notes {
            margin-top: 30px;
            padding: 20px;
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
        }
        
        .notes h3 {
            color: #856404;
            margin-bottom: 10px;
        }
        
        .notes p {
            color: #856404;
            font-size: 14px;
        }
        
        .footer {
            margin-top: 40px;
            text-align: center;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #666;
            font-size: 12px;
        }
        
        .status-badge {
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }
        
        .status-pending {
            background: #fff3cd;
            color: #856404;
        }
        
        .status-approved {
            background: #d4edda;
            color: #155724;
        }
        
        .status-sent {
            background: #cce5ff;
            color: #004085;
        }
        
        .currency {
            font-weight: 600;
            color: #27ae60;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <div class="company-info">
                <h1>Sistema de Compras</h1>
                <p>Gestión Interna de Compras y Proveedores</p>
                <p>📧 compras@empresa.cl | 📞 +56 2 1234 5678</p>
            </div>
            <div class="order-info">
                <h2>ORDEN DE COMPRA</h2>
                <p><strong>Número:</strong> {{order_number}}</p>
                <p><strong>Fecha:</strong> {{order_date}}</p>
                <p><strong>Moneda:</strong> {{currency}}</p>
                <p><strong>Plazo de Pago:</strong> {{payment_terms}}</p>
                <p><strong>Estado:</strong> <span class="status-badge status-{{status}}">{{status_text}}</span></p>
            </div>
        </div>

        <!-- Detalles -->
        <div class="details-section">
            <div class="detail-box">
                <h3>🏢 Información del Proveedor</h3>
                <p><strong>{{supplier_name}}</strong></p>
                <p><strong>Contacto:</strong> {{contact_person}}</p>
                <p><strong>Email:</strong> {{supplier_email}}</p>
                <p><strong>Teléfono:</strong> {{supplier_phone}}</p>
                <p><strong>Dirección:</strong> {{supplier_address}}</p>
                <p><strong>Ciudad:</strong> {{supplier_city}}, {{supplier_country}}</p>
                <p><strong>ID Fiscal:</strong> {{supplier_tax_id}}</p>
            </div>
            
            <div class="detail-box">
                <h3>📋 Detalles de la Orden</h3>
                <p><strong>Fecha de Entrega:</strong> {{delivery_date}}</p>
                <p><strong>Términos de Pago:</strong> {{payment_terms}}</p>
                <p><strong>Moneda:</strong> {{currency}}</p>
                {{#if shipping_address}}
                <p><strong>Dirección de Envío:</strong><br>{{shipping_address}}</p>
                {{/if}}
            </div>
        </div>

        <!-- Tabla de Items -->
        <table class="items-table">
            <thead>
                <tr>
                    <th>Código</th>
                    <th>Producto</th>
                    <th>Descripción</th>
                    <th>Cantidad</th>
                    <th>Unidad</th>
                    <th class="text-right">Precio Unit.</th>
                    <th class="text-right">Total</th>
                </tr>
            </thead>
            <tbody>
                {{#each items}}
                <tr>
                    <td>{{product_code}}</td>
                    <td><strong>{{product_name}}</strong></td>
                    <td>{{description}}</td>
                    <td class="text-right">{{quantity}}</td>
                    <td>{{unit_of_measure}}</td>
                    <td class="text-right currency">{{unit_price}}</td>
                    <td class="text-right currency">{{total_price}}</td>
                </tr>
                {{/each}}
            </tbody>
        </table>

        <!-- Totales -->
        <div class="totals-section">
            <div class="totals-row subtotal">
                <span>Subtotal:</span>
                <span class="currency">{{subtotal}}</span>
            </div>
            <div class="totals-row tax">
                <span>Impuestos (10%):</span>
                <span class="currency">{{tax_amount}}</span>
            </div>
            <div class="totals-row">
                <span>TOTAL:</span>
                <span class="currency">{{total_amount}}</span>
            </div>
        </div>

        <!-- Notas -->
        {{#if notes}}
        <div class="notes">
            <h3>📝 Notas Adicionales</h3>
            <p>{{notes}}</p>
        </div>
        {{/if}}

        <!-- Footer -->
        <div class="footer">
            <p>Esta orden de compra fue generada automáticamente por el Sistema de Compras.</p>
            <p>Para cualquier consulta, por favor contacte a nuestro departamento de compras.</p>
        </div>
    </div>
</body>
</html>
`;

// Generar PDF de orden de compra
router.get('/order/:id', async (req, res) => {
    try {
        // Obtener datos de la orden
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
        
        // Promisificar las consultas de base de datos
        const getOrder = () => {
            return new Promise((resolve, reject) => {
                db.get(orderSql, [req.params.id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        };
        
        const getItems = () => {
            return new Promise((resolve, reject) => {
                db.all(itemsSql, [req.params.id], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        };
        
        const order = await getOrder();
        const items = await getItems();
        
        if (!order) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }
        
        // Formatear datos para el template
        const templateData = {
            ...order,
            items: items.map(item => ({
                ...item,
                unit_price: parseFloat(item.unit_price).toFixed(2),
                total_price: parseFloat(item.total_price).toFixed(2)
            })),
            subtotal: parseFloat(order.subtotal).toFixed(2),
            tax_amount: parseFloat(order.tax_amount).toFixed(2),
            total_amount: parseFloat(order.total_amount).toFixed(2),
            order_date: new Date(order.order_date).toLocaleDateString('es-ES'),
            delivery_date: order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('es-ES') : 'No especificada',
            status_text: getStatusText(order.status)
        };
        
        // Compilar template
        const template = handlebars.compile(pdfTemplate);
        const html = template(templateData);
        
        // Generar PDF
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20px',
                right: '20px',
                bottom: '20px',
                left: '20px'
            }
        });
        
        await browser.close();
        
        // Enviar PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="orden-compra-${order.order_number}.pdf"`);
        res.send(pdfBuffer);
        
    } catch (error) {
        console.error('Error generando PDF:', error);
        res.status(500).json({ error: 'Error generando PDF: ' + error.message });
    }
});

// Vista previa HTML de la orden
router.get('/preview/:id', async (req, res) => {
    try {
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
        
        const getOrder = () => {
            return new Promise((resolve, reject) => {
                db.get(orderSql, [req.params.id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        };
        
        const getItems = () => {
            return new Promise((resolve, reject) => {
                db.all(itemsSql, [req.params.id], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        };
        
        const order = await getOrder();
        const items = await getItems();
        
        if (!order) {
            return res.status(404).send('<h1>Orden no encontrada</h1>');
        }
        
        const templateData = {
            ...order,
            items: items.map(item => ({
                ...item,
                unit_price: parseFloat(item.unit_price).toFixed(2),
                total_price: parseFloat(item.total_price).toFixed(2)
            })),
            subtotal: parseFloat(order.subtotal).toFixed(2),
            tax_amount: parseFloat(order.tax_amount).toFixed(2),
            total_amount: parseFloat(order.total_amount).toFixed(2),
            order_date: new Date(order.order_date).toLocaleDateString('es-ES'),
            delivery_date: order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('es-ES') : 'No especificada',
            status_text: getStatusText(order.status)
        };
        
        const template = handlebars.compile(pdfTemplate);
        const html = template(templateData);
        
        res.send(html);
        
    } catch (error) {
        console.error('Error generando vista previa:', error);
        res.status(500).send('<h1>Error generando vista previa</h1>');
    }
});

function getStatusText(status) {
    const statusMap = {
        'pending': 'Pendiente',
        'approved': 'Aprobada',
        'sent': 'Enviada',
        'received': 'Recibida',
        'cancelled': 'Cancelada'
    };
    return statusMap[status] || status;
}

module.exports = router;
