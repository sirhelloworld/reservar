import React, { useEffect, useState } from 'react';
import client from '../api/client';
import ReservationModal from '../components/ReservationModal.jsx';

const UNIT_TYPE_LABELS = { cabina: 'cabina', cabana: 'cabaña' };
const UNIT_TYPE_PLURAL = { cabina: 'cabinas', cabana: 'cabañas' };

export default function Dashboard() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [unitType, setUnitType] = useState('cabina');
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
  }, [date, unitType]);

  async function load() {
    setLoading(true);
    try {
      const params = { date, unit_type: unitType };
      const { data } = await client.get('/cabins', { params });
      setCabins(data);
    } finally {
      setLoading(false);
    }
  }

  async function openReservation(reservationId) {
    const { data } = await client.get(`/reservations/${reservationId}`);
    setModalProps({ editing: data, initialCabinId: null });
    setShowModal(true);
  }

  async function handleTileClick(c) {
    if (c.status === 'occupied' || c.status === 'occupied_needs_cleaning') {
      await openReservation(c.active_reservation_id);
    } else if (c.status === 'needs_cleaning') {
      if (!confirm(`Marcar "${c.name}" como lista para alquilar?`)) return;
      await client.put(`/reservations/${c.last_reservation_id}`, { housekeeping_status: 'lista' });
      load();
    } else if (c.status === 'reserved') {
      await openReservation(c.next_reservation_id);
    } else {
      setModalProps({ editing: null, initialCabinId: c.id });
      setShowModal(true);
    }
  }

  function handleSaved() {
    setShowModal(false);
    load();
  }

  const occupied = cabins.filter((c) => c.status === 'occupied' || c.status === 'occupied_needs_cleaning').length;
  const occupiedNeedsCleaning = cabins.filter((c) => c.status === 'occupied_needs_cleaning').length;
  const needsCleaning = cabins.filter((c) => c.status === 'needs_cleaning').length;
  const reserved = cabins.filter((c) => c.status === 'reserved').length;
  const available = cabins.filter((c) => c.status === 'available').length;

  const TILE_TITLES = {
    occupied: 'Ver / editar reserva',
    occupied_needs_cleaning: 'Ocupada, pendiente de limpieza · Ver / editar reserva',
    needs_cleaning: 'Marcar como lista para alquilar',
    reserved: 'Ver / editar la proxima reserva',
  };

  return (
    <div>
      <h1 className="page-title">Panel principal</h1>
      <p className="page-subtitle">
        Estado de ocupacion en tiempo real. Haz clic en una unidad disponible para reservarla, en una
        ocupada para ver/editar su reserva, en una reservada para ver la proxima llegada, o en una que
        necesita limpieza para marcarla como lista.
      </p>

      <div className="toolbar">
        <div>
          <label>Ver</label>
          <select value={unitType} onChange={(e) => setUnitType(e.target.value)}>
            <option value="cabina">Cabinas</option>
            <option value="cabana">Cabañas</option>
          </select>
        </div>
        <div>
          <label>Ver estado en la fecha</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="label">Total de {UNIT_TYPE_PLURAL[unitType]}</div>
          <div className="value">{cabins.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Ocupadas</div>
          <div className="value">{occupied}</div>
        </div>
        <div className="stat-card">
          <div className="label">Ocupadas · necesitan limpieza</div>
          <div className="value">{occupiedNeedsCleaning}</div>
        </div>
        <div className="stat-card">
          <div className="label">Reservadas</div>
          <div className="value">{reserved}</div>
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
              title={TILE_TITLES[c.status] || `Reservar esta ${UNIT_TYPE_LABELS[c.unit_type] || 'unidad'}`}
            >
              <div className="name">{c.name}</div>
              <div className="info">
                {c.status === 'occupied' || c.status === 'occupied_needs_cleaning' ? (
                  <>
                    {c.active_client_name} ({c.active_guests} pax)
                    <br />
                    hasta {new Date(c.active_check_out).toISOString().slice(0, 10)}
                    {c.status === 'occupied_needs_cleaning' && (
                      <>
                        <br />
                        Necesita limpieza
                      </>
                    )}
                  </>
                ) : c.status === 'needs_cleaning' ? (
                  <>Necesita limpieza</>
                ) : c.status === 'reserved' ? (
                  <>
                    Reservada
                    <br />
                    {c.next_client_name} · llega {new Date(c.next_check_in).toISOString().slice(0, 10)}
                  </>
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
