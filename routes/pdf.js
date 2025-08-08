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
        body {
            font-family: Arial, sans-serif;
            line-height: 1.4;
            color: #333;
            font-size: 14px;
            margin: 20px;
            padding: 0;
        }
        
        .header {
            margin-bottom: 30px;
            border-bottom: 2px solid #0066cc;
            padding-bottom: 20px;
        }
        
        .header-flex {
            display: table;
            width: 100%;
        }
        
        .company-section {
            display: table-cell;
            vertical-align: top;
            width: 60%;
        }
        
        .order-section {
            display: table-cell;
            vertical-align: top;
            width: 40%;
            text-align: right;
        }
        
        .company-info h1 {
            color: #0066cc;
            font-size: 24px;
            margin: 0 0 5px 0;
        }
        
        .company-info h2 {
            color: #666;
            font-size: 14px;
            margin: 0 0 10px 0;
        }
        
        .company-details {
            font-size: 12px;
            line-height: 1.5;
        }
        
        .order-box {
            background: #f0f8ff;
            padding: 15px;
            border-radius: 5px;
            display: inline-block;
        }
        
        .order-box h2 {
            color: #0066cc;
            font-size: 18px;
            margin: 0 0 10px 0;
        }
        
        .parties {
            margin-bottom: 25px;
        }
        
        .parties-flex {
            display: table;
            width: 100%;
        }
        
        .party-box {
            display: table-cell;
            width: 48%;
            background: #f9f9f9;
            padding: 15px;
            border-radius: 5px;
            border-left: 3px solid #0066cc;
            vertical-align: top;
        }
        
        .party-box + .party-box {
            margin-left: 4%;
        }
        
        .party-box h3 {
            color: #0066cc;
            font-size: 14px;
            margin: 0 0 10px 0;
            text-transform: uppercase;
        }
        
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        
        .items-table th {
            background: #0066cc;
            color: white;
            padding: 10px 8px;
            text-align: left;
            font-size: 12px;
            font-weight: bold;
        }
        
        .items-table th:last-child,
        .items-table td:last-child {
            text-align: right;
        }
        
        .items-table td {
            padding: 8px;
            border-bottom: 1px solid #ddd;
            font-size: 12px;
        }
        
        .items-table tr:nth-child(even) {
            background: #f9f9f9;
        }
        
        .totals-wrapper {
            text-align: right;
            margin-top: 20px;
        }
        
        .totals {
            display: inline-block;
            width: 300px;
            background: #f9f9f9;
            padding: 15px;
            border-radius: 5px;
            border: 1px solid #ddd;
        }
        
        .totals table {
            width: 100%;
        }
        
        .totals td {
            padding: 5px 0;
            font-size: 13px;
        }
        
        .totals .label {
            text-align: left;
        }
        
        .totals .amount {
            text-align: right;
            font-weight: bold;
        }
        
        .total-final {
            border-top: 2px solid #0066cc;
            padding-top: 8px !important;
            margin-top: 5px;
        }
        
        .total-final .label {
            font-size: 15px;
            font-weight: bold;
            color: #0066cc;
        }
        
        .total-final .amount {
            font-size: 16px;
            color: #0066cc;
        }
        
        .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 11px;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 15px;
        }
        
        .product-code {
            color: #666;
            font-size: 10px;
            font-style: italic;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-flex">
            <div class="company-section">
                <div class="company-info">
                    <h1>Consorcio O&C-Nera Group.</h1>
                    <div class="company-details">
                        <div><strong>RUT:</strong> 12.345.678-9</div>
                        <div><strong>Dirección:</strong> Oficina Consorcio 123, Santiago, Chile</div>
                        <div><strong>Teléfono:</strong> +56 2 2XXX XXXX</div>
                        <div><strong>Email:</strong> contacto@cong.cl</div>
                    </div>
                </div>
            </div>
            
            <div class="order-section">
                <div class="order-box">
                    <h2>ORDEN DE COMPRA</h2>
                    <div><strong>N°:</strong> {{order_number}}</div>
                    <div><strong>Fecha:</strong> {{formatted_date}}</div>
                    <div><strong>Estado:</strong> {{status_label}}</div>
                    <div><strong>Total:</strong> {{currency_symbol}}{{formatted_total}} {{currency}}</div>
                </div>
            </div>
        </div>
    </div>

    <div class="parties">
        <div class="parties-flex">
            <div class="party-box">
                <h3>Datos del Proveedor</h3>
                <div><strong>Empresa:</strong> {{supplier_name}}</div>
                <div><strong>Contacto:</strong> {{supplier_contact_person}}</div>
                <div><strong>Email:</strong> {{supplier_email}}</div>
                <div><strong>Teléfono:</strong> {{supplier_phone}}</div>
                <div><strong>Dirección:</strong> {{supplier_address}}</div>
                <div><strong>Ciudad:</strong> {{supplier_city}}, {{supplier_country}}</div>
                <div><strong>RUT:</strong> {{supplier_tax_id}}</div>
            </div>
            
            <div class="party-box">
                <h3>Información de Entrega</h3>
                <div><strong>Entregar a:</strong> Consorcio O&C - Nera Group</div>
                <div><strong>Dirección:</strong> {{delivery_address}}</div>
                <div><strong>Fecha Estimada:</strong> {{delivery_date}}</div>
                {{#if cost_center_name}}
                <div><strong>Centro de Costo:</strong> {{cost_center_code}} - {{cost_center_name}}</div>
                {{/if}}
                <div><strong>Observaciones:</strong> {{notes}}</div>
            </div>
        </div>
    </div>

    <h3 style="color: #0066cc; border-bottom: 1px solid #0066cc; padding-bottom: 5px; margin-bottom: 15px;">Detalle de Productos y Servicios</h3>
    
    <table class="items-table">
        <thead>
            <tr>
                <th>Código</th>
                <th>Descripción</th>
                <th>Cantidad</th>
                <th>Precio Unit.</th>
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
                    <div style="color: #666; font-size: 10px;">{{description}}</div>
                </td>
                <td>{{quantity}}</td>
                <td>{{currency_symbol}}{{formatted_unit_price}}</td>
                <td>{{currency_symbol}}{{formatted_subtotal}}</td>
            </tr>
            {{/each}}
        </tbody>
    </table>

    <div class="totals-wrapper">
        <div class="totals">
            <table>
                <tr>
                    <td class="label">Subtotal (Neto):</td>
                    <td class="amount">{{currency_symbol}}{{formatted_subtotal_neto}} {{currency}}</td>
                </tr>
                <tr>
                    <td class="label">IVA (19%):</td>
                    <td class="amount">{{currency_symbol}}{{formatted_iva}} {{currency}}</td>
                </tr>
                <tr class="total-final">
                    <td class="label">Total:</td>
                    <td class="amount">{{currency_symbol}}{{formatted_total}} {{currency}}</td>
                </tr>
            </table>
        </div>
    </div>

    <div class="footer">
        <p>Este documento ha sido generado automáticamente por el sistema de gestión de compras de Consorcio O&C-Nera Group.</p>
        <p>Para consultas, contactar a: compras@cong.cl</p>
    </div>
</body>
</html>`; 
}

// Generar PDF de orden de compra
router.get('/order/:id', async (req, res) => {
    try {
        const orderId = req.params.id;
        console.log(`Generando PDF para orden ID: ${orderId}`);
        
        // Obtener datos de la orden con manejo de errores mejorado
        const orderSql = `
            SELECT o.*, 
                   COALESCE(s.name, 'N/A') as supplier_name, 
                   COALESCE(s.contact_person, '') as supplier_contact_person,
                   COALESCE(s.email, '') as supplier_email, 
                   COALESCE(s.phone, '') as supplier_phone, 
                   COALESCE(s.address, '') as supplier_address,
                   COALESCE(s.city, '') as supplier_city, 
                   COALESCE(s.country, '') as supplier_country, 
                   COALESCE(s.tax_id, '') as supplier_tax_id,
                   cc.name as cost_center_name, 
                   cc.code as cost_center_code
            FROM purchase_orders o
            LEFT JOIN suppliers s ON o.supplier_id = s.id
            LEFT JOIN cost_centers cc ON o.cost_center_id = cc.id
            WHERE o.id = ?
        `;
        
        const order = await new Promise((resolve, reject) => {
            db.get(orderSql, [orderId], (err, row) => {
                if (err) {
                    console.error('Error obteniendo orden:', err);
                    reject(err);
                } else {
                    console.log('Orden obtenida:', row);
                    resolve(row);
                }
            });
        });
        
        if (!order) {
            console.log('Orden no encontrada');
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        // Validar que la orden tenga datos mínimos requeridos
        if (!order.id) {
            console.error('Orden sin ID válido');
            return res.status(400).json({ error: 'Orden sin datos válidos' });
        }

        // Obtener items de la orden con manejo de errores mejorado
        const itemsSql = `
            SELECT oi.*, 
                   COALESCE(sp.product_name, 'Producto sin nombre') as product_name, 
                   COALESCE(sp.product_code, 'SIN-CODIGO') as product_code, 
                   COALESCE(sp.description, '') as description, 
                   COALESCE(sp.unit_of_measure, 'UN') as unit_of_measure
            FROM purchase_order_items oi
            LEFT JOIN supplier_products sp ON oi.product_id = sp.id
            WHERE oi.order_id = ?
        `;
        
        const items = await new Promise((resolve, reject) => {
            db.all(itemsSql, [orderId], (err, rows) => {
                if (err) {
                    console.error('Error obteniendo items:', err);
                    reject(err);
                } else {
                    console.log('Items obtenidos:', rows);
                    resolve(rows);
                }
            });
        });
        
        // Calcular totales
        const subtotalNeto = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        const iva = subtotalNeto * 0.19;
        const total = subtotalNeto + iva;
        
        console.log('Totales calculados:', { subtotalNeto, iva, total });
        
        // Formatear fechas
        const orderDate = new Date(order.order_date || order.created_at);
        const deliveryDate = order.delivery_date ? new Date(order.delivery_date) : new Date(orderDate.getTime() + (7 * 24 * 60 * 60 * 1000));
        
        // Formatear números según la moneda
        const formatNumber = (num, currency) => {
            const n = Number(num);
            if (!Number.isFinite(n)) return '0';
            if (currency === 'UF') {
                return new Intl.NumberFormat('es-CL', {
                    minimumFractionDigits: 4,
                    maximumFractionDigits: 4
                }).format(n);
            }
            if (currency === 'USD') {
                return new Intl.NumberFormat('es-CL', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }).format(n);
            }
            // CLP y otras
            return new Intl.NumberFormat('es-CL', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(n);
        };
        
        // Obtener símbolo de moneda
        const getCurrencySymbol = (currency) => {
            switch(currency) {
                case 'UF': return 'UF ';
                case 'USD': return 'US$ ';
                case 'CLP': 
                default: return '$ ';
            }
        };
        
        const currency = order.currency || 'CLP';
        const currencySymbol = getCurrencySymbol(currency);
        
        console.log('Moneda y símbolo:', { currency, currencySymbol });
        
        // Preparar datos para el template
        const templateData = {
            order_number: order.order_number || 'N/A',
            formatted_date: orderDate.toLocaleDateString('es-CL', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric' 
            }),
            delivery_date: deliveryDate.toLocaleDateString('es-CL', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric' 
            }),
            status_label: getStatusLabel(order.status),
            currency: currency,
            currency_symbol: currencySymbol,
            supplier_name: order.supplier_name || 'N/A',
            supplier_contact_person: order.supplier_contact_person || '',
            supplier_email: order.supplier_email || '',
            supplier_phone: order.supplier_phone || '',
            supplier_address: order.supplier_address || '',
            supplier_city: order.supplier_city || '',
            supplier_country: order.supplier_country || '',
            supplier_tax_id: order.supplier_tax_id || '',
            delivery_address: order.shipping_address || 'Oficina Consorcio 123, Santiago, Chile',
            notes: order.notes || '',
            cost_center_name: order.cost_center_name || null,
            cost_center_code: order.cost_center_code || null,
            formatted_subtotal_neto: formatNumber(order.subtotal || subtotalNeto, currency),
            formatted_iva: formatNumber(order.tax_amount || iva, currency),
            formatted_total: formatNumber(order.total_amount || total, currency),
            items: items.map(item => ({
                product_code: item.product_code || 'N/A',
                product_name: item.product_name || 'N/A',
                description: item.description || '',
                quantity: item.quantity || 0,
                unit_of_measure: item.unit_of_measure || 'UN',
                formatted_unit_price: formatNumber(item.unit_price, currency),
                formatted_subtotal: formatNumber(item.total_price || (item.quantity * item.unit_price), currency),
                currency_symbol: currencySymbol
            }))
        };
        
        console.log('Datos del template preparados');
        
        // Compilar template
        const template = handlebars.compile(getPdfTemplate());
        const html = template(templateData);
        
        console.log('Template compilado, HTML generado (primeros 500 chars):', html.substring(0, 500));
        console.log('Iniciando Puppeteer...');
        
        // Generar PDF - usar flags mínimos y mediaType para evitar páginas en blanco
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ],
            defaultViewport: {
                width: 1200,
                height: 800
            }
        });
        
        const page = await browser.newPage();
        
        console.log('Página creada, configurando contenido...');
        
        await page.setContent(html, { 
            waitUntil: ['load', 'domcontentloaded', 'networkidle0'],
            timeout: 60000
        });
        
        // Asegurar colores y fondos
        await page.emulateMediaType('screen');
        
        // Esperar a que las fuentes estén listas (por si alguna fuente del sistema tarda)
        try {
            await page.evaluate(async () => { await (document.fonts && document.fonts.ready); });
        } catch (_) {}
        
        console.log('Contenido configurado, esperando renderizado...');
        
        // Esperar un poco más para asegurar renderizado
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Verificar que el contenido se cargó
        const bodyContent = await page.evaluate(() => document.body.innerText);
        console.log('Contenido del body (primeros 200 chars):', bodyContent.substring(0, 200));
        
        console.log('Generando PDF...');
        
        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '15mm',
                right: '15mm',
                bottom: '15mm',
                left: '15mm'
            },
            displayHeaderFooter: false,
            preferCSSPageSize: false
        });
        
        await browser.close();
        
        console.log(`PDF generado exitosamente. Tamaño: ${pdf.length} bytes`);
        
        // Verificar que el PDF no esté vacío
        if (pdf.length < 1000) {
            console.warn('¡Advertencia! El PDF generado es muy pequeño, posiblemente esté vacío.');
        }
        
        // Enviar como Buffer para evitar serialización JSON de Uint8Array
        const pdfBuffer = Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);
        
        // Configurar headers para descarga o vista previa
        const filename = `Orden_Compra_${order.order_number || 'SN'}.pdf`;
        const dispositionParam = (req.query && (req.query.disposition || (req.query.inline === '1' ? 'inline' : undefined))) || 'attachment';
        const contentDisposition = dispositionParam === 'inline' ? `inline; filename="${filename}"` : `attachment; filename="${filename}"`;
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', contentDisposition);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.end(pdfBuffer);
        
    } catch (error) {
        console.error('Error generando PDF:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({ 
            error: 'Error al generar el PDF',
            details: error.message 
        });
    }
});

function getStatusLabel(status) {
    const statusLabels = {
        'draft': 'Borrador',
        'pending': 'Pendiente',
        'approved': 'Aprobada',
        'sent': 'Enviada',
        'received': 'Recibida',
        'cancelled': 'Cancelada'
    };
    return statusLabels[status] || status;
}

module.exports = router;
