const express = require('express');
const { authRequired } = require('../middleware/auth');
const { runDailySummary } = require('../jobs/dailyEmailJob');

const router = express.Router();
router.use(authRequired);

// Permite disparar manualmente el correo de resumen diario (util para pruebas).
router.post('/send-daily-summary', async (req, res) => {
  try {
    await runDailySummary();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al enviar el resumen diario' });
  }
});

module.exports = router;
