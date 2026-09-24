const express = require('express');
const PDFDocument = require('pdfkit');
const pool = require('../config/db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);
router.use(requireRole('super_admin'));

const UNIT_TYPES = ['cabina', 'cabana'];
const PAYMENT_METHODS = ['efectivo', 'sinpe', 'tarjeta', 'transferencia'];

// Serie temporal de reservas/ingresos agrupada por dia, semana o mes dentro de un rango de fechas.
// Puede filtrarse por unit_type=cabina|cabana y/o payment_method; sin filtro, muestra el global.
router.get('/timeseries', async (req, res) => {
  const { from, to, groupBy = 'day', unit_type, payment_method } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from y to son requeridos (YYYY-MM-DD)' });

  const bucket = { day: 'day', week: 'week', month: 'month' }[groupBy] || 'day';
  const params = [from, to, bucket];
  let unitTypeClause = '';
  if (unit_type && UNIT_TYPES.includes(unit_type)) {
    params.push(unit_type);
    unitTypeClause = `AND c.unit_type = $${params.length}`;
  }
  let paymentClause = '';
  if (payment_method && PAYMENT_METHODS.includes(payment_method)) {
    params.push(payment_method);
    paymentClause = `AND r.payment_method = $${params.length}`;
  }

  try {
    const { rows } = await pool.query(
      `SELECT date_trunc($3, r.check_in) AS period,
              COUNT(*)::int AS reservations,
              SUM(r.nights)::int AS total_nights,
              SUM(r.total_price)::numeric AS revenue
       FROM reservations r
       JOIN cabins c ON c.id = r.cabin_id
       WHERE r.status = 'confirmed'
         AND r.check_in >= $1::date
         AND r.check_in <= $2::date
         ${unitTypeClause}
         ${paymentClause}
       GROUP BY period
       ORDER BY period ASC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar la serie temporal' });
  }
});

// Resumen general del rango: ocupacion, ingresos totales, top cabinas y top empresas.
// Puede filtrarse por unit_type=cabina|cabana; sin filtro, muestra el global (cabinas y cabanas).
router.get('/summary', async (req, res) => {
  const { from, to, unit_type, payment_method } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from y to son requeridos (YYYY-MM-DD)' });

  const filterByType = unit_type && UNIT_TYPES.includes(unit_type);
  const filterByPayment = payment_method && PAYMENT_METHODS.includes(payment_method);

  try {
    const totalsParams = [from, to];
    let totalsUnitClause = '';
    if (filterByType) {
      totalsParams.push(unit_type);
      totalsUnitClause = `AND c.unit_type = $${totalsParams.length}`;
    }
    if (filterByPayment) {
      totalsParams.push(payment_method);
      totalsUnitClause += ` AND r.payment_method = $${totalsParams.length}`;
    }
    const totals = await pool.query(
      `SELECT COUNT(*)::int AS reservations,
              COALESCE(SUM(r.nights),0)::int AS total_nights,
              COALESCE(SUM(r.total_price),0)::numeric AS revenue,
              COALESCE(AVG(r.nights),0)::numeric AS avg_nights
       FROM reservations r
       JOIN cabins c ON c.id = r.cabin_id
       WHERE r.status = 'confirmed' AND r.check_in >= $1::date AND r.check_in <= $2::date
       ${totalsUnitClause}`,
      totalsParams
    );

    const byCabinParams = [from, to];
    let byCabinUnitClause = '';
    if (filterByType) {
      byCabinParams.push(unit_type);
      byCabinUnitClause = `AND c.unit_type = $${byCabinParams.length}`;
    }
    if (filterByPayment) {
      byCabinParams.push(payment_method);
      byCabinUnitClause += ` AND r.payment_method = $${byCabinParams.length}`;
    }
    const byCabin = await pool.query(
      `SELECT c.name, COUNT(*)::int AS reservations, COALESCE(SUM(r.total_price),0)::numeric AS revenue
       FROM reservations r JOIN cabins c ON c.id = r.cabin_id
       WHERE r.status = 'confirmed' AND r.check_in >= $1::date AND r.check_in <= $2::date
       ${byCabinUnitClause}
       GROUP BY c.name ORDER BY reservations DESC LIMIT 10`,
      byCabinParams
    );

    const byCompanyParams = [from, to];
    let byCompanyUnitClause = '';
    if (filterByType) {
      byCompanyParams.push(unit_type);
      byCompanyUnitClause = `AND c.unit_type = $${byCompanyParams.length}`;
    }
    if (filterByPayment) {
      byCompanyParams.push(payment_method);
      byCompanyUnitClause += ` AND r.payment_method = $${byCompanyParams.length}`;
    }
    const byCompany = await pool.query(
      `SELECT COALESCE(co.name, 'Particulares') AS name,
              COUNT(*)::int AS reservations,
              COALESCE(SUM(r.total_price),0)::numeric AS revenue
       FROM reservations r
       JOIN cabins c ON c.id = r.cabin_id
       LEFT JOIN companies co ON co.id = r.company_id
       WHERE r.status = 'confirmed' AND r.check_in >= $1::date AND r.check_in <= $2::date
       ${byCompanyUnitClause}
       GROUP BY co.name ORDER BY reservations DESC LIMIT 10`,
      byCompanyParams
    );

    const cabinCountParams = [];
    let cabinCountUnitClause = '';
    if (filterByType) {
      cabinCountParams.push(unit_type);
      cabinCountUnitClause = `AND unit_type = $${cabinCountParams.length}`;
    }
    const cabinCount = await pool.query(
      `SELECT COUNT(*)::int AS count FROM cabins WHERE active = true ${cabinCountUnitClause}`,
      cabinCountParams
    );
    const totalCabins = cabinCount.rows[0].count || 1;
    const daysInRange = Math.max(
      1,
      Math.round((new Date(to) - new Date(from)) / 86400000) + 1
    );
    const availableNights = totalCabins * daysInRange;
    const occupancyRate = availableNights > 0
      ? Number(totals.rows[0].total_nights) / availableNights
      : 0;

    res.json({
      ...totals.rows[0],
      occupancy_rate: occupancyRate,
      by_cabin: byCabin.rows,
      by_company: byCompany.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar el resumen' });
  }
});

const PAYMENT_LABELS = { efectivo: 'Efectivo', sinpe: 'Sinpe', tarjeta: 'Tarjeta', transferencia: 'Transferencia' };

// Los fuentes estandar de PDF (Helvetica) no incluyen el simbolo de colones (₡),
// por eso el reporte usa el prefijo "CRC" en vez del glifo.
function formatColones(value) {
  return `CRC ${Number(value).toFixed(2)}`;
}

const COLOR_PRIMARY_DARK = '#1e3a5f';
const COLOR_PRIMARY = '#2b5f8f';
const COLOR_TEXT = '#1e293b';
const COLOR_TEXT_MUTED = '#64748b';
const COLOR_BORDER = '#dde3ea';
const COLOR_HEADER_BG = '#eef2f7';

const REPORT_COLUMNS = [
  { key: 'cabin_name', label: 'Cabina', width: 75 },
  { key: 'client_name', label: 'Cliente', width: 115 },
  { key: 'client_id_number', label: 'Cedula', width: 80 },
  { key: 'guests', label: 'Pax', width: 32 },
  { key: 'company_name', label: 'Empresa', width: 105 },
  { key: 'check_in', label: 'Entrada', width: 62 },
  { key: 'check_out', label: 'Salida', width: 62 },
  { key: 'nights', label: 'Noches', width: 42 },
  { key: 'payment_method', label: 'Pago', width: 58 },
  { key: 'total_price', label: 'Cobrado', width: 80 },
];

const UNIT_TYPE_REPORT_LABELS = { cabina: 'Cabinas', cabana: 'Cabañas' };

// Reporte descargable en PDF con el detalle de reservas y los totales por metodo de pago.
// Puede filtrarse por unit_type=cabina|cabana; sin filtro, muestra el global (cabinas y cabanas).
router.get('/report', async (req, res) => {
  const { from, to, unit_type, payment_method } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from y to son requeridos (YYYY-MM-DD)' });

  const filterByType = unit_type && UNIT_TYPES.includes(unit_type);
  const filterByPayment = payment_method && PAYMENT_METHODS.includes(payment_method);

  try {
    const params = [from, to];
    let unitTypeClause = '';
    if (filterByType) {
      params.push(unit_type);
      unitTypeClause = `AND c.unit_type = $${params.length}`;
    }
    let paymentClause = '';
    if (filterByPayment) {
      params.push(payment_method);
      paymentClause = `AND r.payment_method = $${params.length}`;
    }
    const { rows } = await pool.query(
      `SELECT c.name AS cabin_name, r.client_name, r.client_id_number, r.guests,
              COALESCE(co.name, 'Particular') AS company_name,
              r.check_in, r.check_out, r.nights, r.total_price, r.payment_method
       FROM reservations r
       JOIN cabins c ON c.id = r.cabin_id
       LEFT JOIN companies co ON co.id = r.company_id
       WHERE r.status = 'confirmed' AND r.check_in >= $1::date AND r.check_in <= $2::date
       ${unitTypeClause}
       ${paymentClause}
       ORDER BY r.check_in ASC, c.name ASC`,
      params
    );

    const totals = { efectivo: 0, sinpe: 0, tarjeta: 0, transferencia: 0 };
    for (const r of rows) {
      const key = totals[r.payment_method] !== undefined ? r.payment_method : 'efectivo';
      totals[key] += Number(r.total_price);
    }
    const grandTotal = totals.efectivo + totals.sinpe + totals.tarjeta + totals.transferencia;

    const typeLabel = filterByType ? UNIT_TYPE_REPORT_LABELS[unit_type] : 'Global (cabinas y cabañas)';
    const paymentLabel = filterByPayment ? ` · Pago: ${PAYMENT_LABELS[payment_method]}` : '';
    const fileSuffix = `${filterByType ? `_${unit_type}` : ''}${filterByPayment ? `_${payment_method}` : ''}`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reservas_${from}_a_${to}${fileSuffix}.pdf"`);

    const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });
    doc.pipe(res);

    const tableLeft = 36;
    const tableWidth = REPORT_COLUMNS.reduce((sum, c) => sum + c.width, 0);
    const pageBottom = doc.page.height - doc.page.margins.bottom;

    function drawPageHeader() {
      doc.rect(0, 0, doc.page.width, 58).fill(COLOR_PRIMARY_DARK);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(16).text('Reporte de Reservas', 36, 16);
      doc.fillColor('#cbd5e1').font('Helvetica').fontSize(10).text(`Periodo: ${from} a ${to} · ${typeLabel}${paymentLabel}`, 36, 36);
    }

    function drawTableHeader(y) {
      doc.rect(tableLeft, y, tableWidth, 20).fill(COLOR_HEADER_BG);
      doc.fillColor(COLOR_PRIMARY_DARK).font('Helvetica-Bold').fontSize(9);
      let x = tableLeft;
      for (const col of REPORT_COLUMNS) {
        doc.text(col.label, x + 4, y + 6, { width: col.width - 8 });
        x += col.width;
      }
      return y + 20;
    }

    drawPageHeader();
    let y = 80;
    y = drawTableHeader(y);
    doc.font('Helvetica').fillColor(COLOR_TEXT).fontSize(8);

    for (const r of rows) {
      if (y + 18 > pageBottom) {
        doc.addPage();
        drawPageHeader();
        y = 80;
        y = drawTableHeader(y);
        doc.font('Helvetica').fillColor(COLOR_TEXT).fontSize(8);
      }
      const values = {
        cabin_name: r.cabin_name,
        client_name: r.client_name,
        client_id_number: r.client_id_number,
        guests: String(r.guests),
        company_name: r.company_name,
        check_in: r.check_in.toISOString().slice(0, 10),
        check_out: r.check_out.toISOString().slice(0, 10),
        nights: String(r.nights),
        payment_method: PAYMENT_LABELS[r.payment_method] || r.payment_method,
        total_price: formatColones(r.total_price),
      };
      let x = tableLeft;
      for (const col of REPORT_COLUMNS) {
        doc.text(values[col.key], x + 4, y + 5, { width: col.width - 8, ellipsis: true });
        x += col.width;
      }
      doc.moveTo(tableLeft, y + 18).lineTo(tableLeft + tableWidth, y + 18).strokeColor(COLOR_BORDER).stroke();
      y += 18;
    }

    if (rows.length === 0) {
      doc.fillColor(COLOR_TEXT_MUTED).fontSize(10).text('No hay reservas confirmadas en este rango de fechas.', tableLeft, y + 10);
      y += 30;
    }

    if (y + 130 > pageBottom) {
      doc.addPage();
      drawPageHeader();
      y = 90;
    } else {
      y += 20;
    }

    doc.font('Helvetica-Bold').fontSize(12).fillColor(COLOR_PRIMARY_DARK).text('Totales por metodo de pago', tableLeft, y);
    y += 22;
    doc.font('Helvetica').fontSize(10).fillColor(COLOR_TEXT);
    doc.text(`Efectivo: ${formatColones(totals.efectivo)}`, tableLeft, y); y += 16;
    doc.text(`Sinpe: ${formatColones(totals.sinpe)}`, tableLeft, y); y += 16;
    doc.text(`Tarjeta: ${formatColones(totals.tarjeta)}`, tableLeft, y); y += 16;
    doc.text(`Transferencia: ${formatColones(totals.transferencia)}`, tableLeft, y); y += 18;
    doc.font('Helvetica-Bold').fontSize(11).fillColor(COLOR_PRIMARY).text(`Total general: ${formatColones(grandTotal)}`, tableLeft, y);

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar el reporte' });
  }
});

module.exports = router;
