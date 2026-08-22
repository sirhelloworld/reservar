const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('Migracion completada: esquema creado/actualizado.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Error ejecutando la migracion:', err);
  process.exit(1);
});
