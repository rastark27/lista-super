const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const dbConfig = {
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT || 3306
};

const pool = mysql.createPool(dbConfig);

// Obtener todos los productos
app.get('/api/productos', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM productos ORDER BY id DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Agregar un producto
app.post('/api/productos', async (req, res) => {
    const { nombre, cantidad, precio } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO productos (nombre, cantidad, precio) VALUES (?, ?, ?)',
            [nombre, cantidad || 1, precio || 0]
        );
        res.status(201).json({ id: result.insertId, nombre, cantidad, precio });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Eliminar un producto
app.delete('/api/productos/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM productos WHERE id = ?', [req.params.id]);
        res.sendStatus(204);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});