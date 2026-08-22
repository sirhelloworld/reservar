const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const cabinsRoutes = require('./routes/cabins.routes');
const companiesRoutes = require('./routes/companies.routes');
const reservationsRoutes = require('./routes/reservations.routes');
const biRoutes = require('./routes/bi.routes');
const systemRoutes = require('./routes/system.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/cabins', cabinsRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/reservations', reservationsRoutes);
app.use('/api/bi', biRoutes);
app.use('/api/system', systemRoutes);

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

module.exports = app;
