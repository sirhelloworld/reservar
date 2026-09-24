const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);
router.use(requireRole('super_admin'));

const ROLES = ['super_admin', 'operador'];

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, role, created_at FROM admin_users ORDER BY created_at ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

router.post('/', async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Correo y contrasena son requeridos' });
  }
  const finalRole = role || 'operador';
  if (!ROLES.includes(finalRole)) {
    return res.status(400).json({ error: 'El rol debe ser super_admin u operador' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO admin_users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role, created_at',
      [email, hash, finalRole]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al crear el usuario' });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { email, password, role } = req.body;
  if (role && !ROLES.includes(role)) {
    return res.status(400).json({ error: 'El rol debe ser super_admin u operador' });
  }
  try {
    if (role === 'operador') {
      const { rows: superAdmins } = await pool.query(
        "SELECT id FROM admin_users WHERE role = 'super_admin' AND id <> $1",
        [id]
      );
      if (superAdmins.length === 0) {
        return res.status(400).json({ error: 'Debe existir al menos un super admin' });
      }
    }
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;
    const { rows } = await pool.query(
      `UPDATE admin_users SET
         email = COALESCE($1, email),
         role = COALESCE($2, role),
         password_hash = COALESCE($3, password_hash)
       WHERE id = $4 RETURNING id, email, role, created_at`,
      [email, role, passwordHash, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el usuario' });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows: target } = await pool.query('SELECT role FROM admin_users WHERE id = $1', [id]);
    if (!target[0]) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (target[0].role === 'super_admin') {
      const { rows: superAdmins } = await pool.query(
        "SELECT id FROM admin_users WHERE role = 'super_admin' AND id <> $1",
        [id]
      );
      if (superAdmins.length === 0) {
        return res.status(400).json({ error: 'No se puede eliminar el unico super admin' });
      }
    }

    if (String(req.user.id) === String(id)) {
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
    }

    await pool.query('DELETE FROM admin_users WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar el usuario' });
  }
});

module.exports = router;
