const express = require('express');
const { runDailySummary } = require('../jobs/dailyEmailJob');

const router = express.Router();

// Endpoint invocado por Vercel Cron (ver vercel.json). Vercel envia
// "Authorization: Bearer <CRON_SECRET>" cuando la variable esta definida.
router.get('/daily-summary', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  await runDailySummary();
  res.json({ ok: true });
});

module.exports = router;
