const express = require('express');
const pool = require('../config/db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

const SELECT_BASE = `
  SELECT r.*, c.name AS cabin_name, co.name AS company_name
  FROM reservations r
  JOIN cabins c ON c.id = r.cabin_id
  LEFT JOIN companies co ON co.id = r.company_id
`;

router.get('/', async (req, res) => {
  const { from, to, status, cabin_id, company_id } = req.query;
  const conditions = [];
  const params = [];
  if (from) {
    params.push(from);
    conditions.push(`r.check_out > $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`r.check_in < $${params.length}::date + 1`);
  }
  if (status) {
    params.push(status);
    conditions.push(`r.status = $${params.length}`);
  }
  if (cabin_id) {
    params.push(cabin_id);
    conditions.push(`r.cabin_id = $${params.length}`);
  }
  if (company_id) {
    params.push(company_id);
    conditions.push(`r.company_id = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  try {
    const { rows } = await pool.query(
      `${SELECT_BASE} ${where} ORDER BY r.check_in DESC, r.id DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener reservas' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`${SELECT_BASE} WHERE r.id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Reserva no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener la reserva' });
  }
});

// Marca la reserva como check-out realizado: libera la cabina y la deja pendiente de limpieza.
router.post('/:id/checkout', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE reservations SET checked_out_at = now(), housekeeping_status = 'necesita_limpieza'
       WHERE id = $1 AND status = 'confirmed' AND checked_out_at IS NULL
       RETURNING *`,
      [req.params.id]
    );
    if (!rows[0]) {
      return res.status(404).json({ error: 'Reserva no encontrada o ya tiene checkout registrado' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar el checkout' });
  }
});

const PAYMENT_METHODS = ['efectivo', 'sinpe', 'tarjeta', 'transferencia'];
const HOUSEKEEPING_STATUSES = ['lista', 'necesita_limpieza'];
const PRICE_TYPES = ['normal', 'empresarial'];

async function getCabinCapacity(cabinId) {
  const { rows } = await pool.query('SELECT capacity FROM cabins WHERE id = $1', [cabinId]);
  return rows[0] ? rows[0].capacity : null;
}

router.post('/', async (req, res) => {
  const {
    cabin_id,
    company_id,
    client_name,
    client_id_number,
    client_email,
    client_phone,
    guests,
    check_in,
    check_out,
    total_price,
    price_type,
    payment_method,
    housekeeping_status,
    notes,
  } = req.body;

  if (!cabin_id || !client_name || !client_id_number || !check_in || !check_out) {
    return res.status(400).json({
      error: 'cabin_id, client_name, client_id_number, check_in y check_out son requeridos',
    });
  }

  const guestsCount = guests || 1;
  const paymentMethod = payment_method || 'efectivo';
  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    return res.status(400).json({ error: 'El metodo de pago debe ser efectivo, sinpe, tarjeta o transferencia' });
  }
  const housekeepingStatus = housekeeping_status || 'necesita_limpieza';
  if (!HOUSEKEEPING_STATUSES.includes(housekeepingStatus)) {
    return res.status(400).json({ error: 'El estado de limpieza debe ser lista o necesita_limpieza' });
  }
  const priceType = price_type || 'normal';
  if (!PRICE_TYPES.includes(priceType)) {
    return res.status(400).json({ error: 'El tipo de tarifa debe ser normal o empresarial' });
  }

  try {
    const capacity = await getCabinCapacity(cabin_id);
    if (capacity === null) {
      return res.status(404).json({ error: 'Cabina no encontrada' });
    }
    if (guestsCount > capacity) {
      return res.status(400).json({
        error: `La cantidad de personas (${guestsCount}) excede la capacidad de la cabina (${capacity})`,
      });
    }

    const { rows } = await pool.query(
      `INSERT INTO reservations
        (cabin_id, company_id, client_name, client_id_number, client_email, client_phone,
         guests, check_in, check_out, total_price, price_type, payment_method, housekeeping_status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [
        cabin_id,
        company_id || null,
        client_name,
        client_id_number,
        client_email || null,
        client_phone || null,
        guestsCount,
        check_in,
        check_out,
        total_price || 0,
        priceType,
        paymentMethod,
        housekeepingStatus,
        notes || null,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.message && err.message.includes('se solapa')) {
      return res.status(409).json({ error: err.message });
    }
    if (err.code === '23514') {
      return res.status(400).json({ error: 'La fecha de salida debe ser posterior a la de entrada' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al crear la reserva' });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    cabin_id,
    company_id,
    client_name,
    client_id_number,
    client_email,
    client_phone,
    guests,
    check_in,
    check_out,
    total_price,
    price_type,
    payment_method,
    housekeeping_status,
    notes,
    status,
  } = req.body;

  if (payment_method && !PAYMENT_METHODS.includes(payment_method)) {
    return res.status(400).json({ error: 'El metodo de pago debe ser efectivo, sinpe, tarjeta o transferencia' });
  }
  if (housekeeping_status && !HOUSEKEEPING_STATUSES.includes(housekeeping_status)) {
    return res.status(400).json({ error: 'El estado de limpieza debe ser lista o necesita_limpieza' });
  }
  if (price_type && !PRICE_TYPES.includes(price_type)) {
    return res.status(400).json({ error: 'El tipo de tarifa debe ser normal o empresarial' });
  }

  try {
    const { rows: current } = await pool.query('SELECT cabin_id, guests FROM reservations WHERE id = $1', [id]);
    if (!current[0]) return res.status(404).json({ error: 'Reserva no encontrada' });

    // La cabina/cabana asignada es inmutable una vez creada la reserva: evita moverla por error
    // o por una llamada directa a la API que se salte el bloqueo de la interfaz.
    if (cabin_id && String(cabin_id) !== String(current[0].cabin_id)) {
      return res.status(400).json({
        error: 'No se puede cambiar la cabina/cabana de una reserva ya creada. Cancela esta reserva y crea una nueva si necesitas moverla.',
      });
    }

    const finalCabinId = cabin_id || current[0].cabin_id;
    const finalGuests = guests || current[0].guests;
    const capacity = await getCabinCapacity(finalCabinId);
    if (capacity === null) {
      return res.status(404).json({ error: 'Cabina no encontrada' });
    }
    if (finalGuests > capacity) {
      return res.status(400).json({
        error: `La cantidad de personas (${finalGuests}) excede la capacidad de la cabina (${capacity})`,
      });
    }

    const companyIdProvided = Object.prototype.hasOwnProperty.call(req.body, 'company_id');

    const { rows } = await pool.query(
      `UPDATE reservations SET
         cabin_id = COALESCE($1, cabin_id),
         company_id = CASE WHEN $2 THEN $3 ELSE company_id END,
         client_name = COALESCE($4, client_name),
         client_id_number = COALESCE($5, client_id_number),
         client_email = COALESCE($6, client_email),
         client_phone = COALESCE($7, client_phone),
         guests = COALESCE($8, guests),
         check_in = COALESCE($9, check_in),
         check_out = COALESCE($10, check_out),
         total_price = COALESCE($11, total_price),
         price_type = COALESCE($12, price_type),
         payment_method = COALESCE($13, payment_method),
         housekeeping_status = COALESCE($14, housekeeping_status),
         notes = COALESCE($15, notes),
         status = COALESCE($16, status)
       WHERE id = $17 RETURNING *`,
      [
        cabin_id,
        companyIdProvided,
        company_id || null,
        client_name,
        client_id_number,
        client_email,
        client_phone,
        guests,
        check_in,
        check_out,
        total_price,
        price_type,
        payment_method,
        housekeeping_status,
        notes,
        status,
        id,
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Reserva no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    if (err.message && err.message.includes('se solapa')) {
      return res.status(409).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar la reserva' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM reservations WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Reserva no encontrada' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar la reserva' });
  }
});

module.exports = router;
