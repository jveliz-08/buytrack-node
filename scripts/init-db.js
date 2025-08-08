const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Crear directorio de base de datos si no existe
const dbDir = path.join(__dirname, '..', 'database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Conectar a la base de datos
const db = new sqlite3.Database(path.join(dbDir, 'buytrack.db'));

console.log('Inicializando base de datos...');

// Helper: ejecutar SQL y loguear errores sin detener
function runSafe(sql, params = []) {
    return new Promise((resolve) => {
        db.run(sql, params, function(err) {
            if (err) {
                console.warn('DB notice:', err.message);
            }
            resolve();
        });
    });
}

// Helper: comprobar si columna existe
function columnExists(table, column) {
    return new Promise((resolve) => {
        db.all(`PRAGMA table_info(${table});`, (err, rows) => {
            if (err) return resolve(false);
            const exists = rows.some(r => r.name === column);
            resolve(exists);
        });
    });
}

// Crear tablas
(async () => {
    await runSafe(`
        CREATE TABLE IF NOT EXISTS suppliers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            contact_person TEXT,
            email TEXT,
            phone TEXT,
            address TEXT,
            city TEXT,
            country TEXT,
            tax_id TEXT,
            payment_terms TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await runSafe(`
        CREATE TABLE IF NOT EXISTS supplier_products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            supplier_id INTEGER,
            product_name TEXT NOT NULL,
            product_code TEXT,
            description TEXT,
            unit_price DECIMAL(10,2),
            currency TEXT DEFAULT 'CLP',
            unit_of_measure TEXT,
            availability_status TEXT DEFAULT 'available',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
        )
    `);

    await runSafe(`
        CREATE TABLE IF NOT EXISTS purchase_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_number TEXT UNIQUE NOT NULL,
            supplier_id INTEGER,
            order_date DATE,
            delivery_date DATE,
            status TEXT DEFAULT 'pending',
            subtotal DECIMAL(10,2),
            tax_amount DECIMAL(10,2),
            total_amount DECIMAL(10,2),
            currency TEXT DEFAULT 'CLP',
            payment_terms TEXT DEFAULT 'Efectivo',
            notes TEXT,
            billing_address TEXT,
            shipping_address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
        )
    `);

    // Tabla de items de órdenes de compra
    await runSafe(`
        CREATE TABLE IF NOT EXISTS purchase_order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_id INTEGER,
            product_name TEXT NOT NULL,
            product_code TEXT,
            description TEXT,
            quantity DECIMAL(10,3) NOT NULL,
            unit_price DECIMAL(10,2) NOT NULL,
            total_price DECIMAL(10,2) NOT NULL,
            unit_of_measure TEXT DEFAULT 'UN',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES purchase_orders (id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES supplier_products (id)
        )
    `);

    // Nueva tabla: centros de costos
    await runSafe(`
        CREATE TABLE IF NOT EXISTS cost_centers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            owner TEXT,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Campos avanzados para centros de costo (si no existen)
    const advancedCCColumns = [
        { name: 'type', def: "TEXT" },
        { name: 'manager', def: "TEXT" },
        { name: 'email', def: "TEXT" },
        { name: 'department', def: "TEXT" },
        { name: 'currency', def: "TEXT DEFAULT 'CLP'" },
        { name: 'approval_limit', def: "DECIMAL(14,2)" },
        { name: 'requires_approval', def: "INTEGER DEFAULT 0" }
    ];
    for (const col of advancedCCColumns) {
        const exists = await columnExists('cost_centers', col.name);
        if (!exists) {
            await runSafe(`ALTER TABLE cost_centers ADD COLUMN ${col.name} ${col.def}`);
        }
    }

    // Nueva tabla: presupuestos mensuales por centro y moneda
    await runSafe(`
        CREATE TABLE IF NOT EXISTS budgets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cost_center_id INTEGER NOT NULL,
            month TEXT NOT NULL, -- formato YYYY-MM
            currency TEXT NOT NULL DEFAULT 'CLP',
            amount DECIMAL(14,2) NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(cost_center_id, month, currency),
            FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id)
        )
    `);

    // Campos avanzados para presupuestos (si no existen)
    const advancedBudgetColumns = [
        { name: 'category', def: "TEXT" },
        { name: 'description', def: "TEXT" },
        { name: 'priority', def: "TEXT" },
        { name: 'approver', def: "TEXT" },
        { name: 'warning_threshold', def: "INTEGER" },
        { name: 'critical_threshold', def: "INTEGER" },
        { name: 'overspend_limit', def: "INTEGER" },
        { name: 'auto_adjust', def: "INTEGER DEFAULT 0" },
        { name: 'rollover_unused', def: "INTEGER DEFAULT 0" },
        { name: 'require_approval', def: "INTEGER DEFAULT 0" },
        { name: 'email_alerts', def: "INTEGER DEFAULT 0" }
    ];
    for (const col of advancedBudgetColumns) {
        const exists = await columnExists('budgets', col.name);
        if (!exists) {
            await runSafe(`ALTER TABLE budgets ADD COLUMN ${col.name} ${col.def}`);
        }
    }

    // Asegurar columna cost_center_id en purchase_orders
    const hasCC = await columnExists('purchase_orders', 'cost_center_id');
    if (!hasCC) {
        await runSafe(`ALTER TABLE purchase_orders ADD COLUMN cost_center_id INTEGER REFERENCES cost_centers(id)`);
    }

    console.log('Tablas creadas/actualizadas exitosamente.');

    // Datos de ejemplo seguros (insertar sólo si existen)
    db.get(`SELECT COUNT(*) as c FROM cost_centers`, (err, row) => {
        const count = row ? row.c : 0;
        if (count === 0) {
            const sampleCCs = [
                { code: 'CC-ADM', name: 'Administración', description: 'Gastos administrativos', owner: 'Gerencia' },
                { code: 'CC-IT', name: 'Tecnología', description: 'TI y software', owner: 'CTO' },
                { code: 'CC-OP', name: 'Operaciones', description: 'Gastos de operación', owner: 'COO' }
            ];
            const stmt = db.prepare(`INSERT INTO cost_centers (code, name, description, owner) VALUES (?, ?, ?, ?)`);
            sampleCCs.forEach(cc => stmt.run(cc.code, cc.name, cc.description, cc.owner));
            stmt.finalize();
        }
    });

    // Presupuestos de ejemplo para el mes actual
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    db.get(`SELECT COUNT(*) as c FROM budgets WHERE month = ?`, [ym], (err, row) => {
        const count = row ? row.c : 0;
        if (count === 0) {
            const sampleBudgets = [
                { code: 'CC-ADM', currency: 'CLP', amount: 5000000 },
                { code: 'CC-IT', currency: 'USD', amount: 3000 },
                { code: 'CC-OP', currency: 'CLP', amount: 8000000 }
            ];
            db.all(`SELECT id, code FROM cost_centers`, (e, rows) => {
                if (rows) {
                    const map = Object.fromEntries(rows.map(r => [r.code, r.id]));
                    const stmt = db.prepare(`INSERT INTO budgets (cost_center_id, month, currency, amount) VALUES (?, ?, ?, ?)`);
                    sampleBudgets.forEach(b => {
                        if (map[b.code]) stmt.run(map[b.code], ym, b.currency, b.amount);
                    });
                    stmt.finalize();
                }
            });
        }
    });

    console.log('Datos de ejemplo verificados.');

    // Agregar datos de ejemplo más completos
    db.get(`SELECT COUNT(*) as c FROM suppliers`, (err, row) => {
        const count = row ? row.c : 0;
        if (count === 0) {
            const sampleSuppliers = [
                {
                    name: 'TechCorp Solutions',
                    contact_person: 'Juan Pérez',
                    email: 'juan.perez@techcorp.cl',
                    phone: '+56 2 2555 0100',
                    address: 'Av. Providencia 1234',
                    city: 'Santiago',
                    country: 'Chile',
                    tax_id: '96.123.456-7',
                    payment_terms: '30 días'
                },
                {
                    name: 'Oficina Total',
                    contact_person: 'María González',
                    email: 'ventas@oficinatotal.cl',
                    phone: '+56 2 2888 9900',
                    address: 'Las Condes 5678',
                    city: 'Santiago',
                    country: 'Chile',
                    tax_id: '76.234.567-8',
                    payment_terms: '15 días'
                },
                {
                    name: 'Industrial Supply',
                    contact_person: 'Carlos Rodriguez',
                    email: 'carlos@indsupply.cl',
                    phone: '+56 2 2333 4400',
                    address: 'Parque Industrial Norte 100',
                    city: 'Santiago',
                    country: 'Chile',
                    tax_id: '86.345.678-9',
                    payment_terms: '45 días'
                }
            ];
            
            const stmt = db.prepare(`INSERT INTO suppliers (name, contact_person, email, phone, address, city, country, tax_id, payment_terms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            sampleSuppliers.forEach(s => stmt.run(s.name, s.contact_person, s.email, s.phone, s.address, s.city, s.country, s.tax_id, s.payment_terms));
            stmt.finalize();
        }
    });

    // Agregar productos de ejemplo
    db.get(`SELECT COUNT(*) as c FROM supplier_products`, (err, row) => {
        const count = row ? row.c : 0;
        if (count === 0) {
            db.all(`SELECT id FROM suppliers`, (err, suppliers) => {
                if (suppliers && suppliers.length > 0) {
                    const sampleProducts = [
                        { supplier_id: suppliers[0].id, product_name: 'Laptop Dell Inspiron 15', product_code: 'DELL-INS-15', description: 'Laptop para oficina con Windows 11', unit_price: 850000, currency: 'CLP', unit_of_measure: 'UN' },
                        { supplier_id: suppliers[0].id, product_name: 'Monitor Samsung 24"', product_code: 'SAM-MON-24', description: 'Monitor LED 24 pulgadas Full HD', unit_price: 180000, currency: 'CLP', unit_of_measure: 'UN' },
                        { supplier_id: suppliers[1].id, product_name: 'Silla Ejecutiva', product_code: 'SIL-EJEC-001', description: 'Silla ergonómica para ejecutivos', unit_price: 120000, currency: 'CLP', unit_of_measure: 'UN' },
                        { supplier_id: suppliers[1].id, product_name: 'Escritorio Modular', product_code: 'ESC-MOD-120', description: 'Escritorio modular 120x60cm', unit_price: 95000, currency: 'CLP', unit_of_measure: 'UN' },
                        { supplier_id: suppliers[2].id, product_name: 'Kit Herramientas', product_code: 'KIT-HER-001', description: 'Kit básico de herramientas para mantenimiento', unit_price: 45000, currency: 'CLP', unit_of_measure: 'KIT' },
                        { supplier_id: suppliers[2].id, product_name: 'Lubricante Industrial', product_code: 'LUB-IND-5L', description: 'Lubricante sintético para maquinaria', unit_price: 25000, currency: 'CLP', unit_of_measure: 'LT' }
                    ];
                    
                    const stmt = db.prepare(`INSERT INTO supplier_products (supplier_id, product_name, product_code, description, unit_price, currency, unit_of_measure) VALUES (?, ?, ?, ?, ?, ?, ?)`);
                    sampleProducts.forEach(p => stmt.run(p.supplier_id, p.product_name, p.product_code, p.description, p.unit_price, p.currency, p.unit_of_measure));
                    stmt.finalize();
                }
            });
        }
    });

    db.close((err) => {
        if (err) {
            console.error('Error al cerrar la base de datos:', err.message);
        } else {
            console.log('Base de datos inicializada correctamente.');
        }
    });
})();
