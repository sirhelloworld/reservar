import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { formatCurrency } from '../utils/format';

const emptyForm = { name: '', description: '', capacity: 2, price_per_night: 0, price_per_night_company: 0 };

const LABELS = {
  cabina: { title: 'Cabinas', singular: 'cabina', article: 'la' },
  cabana: { title: 'Cabañas', singular: 'cabaña', article: 'la' },
};

export default function Cabins({ unitType }) {
  const labels = LABELS[unitType] || LABELS.cabina;
  const [cabins, setCabins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitType]);

  async function load() {
    setLoading(true);
    try {
      const { data } = await client.get('/cabins', { params: { unit_type: unitType } });
      setCabins(data);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setShowModal(true);
  }

  function openEdit(c) {
    setEditing(c);
    setForm({
      name: c.name,
      description: c.description || '',
      capacity: c.capacity,
      price_per_night: c.price_per_night,
      price_per_night_company: c.price_per_night_company,
    });
    setError('');
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const payload = { ...form, unit_type: unitType };
      if (editing) {
        await client.put(`/cabins/${editing.id}`, payload);
      } else {
        await client.post('/cabins', payload);
      }
      setShowModal(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || `Error al guardar la ${labels.singular}`);
    }
  }

  async function handleDelete(c) {
    if (!confirm(`Eliminar/desactivar "${c.name}"?`)) return;
    await client.delete(`/cabins/${c.id}`);
    load();
  }

  return (
    <div>
      <h1 className="page-title">{labels.title}</h1>
      <p className="page-subtitle">Administra las {labels.title.toLowerCase()} disponibles para reserva</p>

      <div className="toolbar">
        <button className="btn" onClick={openCreate}>+ Agregar {labels.singular}</button>
      </div>

      <div className="card">
        {loading ? (
          <p>Cargando...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Capacidad</th>
                <th>Precio normal/noche</th>
                <th>Precio empresarial/noche</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cabins.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.capacity}</td>
                  <td>{formatCurrency(c.price_per_night)}</td>
                  <td>{formatCurrency(c.price_per_night_company)}</td>
                  <td>
                    <span className={`badge ${c.active ? 'available' : 'cancelled'}`}>
                      {c.active ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="btn secondary sm" onClick={() => openEdit(c)}>Editar</button>
                      <button className="btn danger sm" onClick={() => handleDelete(c)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
              {cabins.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    No hay {labels.title.toLowerCase()} registradas todavia
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editing ? `Editar ${labels.singular}` : `Nueva ${labels.singular}`}</h2>
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>Nombre</label>
                <input
                  required
                  style={{ width: '100%' }}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Descripcion</label>
                <textarea
                  style={{ width: '100%' }}
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="form-row">
                <div className="field">
                  <label>Capacidad</label>
                  <input
                    type="number"
                    min={1}
                    style={{ width: '100%' }}
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => e.target.select()}
                  />
                </div>
                <div className="field">
                  <label>Precio normal por noche (₡)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    style={{ width: '100%' }}
                    value={form.price_per_night}
                    onChange={(e) => setForm({ ...form, price_per_night: Number(e.target.value) })}
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => e.target.select()}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="field">
                  <label>Precio empresarial por noche (₡)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    style={{ width: '100%' }}
                    value={form.price_per_night_company}
                    onChange={(e) => setForm({ ...form, price_per_night_company: Number(e.target.value) })}
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => e.target.select()}
                  />
                </div>
              </div>
              {error && <div className="error-text">{error}</div>}
              <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="btn secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
