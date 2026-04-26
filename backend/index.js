const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
require('dotenv').config();

const {
    PORT = 3000,
    NODE_ENV = 'development',
    API_KEY,
    ALLOWED_ORIGINS = '',
    MYSQLHOST,
    MYSQLUSER,
    MYSQLPASSWORD,
    MYSQLDATABASE,
    MYSQLPORT = 3306,
} = process.env;

if (!API_KEY || API_KEY.length < 16) {
    console.error('FATAL: API_KEY no configurada o muy corta (mínimo 16 caracteres).');
    process.exit(1);
}
if (!MYSQLHOST || !MYSQLUSER || !MYSQLDATABASE) {
    console.error('FATAL: Credenciales de MySQL incompletas.');
    process.exit(1);
}

const app = express();

// Trust proxy: imprescindible en Render para que el rate limit lea la IP real
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Headers de seguridad estándar
app.use(helmet());

// CORS restringido. En dev permitimos también requests sin Origin (Postman/curl).
const allowedOrigins = ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
app.use(
    cors({
        origin: (origin, cb) => {
            if (!origin) return cb(null, true);
            if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
                return cb(null, true);
            }
            return cb(new Error('Origin no permitido por CORS'));
        },
        methods: ['GET', 'POST', 'DELETE'],
        allowedHeaders: ['Content-Type', 'X-API-Key'],
        maxAge: 86400,
    }),
);

// Limita el tamaño del body para evitar payloads enormes
app.use(express.json({ limit: '10kb' }));

// Rate limit global
app.use(
    rateLimit({
        windowMs: 60 * 1000,
        max: 100,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Demasiadas peticiones, esperá un momento.' },
    }),
);

// Log mínimo (sin headers ni body)
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
});

// Comparación constante para evitar timing attacks sobre la API key
function safeEqual(a, b) {
    const ba = Buffer.from(a || '');
    const bb = Buffer.from(b || '');
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
}

function requireApiKey(req, res, next) {
    const provided = req.get('X-API-Key');
    if (!provided || !safeEqual(provided, API_KEY)) {
        return res.status(401).json({ error: 'No autorizado' });
    }
    next();
}

// Health check público
app.get('/', (req, res) => {
    res.send('OK');
});

// Pool MySQL
const pool = mysql.createPool({
    host: MYSQLHOST,
    user: MYSQLUSER,
    password: MYSQLPASSWORD,
    database: MYSQLDATABASE,
    port: Number(MYSQLPORT),
    waitForConnections: true,
    connectionLimit: 10,
    ssl: { rejectUnauthorized: false },
    connectTimeout: 10000,
});

// Validación de input
function validarProducto(body) {
    const errores = [];
    const nombre = typeof body?.nombre === 'string' ? body.nombre.trim() : '';
    if (!nombre) errores.push('nombre es requerido');
    if (nombre.length > 200) errores.push('nombre demasiado largo (máx 200)');

    const cantidad = body?.cantidad === undefined || body?.cantidad === '' ? 1 : Number(body.cantidad);
    if (!Number.isFinite(cantidad) || cantidad < 1 || cantidad > 100000) {
        errores.push('cantidad inválida (1-100000)');
    }

    const precio = body?.precio === undefined || body?.precio === '' ? 0 : Number(body.precio);
    if (!Number.isFinite(precio) || precio < 0 || precio > 100000000) {
        errores.push('precio inválido (0-100000000)');
    }

    return { errores, nombre, cantidad: Math.floor(cantidad), precio };
}

// Todos los endpoints /api requieren API key
app.use('/api', requireApiKey);

app.get('/api/productos', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, nombre, cantidad, precio, created_at FROM productos ORDER BY id DESC LIMIT 1000',
        );
        res.json(rows);
    } catch (err) {
        console.error('GET /api/productos error:', err.code || err.message);
        res.status(500).json({ error: 'Error interno' });
    }
});

app.post('/api/productos', async (req, res) => {
    const { errores, nombre, cantidad, precio } = validarProducto(req.body);
    if (errores.length) return res.status(400).json({ error: errores.join(', ') });

    try {
        const [result] = await pool.query(
            'INSERT INTO productos (nombre, cantidad, precio) VALUES (?, ?, ?)',
            [nombre, cantidad, precio],
        );
        res.status(201).json({ id: result.insertId, nombre, cantidad, precio });
    } catch (err) {
        console.error('POST /api/productos error:', err.code || err.message);
        res.status(500).json({ error: 'Error interno' });
    }
});

app.delete('/api/productos/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ error: 'id inválido' });
    }
    try {
        const [result] = await pool.query('DELETE FROM productos WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'No encontrado' });
        }
        res.sendStatus(204);
    } catch (err) {
        console.error('DELETE /api/productos error:', err.code || err.message);
        res.status(500).json({ error: 'Error interno' });
    }
});

// 404 genérico
app.use((req, res) => res.status(404).json({ error: 'No encontrado' }));

// Handler de errores final (no filtra stacks)
app.use((err, req, res, _next) => {
    console.error('Error:', err.message);
    if (err.message?.startsWith('Origin no permitido')) {
        return res.status(403).json({ error: 'Origen no permitido' });
    }
    res.status(500).json({ error: 'Error interno' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor escuchando en puerto ${PORT} (${NODE_ENV})`);
});
