const express = require('express');
const router = express.Router();
const puppeteer = require('puppeteer');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database(path.join(__dirname, '..', 'database', 'buytrack.db'));

// Función para obtener el template HTML
function getPdfTemplate() {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Orden de Compra</title>
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
                        <td>\${{formatted_unit_price}} <span class="currency">{{currency}}</span></td>
                        <td>\${{formatted_subtotal}} <span class="currency">{{currency}}</span></td>
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
                        <td class="amount">\${{formatted_subtotal_neto}} {{currency}}</td>
                    </tr>
                    <tr>
                        <td class="label">IVA (19%):</td>
                        <td class="amount">\${{formatted_iva}} {{currency}}</td>
                    </tr>
                    <tr class="total-final">
                        <td class="label">Total:</td>
                        <td class="amount">\${{formatted_total}} {{currency}}</td>
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
</html>`;
}

// Generar PDF de orden de compra
router.get('/order/:id', async (req, res) => {
    try {
        const orderId = req.params.id;
        
        // Obtener datos de la orden
        const orderSql = `
            SELECT o.*, s.name as supplier_name, s.contact_person as supplier_contact_person,
                   s.email as supplier_email, s.phone as supplier_phone, s.address as supplier_address,
                   s.city as supplier_city, s.country as supplier_country, s.tax_id as supplier_tax_id
            FROM orders o
            JOIN suppliers s ON o.supplier_id = s.id
            WHERE o.id = ?
        `;
        
        const order = await new Promise((resolve, reject) => {
            db.get(orderSql, [orderId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (!order) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }
        
        // Obtener items de la orden
        const itemsSql = `
            SELECT oi.*, sp.product_name, sp.product_code, sp.description, sp.unit_of_measure
            FROM order_items oi
            JOIN supplier_products sp ON oi.product_id = sp.id
            WHERE oi.order_id = ?
        `;
        
        const items = await new Promise((resolve, reject) => {
            db.all(itemsSql, [orderId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        // Calcular totales
        const subtotalNeto = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        const iva = subtotalNeto * 0.19;
        const total = subtotalNeto + iva;
        
        // Formatear fechas
        const orderDate = new Date(order.created_at);
        const deliveryDate = new Date(orderDate.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 días después
        
        // Formatear números para mostrar
        const formatNumber = (num) => {
            return new Intl.NumberFormat('es-CL', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            }).format(num);
        };
        
        // Preparar datos para el template
        const templateData = {
            order_number: order.order_number,
            formatted_date: orderDate.toLocaleDateString('es-CL'),
            delivery_date: deliveryDate.toLocaleDateString('es-CL'),
            status_label: getStatusLabel(order.status),
            currency: order.currency || 'CLP',
            supplier_name: order.supplier_name,
            supplier_contact_person: order.supplier_contact_person,
            supplier_email: order.supplier_email,
            supplier_phone: order.supplier_phone,
            supplier_address: order.supplier_address,
            supplier_city: order.supplier_city,
            supplier_country: order.supplier_country,
            supplier_tax_id: order.supplier_tax_id,
            notes: order.notes,
            formatted_subtotal_neto: formatNumber(subtotalNeto),
            formatted_iva: formatNumber(iva),
            formatted_total: formatNumber(total),
            items: items.map(item => ({
                ...item,
                formatted_unit_price: formatNumber(item.unit_price),
                formatted_subtotal: formatNumber(item.quantity * item.unit_price)
            }))
        };
        
        // Compilar template
        const template = handlebars.compile(getPdfTemplate());
        const html = template(templateData);
        
        // Generar PDF
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        
        const pdf = await page.pdf({
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
        
        // Configurar headers para descarga
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Orden_Compra_${order.order_number}.pdf"`);
        res.send(pdf);
        
    } catch (error) {
        console.error('Error generando PDF:', error);
        res.status(500).json({ error: 'Error al generar el PDF' });
    }
});

function getStatusLabel(status) {
    const statusLabels = {
        'draft': 'Borrador',
        'pending': 'Pendiente',
        'approved': 'Aprobada',
        'received': 'Recibida',
        'cancelled': 'Cancelada'
    };
    return statusLabels[status] || status;
}

module.exports = router;
