require('dotenv').config();
const app = require('./app');
const { scheduleDailyEmailJob } = require('./jobs/dailyEmailJob');

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`API de reservas escuchando en el puerto ${PORT}`);
  scheduleDailyEmailJob();
});
