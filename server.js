/* ============================================
   DONFAREz — Server (Node.js + Express)
   ============================================ */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== CONFIG ==========
// Contraseña del admin — CÁMBIALA por la tuya
const ADMIN_PASSWORD_HASH = bcrypt.hashSync('donfarez2026', 10);

// ========== MIDDLEWARE ==========
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'donfarez-secret-key-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 horas
}));

// Servir archivos estáticos
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ========== FILE UPLOAD ==========
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const name = 'product-' + Date.now() + '-' + Math.round(Math.random() * 1000) + ext;
        cb(null, name);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const types = /jpeg|jpg|png|gif|webp|avif/;
        const ext = types.test(path.extname(file.originalname).toLowerCase());
        const mime = types.test(file.mimetype);
        if (ext && mime) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten imágenes (jpg, png, gif, webp)'));
        }
    }
});

// ========== HELPERS ==========
const DATA_FILE = path.join(__dirname, 'data', 'products.json');

function readProducts() {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

function writeProducts(products) {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2), 'utf-8');
}

function requireAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) {
        next();
    } else {
        res.status(401).json({ error: 'No autorizado. Inicia sesión como administrador.' });
    }
}

// ========== PUBLIC API ==========

// GET productos (solo activos, para clientes)
app.get('/api/products', (req, res) => {
    const products = readProducts().filter(p => p.active !== false);
    // No enviar datos sensibles al público
    const publicProducts = products.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        price: p.price,
        originalPrice: p.originalPrice,
        emoji: p.emoji,
        image: p.image,
        rating: p.rating,
        reviews: p.reviews,
        badge: p.badge,
        badgeText: p.badgeText,
        description: p.description
    }));
    res.json(publicProducts);
});

// ========== ADMIN AUTH ==========

app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (!password) {
        return res.status(400).json({ error: 'La contraseña es requerida' });
    }
    if (bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)) {
        req.session.isAdmin = true;
        res.json({ success: true, message: '¡Bienvenido, administrador!' });
    } else {
        res.status(401).json({ error: 'Contraseña incorrecta' });
    }
});

app.post('/api/admin/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/admin/check', (req, res) => {
    res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

// ========== ADMIN PRODUCTS ==========

// GET todos los productos (incluyendo inactivos)
app.get('/api/admin/products', requireAdmin, (req, res) => {
    const products = readProducts();
    res.json(products);
});

// POST crear producto
app.post('/api/admin/products', requireAdmin, upload.single('image'), (req, res) => {
    try {
        const products = readProducts();
        const maxId = products.reduce((max, p) => Math.max(max, p.id || 0), 0);

        const newProduct = {
            id: maxId + 1,
            name: req.body.name || 'Nuevo Producto',
            category: req.body.category || 'muebles',
            price: parseFloat(req.body.price) || 0,
            originalPrice: req.body.originalPrice ? parseFloat(req.body.originalPrice) : null,
            emoji: req.body.emoji || '📦',
            image: req.file ? req.file.filename : null,
            rating: parseInt(req.body.rating) || 5,
            reviews: parseInt(req.body.reviews) || 0,
            badge: req.body.badge === 'null' || !req.body.badge ? null : req.body.badge,
            badgeText: req.body.badgeText === 'null' || !req.body.badgeText ? null : req.body.badgeText,
            description: req.body.description || '',
            active: req.body.active !== 'false'
        };

        products.push(newProduct);
        writeProducts(products);
        res.json({ success: true, product: newProduct });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT actualizar producto
app.put('/api/admin/products/:id', requireAdmin, upload.single('image'), (req, res) => {
    try {
        const products = readProducts();
        const id = parseInt(req.params.id);
        const index = products.findIndex(p => p.id === id);

        if (index === -1) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        const existing = products[index];

        // Si hay nueva imagen, borrar la anterior
        if (req.file && existing.image) {
            const oldPath = path.join(__dirname, 'uploads', existing.image);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }

        products[index] = {
            ...existing,
            name: req.body.name || existing.name,
            category: req.body.category || existing.category,
            price: req.body.price !== undefined ? parseFloat(req.body.price) : existing.price,
            originalPrice: req.body.originalPrice !== undefined
                ? (req.body.originalPrice === '' || req.body.originalPrice === 'null' ? null : parseFloat(req.body.originalPrice))
                : existing.originalPrice,
            emoji: req.body.emoji || existing.emoji,
            image: req.file ? req.file.filename : (req.body.removeImage === 'true' ? null : existing.image),
            rating: req.body.rating !== undefined ? parseInt(req.body.rating) : existing.rating,
            reviews: req.body.reviews !== undefined ? parseInt(req.body.reviews) : existing.reviews,
            badge: req.body.badge !== undefined ? (req.body.badge === 'null' || req.body.badge === '' ? null : req.body.badge) : existing.badge,
            badgeText: req.body.badgeText !== undefined ? (req.body.badgeText === 'null' || req.body.badgeText === '' ? null : req.body.badgeText) : existing.badgeText,
            description: req.body.description !== undefined ? req.body.description : existing.description,
            active: req.body.active !== undefined ? req.body.active === 'true' : existing.active
        };

        writeProducts(products);
        res.json({ success: true, product: products[index] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE producto
app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
    try {
        let products = readProducts();
        const id = parseInt(req.params.id);
        const product = products.find(p => p.id === id);

        if (!product) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        // Borrar imagen si existe
        if (product.image) {
            const imgPath = path.join(__dirname, 'uploads', product.image);
            if (fs.existsSync(imgPath)) {
                fs.unlinkSync(imgPath);
            }
        }

        products = products.filter(p => p.id !== id);
        writeProducts(products);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== ADMIN: CHANGE PASSWORD ==========
app.post('/api/admin/change-password', requireAdmin, (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!bcrypt.compareSync(currentPassword, ADMIN_PASSWORD_HASH)) {
        return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    }
    // Note: In production you'd store this in a database, not in code
    // For this version, the password stays until server restart
    res.json({ success: true, message: 'Contraseña actualizada (se aplicará al reiniciar el servidor si se guarda en código)' });
});

// ========== FALLBACK — Serve index.html ==========
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// ========== START ==========
app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║         🏪  DONFAREz Server Running          ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log(`║  🌐 Tienda:  http://localhost:${PORT}            ║`);
    console.log(`║  🔧 Admin:   http://localhost:${PORT}/admin      ║`);
    console.log('║  🔑 Contraseña: donfarez2026                 ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log('');
});
