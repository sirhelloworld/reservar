import React, { useEffect, useState } from 'react';
import client from '../api/client';
import ReservationModal from '../components/ReservationModal.jsx';

export default function Dashboard() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [cabins, setCabins] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalProps, setModalProps] = useState({ editing: null, initialCabinId: null });

  useEffect(() => {
    client.get('/companies').then(({ data }) => setCompanies(data));
  }, []);

  useEffect(() => {
    load();
  }, [date]);

  async function load() {
    setLoading(true);
    try {
      const { data } = await client.get('/cabins', { params: { date } });
      setCabins(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleTileClick(c) {
    if (c.status === 'occupied') {
      const { data } = await client.get(`/reservations/${c.active_reservation_id}`);
      setModalProps({ editing: data, initialCabinId: null });
      setShowModal(true);
    } else if (c.status === 'needs_cleaning') {
      if (!confirm(`Marcar "${c.name}" como lista para alquilar?`)) return;
      await client.put(`/reservations/${c.last_reservation_id}`, { housekeeping_status: 'lista' });
      load();
    } else {
      setModalProps({ editing: null, initialCabinId: c.id });
      setShowModal(true);
    }
  }

  function handleSaved() {
    setShowModal(false);
    load();
  }

  const occupied = cabins.filter((c) => c.status === 'occupied').length;
  const needsCleaning = cabins.filter((c) => c.status === 'needs_cleaning').length;
  const available = cabins.length - occupied - needsCleaning;

  return (
    <div>
      <h1 className="page-title">Panel de cabinas</h1>
      <p className="page-subtitle">
        Estado de ocupacion en tiempo real. Haz clic en una cabina disponible para reservarla, en una
        ocupada para ver/editar su reserva, o en una que necesita limpieza para marcarla como lista.
      </p>

      <div className="toolbar">
        <div>
          <label>Ver estado en la fecha</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="label">Total de cabinas</div>
          <div className="value">{cabins.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Ocupadas</div>
          <div className="value">{occupied}</div>
        </div>
        <div className="stat-card">
          <div className="label">Necesitan limpieza</div>
          <div className="value">{needsCleaning}</div>
        </div>
        <div className="stat-card">
          <div className="label">Disponibles</div>
          <div className="value">{available}</div>
        </div>
      </div>

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <div className="cabin-grid">
          {cabins.map((c) => (
            <div
              key={c.id}
              className={`cabin-tile ${c.status}`}
              style={{ cursor: 'pointer' }}
              onClick={() => handleTileClick(c)}
              title={
                c.status === 'occupied'
                  ? 'Ver / editar reserva'
                  : c.status === 'needs_cleaning'
                  ? 'Marcar como lista para alquilar'
                  : 'Reservar esta cabina'
              }
            >
              <div className="name">{c.name}</div>
              <div className="info">
                {c.status === 'occupied' ? (
                  <>
                    {c.active_client_name} ({c.active_guests} pax)
                    <br />
                    hasta {new Date(c.active_check_out).toISOString().slice(0, 10)}
                  </>
                ) : c.status === 'needs_cleaning' ? (
                  <>Necesita limpieza</>
                ) : (
                  <>Disponible · capacidad {c.capacity}</>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <ReservationModal
          companies={companies}
          editing={modalProps.editing}
          initialCabinId={modalProps.initialCabinId}
          initialDate={date}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
