import React, { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import client from '../api/client';
import { formatCurrency } from '../utils/format';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend);

function todayMinus(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const GRAY = '#64748b';
const BLUE = '#2b5f8f';
const BLUE_LIGHT = 'rgba(59, 130, 196, 0.25)';
const BLUE_DARK = '#1e3a5f';

export default function BI() {
  const [from, setFrom] = useState(todayMinus(30));
  const [to, setTo] = useState(todayMinus(0));
  const [groupBy, setGroupBy] = useState('day');
  const [series, setSeries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    load();
  }, [from, to, groupBy]);

  async function handleDownloadReport() {
    setDownloading(true);
    try {
      const response = await client.get('/bi/report', { params: { from, to }, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `reservas_${from}_a_${to}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  async function load() {
    setLoading(true);
    try {
      const [s1, s2] = await Promise.all([
        client.get('/bi/timeseries', { params: { from, to, groupBy } }),
        client.get('/bi/summary', { params: { from, to } }),
      ]);
      setSeries(s1.data);
      setSummary(s2.data);
    } finally {
      setLoading(false);
    }
  }

  const labels = series.map((s) => new Date(s.period).toISOString().slice(0, 10));

  const lineData = {
    labels,
    datasets: [
      {
        label: 'Reservas',
        data: series.map((s) => s.reservations),
        borderColor: BLUE,
        backgroundColor: BLUE_LIGHT,
        tension: 0.3,
        fill: true,
      },
    ],
  };

  const revenueData = {
    labels,
    datasets: [
      {
        label: 'Ingresos (₡)',
        data: series.map((s) => Number(s.revenue)),
        borderColor: BLUE_DARK,
        backgroundColor: 'rgba(30, 58, 95, 0.2)',
        tension: 0.3,
        fill: true,
      },
    ],
  };

  const revenueOptions = {
    plugins: {
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      y: {
        ticks: {
          callback: (value) => formatCurrency(value),
        },
      },
    },
  };

  const cabinData = summary && {
    labels: summary.by_cabin.map((c) => c.name),
    datasets: [
      {
        label: 'Reservas por cabina',
        data: summary.by_cabin.map((c) => c.reservations),
        backgroundColor: GRAY,
      },
    ],
  };

  return (
    <div>
      <h1 className="page-title">BI / Analitica</h1>
      <p className="page-subtitle">Comportamiento de las reservaciones segun el rango de fechas</p>

      <div className="toolbar">
        <div>
          <label>Desde</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label>Hasta</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <label>Agrupar por</label>
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
            <option value="day">Dia</option>
            <option value="week">Semana</option>
            <option value="month">Mes</option>
          </select>
        </div>
        <div>
          <label>&nbsp;</label>
          <button className="btn secondary" onClick={handleDownloadReport} disabled={downloading}>
            {downloading ? 'Generando...' : '⬇ Descargar reporte (PDF)'}
          </button>
        </div>
      </div>

      {summary && (
        <div className="stats-row">
          <div className="stat-card">
            <div className="label">Reservas en el rango</div>
            <div className="value">{summary.reservations}</div>
          </div>
          <div className="stat-card">
            <div className="label">Noches reservadas</div>
            <div className="value">{summary.total_nights}</div>
          </div>
          <div className="stat-card">
            <div className="label">Ingresos</div>
            <div className="value">{formatCurrency(summary.revenue)}</div>
          </div>
          <div className="stat-card">
            <div className="label">Ocupacion</div>
            <div className="value">{(summary.occupancy_rate * 100).toFixed(1)}%</div>
          </div>
        </div>
      )}

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="card">
            <h3 style={{ marginTop: 0, color: 'var(--color-primary-dark)' }}>Reservas en el tiempo</h3>
            <Line data={lineData} />
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0, color: 'var(--color-primary-dark)' }}>Ingresos en el tiempo</h3>
            <Line data={revenueData} options={revenueOptions} />
          </div>
          {cabinData && (
            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <h3 style={{ marginTop: 0, color: 'var(--color-primary-dark)' }}>Reservas por cabina (top 10)</h3>
              <Bar data={cabinData} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
