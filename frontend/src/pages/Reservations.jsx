import React, { useEffect, useState } from 'react';
import client from '../api/client';
import ReservationModal from '../components/ReservationModal.jsx';
import { formatCurrency } from '../utils/format';

const PAYMENT_LABELS = { efectivo: 'Efectivo', sinpe: 'Sinpe', tarjeta: 'Tarjeta' };
const PRICE_TYPE_LABELS = { normal: 'Normal', empresarial: 'Empresarial' };

function isCheckedOut(r) {
  return r.status === 'confirmed' && !!r.checked_out_at;
}

export default function Reservations() {
  const [reservations, setReservations] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filters, setFilters] = useState({ from: '', to: '', status: '' });

  useEffect(() => {
    loadAux();
  }, []);

  useEffect(() => {
    load();
  }, [filters]);

  async function loadAux() {
    const { data } = await client.get('/companies');
    setCompanies(data);
  }

  async function load() {
    setLoading(true);
    try {
      const params = {};
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      if (filters.status) params.status = filters.status;
      const { data } = await client.get('/reservations', { params });
      setReservations(data);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setShowModal(true);
  }

  function openEdit(r) {
    setEditing(r);
    setShowModal(true);
  }

  function handleSaved() {
    setShowModal(false);
    load();
  }

  async function handleCancel(r) {
    if (!confirm(`Cancelar la reserva de ${r.client_name}?`)) return;
    await client.put(`/reservations/${r.id}`, { status: 'cancelled' });
    load();
  }

  async function handleCheckout(r) {
    if (!confirm(`Registrar el checkout de ${r.client_name} (${r.cabin_name})?`)) return;
    await client.post(`/reservations/${r.id}/checkout`);
    load();
  }

  async function handleHousekeepingChange(r, housekeeping_status) {
    await client.put(`/reservations/${r.id}`, { housekeeping_status });
    load();
  }

  return (
    <div>
      <h1 className="page-title">Reservas</h1>
      <p className="page-subtitle">Gestion de reservas por noche</p>

      <div className="toolbar">
        <button className="btn" onClick={openCreate}>+ Nueva reserva</button>
        <div>
          <label>Desde</label>
          <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        </div>
        <div>
          <label>Hasta</label>
          <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        </div>
        <div>
          <label>Estado</label>
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">Todos</option>
            <option value="confirmed">Confirmada</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <p>Cargando...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Cabina</th>
                <th>Cliente</th>
                <th>Cedula</th>
                <th>Personas</th>
                <th>Empresa</th>
                <th>Entrada</th>
                <th>Salida</th>
                <th>Noches</th>
                <th>Cobrado</th>
                <th>Tarifa</th>
                <th>Pago</th>
                <th>Limpieza</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => (
                <tr key={r.id}>
                  <td>{r.cabin_name}</td>
                  <td>{r.client_name}</td>
                  <td>{r.client_id_number}</td>
                  <td>{r.guests}</td>
                  <td>{r.company_name || 'Particular'}</td>
                  <td>{r.check_in.slice(0, 10)}</td>
                  <td>{r.check_out.slice(0, 10)}</td>
                  <td>{r.nights}</td>
                  <td>{formatCurrency(r.total_price)}</td>
                  <td>{PRICE_TYPE_LABELS[r.price_type] || r.price_type}</td>
                  <td>{PAYMENT_LABELS[r.payment_method] || r.payment_method}</td>
                  <td>
                    {isCheckedOut(r) ? (
                      <select
                        value={r.housekeeping_status}
                        onChange={(e) => handleHousekeepingChange(r, e.target.value)}
                        className={r.housekeeping_status === 'necesita_limpieza' ? 'housekeeping-select needs-cleaning' : 'housekeeping-select'}
                      >
                        <option value="necesita_limpieza">Necesita limpieza</option>
                        <option value="lista">Lista para alquilar</option>
                      </select>
                    ) : (
                      <span style={{ color: 'var(--color-text-soft)', fontSize: 12 }}>
                        {r.status === 'confirmed' ? 'Ocupada' : '—'}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${r.status === 'confirmed' ? 'available' : 'cancelled'}`}>
                      {r.status === 'confirmed' ? 'Confirmada' : 'Cancelada'}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="btn secondary sm" onClick={() => openEdit(r)}>Editar</button>
                      {r.status === 'confirmed' && !isCheckedOut(r) && (
                        <button className="btn secondary sm" onClick={() => handleCheckout(r)}>Checkout</button>
                      )}
                      {r.status === 'confirmed' && (
                        <button className="btn danger sm" onClick={() => handleCancel(r)}>Cancelar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {reservations.length === 0 && (
                <tr>
                  <td colSpan={14} style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    No hay reservas para los filtros seleccionados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <ReservationModal
          companies={companies}
          editing={editing}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
