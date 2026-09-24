const express = require('express');
const pool = require('../config/db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

const UNIT_TYPES = ['cabina', 'cabana'];

// Lista todas las cabinas/cabanas con su estado (ocupada/disponible) en una fecha dada (por defecto hoy).
// Puede filtrarse por unit_type=cabina|cabana.
router.get('/', async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const { unit_type } = req.query;
  try {
    const params = [date];
    let unitTypeClause = '';
    if (unit_type && UNIT_TYPES.includes(unit_type)) {
      params.push(unit_type);
      unitTypeClause = `WHERE c.unit_type = $${params.length}`;
    }
    const { rows } = await pool.query(
      `SELECT c.*,
              r.id AS active_reservation_id,
              r.client_name AS active_client_name,
              r.guests AS active_guests,
              r.total_price AS active_total_price,
              r.check_in AS active_check_in,
              r.check_out AS active_check_out,
              r.housekeeping_status AS active_housekeeping_status,
              lastres.id AS last_reservation_id,
              lastres.housekeeping_status AS last_housekeeping_status,
              nextres.id AS next_reservation_id,
              nextres.client_name AS next_client_name,
              nextres.check_in AS next_check_in
       FROM cabins c
       LEFT JOIN reservations r
         ON r.cabin_id = c.id
        AND r.status = 'confirmed'
        AND r.checked_out_at IS NULL
        AND $1::date >= r.check_in
        AND $1::date < r.check_out
       LEFT JOIN LATERAL (
         SELECT r2.id, r2.housekeeping_status
         FROM reservations r2
         WHERE r2.cabin_id = c.id
           AND r2.status = 'confirmed'
           AND r2.checked_out_at IS NOT NULL
         ORDER BY r2.checked_out_at DESC
         LIMIT 1
       ) lastres ON true
       LEFT JOIN LATERAL (
         SELECT r3.id, r3.client_name, r3.check_in
         FROM reservations r3
         WHERE r3.cabin_id = c.id
           AND r3.status = 'confirmed'
           AND r3.checked_out_at IS NULL
           AND r3.check_in > $1::date
         ORDER BY r3.check_in ASC
         LIMIT 1
       ) nextres ON true
       ${unitTypeClause}
       ORDER BY c.name ASC`,
      params
    );
    const data = rows.map((c) => {
      let status = 'available';
      if (c.active_reservation_id) {
        status = c.active_housekeeping_status === 'necesita_limpieza' ? 'occupied_needs_cleaning' : 'occupied';
      } else if (c.last_housekeeping_status === 'necesita_limpieza') {
        status = 'needs_cleaning';
      } else if (c.next_reservation_id) {
        status = 'reserved';
      }
      return { ...c, status };
    });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener cabinas' });
  }
});

// Disponibilidad de todas las cabinas para un rango de fechas (check_in/check_out),
// util para saber cuales cabinas NO tienen espacio antes de crear una reserva.
router.get('/availability', async (req, res) => {
  const { from, to, exclude_reservation_id, unit_type } = req.query;
  if (!from || !to) {
    return res.status(400).json({ error: 'from y to son requeridos (YYYY-MM-DD)' });
  }
  try {
    const params = [from, to];
    let excludeClause = '';
    if (exclude_reservation_id) {
      params.push(exclude_reservation_id);
      excludeClause = `AND r.id <> $${params.length}`;
    }
    let unitTypeClause = '';
    if (unit_type && UNIT_TYPES.includes(unit_type)) {
      params.push(unit_type);
      unitTypeClause = `AND c.unit_type = $${params.length}`;
    }
    const { rows } = await pool.query(
      `SELECT c.*,
              EXISTS (
                SELECT 1 FROM reservations r
                WHERE r.cabin_id = c.id
                  AND r.status = 'confirmed'
                  AND r.checked_out_at IS NULL
                  ${excludeClause}
                  AND $1::date < r.check_out
                  AND $2::date > r.check_in
              ) AS occupied
       FROM cabins c
       WHERE c.active = true
       ${unitTypeClause}
       ORDER BY c.name ASC`,
      params
    );
    const data = rows.map((c) => ({ ...c, status: c.occupied ? 'occupied' : 'available' }));
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al calcular disponibilidad' });
  }
});

router.post('/', async (req, res) => {
  const { name, description, capacity, price_per_night, price_per_night_company, unit_type } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre es requerido' });
  const unitType = unit_type || 'cabina';
  if (!UNIT_TYPES.includes(unitType)) {
    return res.status(400).json({ error: 'El tipo de unidad debe ser cabina o cabana' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO cabins (name, description, capacity, price_per_night, price_per_night_company, unit_type)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, description || '', capacity || 2, price_per_night || 0, price_per_night_company || 0, unitType]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una cabina con ese nombre' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al crear la cabina' });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, capacity, price_per_night, price_per_night_company, unit_type, active } = req.body;
  if (unit_type && !UNIT_TYPES.includes(unit_type)) {
    return res.status(400).json({ error: 'El tipo de unidad debe ser cabina o cabana' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE cabins SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         capacity = COALESCE($3, capacity),
         price_per_night = COALESCE($4, price_per_night),
         price_per_night_company = COALESCE($5, price_per_night_company),
         unit_type = COALESCE($6, unit_type),
         active = COALESCE($7, active)
       WHERE id = $8 RETURNING *`,
      [name, description, capacity, price_per_night, price_per_night_company, unit_type, active, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Cabina no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar la cabina' });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows: reservas } = await pool.query(
      'SELECT id FROM reservations WHERE cabin_id = $1 LIMIT 1',
      [id]
    );
    if (reservas.length > 0) {
      // Si tiene historial de reservas, no se elimina fisicamente: se desactiva.
      const { rows } = await pool.query(
        'UPDATE cabins SET active = false WHERE id = $1 RETURNING *',
        [id]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Cabina no encontrada' });
      return res.json({ ...rows[0], softDeleted: true });
    }
    const { rowCount } = await pool.query('DELETE FROM cabins WHERE id = $1', [id]);
    if (!rowCount) return res.status(404).json({ error: 'Cabina no encontrada' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar la cabina' });
  }
});

module.exports = router;
