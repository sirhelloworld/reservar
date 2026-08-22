const cron = require('node-cron');
const pool = require('../config/db');
const { sendDailySummaryEmail } = require('../services/emailService');

async function getTodayReservations() {
  const { rows } = await pool.query(
    `SELECT r.*, c.name AS cabin_name, co.name AS company_name
     FROM reservations r
     JOIN cabins c ON c.id = r.cabin_id
     LEFT JOIN companies co ON co.id = r.company_id
     WHERE r.status = 'confirmed'
       AND CURRENT_DATE >= r.check_in
       AND CURRENT_DATE < r.check_out
     ORDER BY c.name ASC`
  );
  return rows;
}

async function runDailySummary() {
  const dateStr = new Date().toISOString().slice(0, 10);
  try {
    const reservations = await getTodayReservations();
    await sendDailySummaryEmail(dateStr, reservations);
    console.log(`[dailyEmailJob] Correo de resumen enviado (${dateStr}), ${reservations.length} reservas.`);
  } catch (err) {
    console.error('[dailyEmailJob] Error enviando el resumen diario:', err);
  }
}

function scheduleDailyEmailJob() {
  const cronExpr = process.env.DAILY_EMAIL_CRON || '0 7 * * *';
  const timezone = process.env.TIMEZONE || 'America/Costa_Rica';
  cron.schedule(cronExpr, runDailySummary, { timezone });
  console.log(`[dailyEmailJob] Programado con expresion "${cronExpr}" (tz: ${timezone}).`);
}

module.exports = { scheduleDailyEmailJob, runDailySummary };
