const express = require('express');
const router = express.Router();

// Usuario predefinido
const users = {
    'jveliz': {
        password: 'oycserv',
        name: 'José Véliz',
        role: 'admin'
    }
};

// Login
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ 
            success: false, 
            message: 'Usuario y contraseña son requeridos' 
        });
    }
    
    const user = users[username];
    if (!user || user.password !== password) {
        return res.status(401).json({ 
            success: false, 
            message: 'Credenciales inválidas' 
        });
    }
    
    // En producción usarías JWT o sesiones reales
    res.json({ 
        success: true, 
        user: { 
            username: username, 
            name: user.name, 
            role: user.role 
        },
        token: 'simple_auth_token_' + username
    });
});

// Verificar sesión
router.get('/verify', (req, res) => {
    const token = req.headers.authorization;
    
    if (!token || !token.startsWith('Bearer simple_auth_token_')) {
        return res.status(401).json({ success: false, message: 'Token inválido' });
    }
    
    const username = token.replace('Bearer simple_auth_token_', '');
    const user = users[username];
    
    if (!user) {
        return res.status(401).json({ success: false, message: 'Usuario no encontrado' });
    }
    
    res.json({ 
        success: true, 
        user: { 
            username: username, 
            name: user.name, 
            role: user.role 
        } 
    });
});

// Logout
router.post('/logout', (req, res) => {
    res.json({ success: true, message: 'Sesión cerrada correctamente' });
});

module.exports = router;
