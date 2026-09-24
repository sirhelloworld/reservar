const nodemailer = require('nodemailer');

function buildTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
}

function formatMoney(value) {
  const formatted = new Intl.NumberFormat('es-CR', { minimumFractionDigits: 2 }).format(Number(value) || 0);
  return `₡${formatted}`;
}

const PAYMENT_LABELS = { efectivo: 'Efectivo', sinpe: 'Sinpe', tarjeta: 'Tarjeta', transferencia: 'Transferencia' };

function buildDailySummaryHtml(dateStr, reservations) {
  const rowsHtml = reservations
    .map(
      (r) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${r.cabin_name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${r.client_name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${r.client_id_number}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${r.client_phone || '-'}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${r.guests}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${r.company_name || 'Particular'}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${r.check_in.toISOString().slice(0,10)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${r.check_out.toISOString().slice(0,10)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${PAYMENT_LABELS[r.payment_method] || r.payment_method}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${formatMoney(r.total_price)}</td>
        </tr>`
    )
    .join('');

  const totals = { efectivo: 0, sinpe: 0, tarjeta: 0, transferencia: 0 };
  for (const r of reservations) {
    const key = totals[r.payment_method] !== undefined ? r.payment_method : 'efectivo';
    totals[key] += Number(r.total_price) || 0;
  }
  const grandTotal = totals.efectivo + totals.sinpe + totals.tarjeta + totals.transferencia;

  const totalsHtml = reservations.length === 0 ? '' : `
      <div style="padding:0 24px 20px;">
        <table style="border-collapse:collapse;font-size:13px;color:#1e293b;">
          <tr><td style="padding:4px 16px 4px 0;color:#64748b;">Efectivo</td><td style="text-align:right;font-weight:600;">${formatMoney(totals.efectivo)}</td></tr>
          <tr><td style="padding:4px 16px 4px 0;color:#64748b;">Sinpe</td><td style="text-align:right;font-weight:600;">${formatMoney(totals.sinpe)}</td></tr>
          <tr><td style="padding:4px 16px 4px 0;color:#64748b;">Tarjeta</td><td style="text-align:right;font-weight:600;">${formatMoney(totals.tarjeta)}</td></tr>
          <tr><td style="padding:4px 16px 4px 0;color:#64748b;">Transferencia</td><td style="text-align:right;font-weight:600;">${formatMoney(totals.transferencia)}</td></tr>
          <tr><td style="padding:8px 16px 0 0;color:#1e3a5f;font-weight:700;">Total general</td><td style="padding-top:8px;text-align:right;font-weight:700;color:#1e3a5f;">${formatMoney(grandTotal)}</td></tr>
        </table>
      </div>`;

  return `
  <div style="font-family:Segoe UI, Arial, sans-serif; background:#f1f5f9; padding:24px;">
    <div style="max-width:900px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
      <div style="background:#1e3a5f;padding:20px 24px;">
        <h1 style="color:#ffffff;margin:0;font-size:20px;">Resumen diario de reservas</h1>
        <p style="color:#cbd5e1;margin:4px 0 0;font-size:14px;">${dateStr}</p>
      </div>
      <div style="padding:20px 24px;">
        ${
          reservations.length === 0
            ? '<p style="color:#475569;">No hay reservas activas para el dia de hoy.</p>'
            : `<table style="width:100%;border-collapse:collapse;font-size:13px;color:#1e293b;">
                <thead>
                  <tr style="background:#eef2f7;text-align:left;">
                    <th style="padding:8px 12px;">Cabina</th>
                    <th style="padding:8px 12px;">Cliente</th>
                    <th style="padding:8px 12px;">Cedula</th>
                    <th style="padding:8px 12px;">Telefono</th>
                    <th style="padding:8px 12px;text-align:center;">Personas</th>
                    <th style="padding:8px 12px;">Empresa</th>
                    <th style="padding:8px 12px;">Entrada</th>
                    <th style="padding:8px 12px;">Salida</th>
                    <th style="padding:8px 12px;">Pago</th>
                    <th style="padding:8px 12px;text-align:right;">Total</th>
                  </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
              </table>`
        }
      </div>
      ${totalsHtml}
      <div style="background:#f1f5f9;padding:12px 24px;color:#64748b;font-size:12px;">
        Sistema de Reservas de Cabinas - correo generado automaticamente.
      </div>
    </div>
  </div>`;
}

async function sendDailySummaryEmail(dateStr, reservations) {
  const transporter = buildTransport();
  const html = buildDailySummaryHtml(dateStr, reservations);
  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: process.env.MAIL_TO,
    subject: `Reservas del dia ${dateStr} (${reservations.length})`,
    html,
  });
}

module.exports = { sendDailySummaryEmail, buildDailySummaryHtml };
