const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Base de datos
const db = new sqlite3.Database('./database/buytrack.db', (err) => {
    if (err) {
        console.error('Error al conectar con la base de datos:', err.message);
    } else {
        console.log('Conectado a la base de datos SQLite.');
    }
});

// Rutas de API
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const suppliersRoutes = require('./routes/suppliers');
const ordersRoutes = require('./routes/orders');
const pdfRoutes = require('./routes/pdf');
const costCentersRoutes = require('./routes/cost_centers');
const budgetsRoutes = require('./routes/budgets');

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/cost-centers', costCentersRoutes);
app.use('/api/budgets', budgetsRoutes);

// Ruta principal (hub de módulos)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rutas de páginas
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/suppliers', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'suppliers.html'));
});

app.get('/orders', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'orders.html'));
});

app.get('/control-panel', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'control-panel.html'));
});

app.get('/budgets', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'budgets.html'));
});

app.get('/cost-centers', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'cost-centers.html'));
});

// Rutas para módulos avanzados
app.get('/cost-centers-advanced', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'cost-centers-advanced.html'));
});

app.get('/budgets-advanced', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'budgets-advanced.html'));
});

// Middleware para el manejo de la base de datos
app.use((req, res, next) => {
    req.db = db;
    next();
});

// Manejo de errores
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Algo salió mal!');
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});

// Cerrar conexión de base de datos al salir
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Conexión de base de datos cerrada.');
        process.exit(0);
    });
});
