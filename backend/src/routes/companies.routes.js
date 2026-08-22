const express = require('express');
const pool = require('../config/db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM companies ORDER BY name ASC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener empresas' });
  }
});

router.post('/', async (req, res) => {
  const { name, tax_id, contact_name, contact_email, contact_phone, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre de la empresa es requerido' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO companies (name, tax_id, contact_name, contact_email, contact_phone, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, tax_id || null, contact_name || null, contact_email || null, contact_phone || null, notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear la empresa' });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, tax_id, contact_name, contact_email, contact_phone, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE companies SET
         name = COALESCE($1, name),
         tax_id = COALESCE($2, tax_id),
         contact_name = COALESCE($3, contact_name),
         contact_email = COALESCE($4, contact_email),
         contact_phone = COALESCE($5, contact_phone),
         notes = COALESCE($6, notes)
       WHERE id = $7 RETURNING *`,
      [name, tax_id, contact_name, contact_email, contact_phone, notes, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Empresa no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar la empresa' });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM companies WHERE id = $1', [id]);
    if (!rowCount) return res.status(404).json({ error: 'Empresa no encontrada' });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({ error: 'No se puede eliminar: tiene reservas asociadas' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar la empresa' });
  }
});

module.exports = router;
