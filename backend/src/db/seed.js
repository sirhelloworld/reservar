require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const DEFAULT_CABINS = Number(process.env.DEFAULT_CABINS) || 28;

async function seedCabins() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM cabins');
  if (rows[0].count > 0) {
    console.log(`Ya existen ${rows[0].count} cabinas, no se crean cabinas por defecto.`);
    return;
  }
  for (let i = 1; i <= DEFAULT_CABINS; i += 1) {
    const name = `Cabina ${String(i).padStart(2, '0')}`;
    await pool.query(
      `INSERT INTO cabins (name, description, capacity, price_per_night, active)
       VALUES ($1, $2, $3, $4, true)`,
      [name, '', 2, 0]
    );
  }
  console.log(`Se crearon ${DEFAULT_CABINS} cabinas por defecto.`);
}

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.log('ADMIN_EMAIL/ADMIN_PASSWORD no definidos, se omite creacion de usuario admin.');
    return;
  }
  const { rows } = await pool.query('SELECT id FROM admin_users WHERE email = $1', [email]);
  if (rows.length > 0) {
    console.log('El usuario admin ya existe.');
    return;
  }
  const hash = await bcrypt.hash(password, 10);
  await pool.query('INSERT INTO admin_users (email, password_hash) VALUES ($1, $2)', [email, hash]);
  console.log(`Usuario admin creado: ${email}`);
}

async function seed() {
  await seedCabins();
  await seedAdmin();
  await pool.end();
}

seed().catch((err) => {
  console.error('Error ejecutando el seed:', err);
  process.exit(1);
});
