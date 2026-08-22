import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { formatCurrency } from '../utils/format';

const emptyForm = { name: '', description: '', capacity: 2, price_per_night: 0, price_per_night_company: 0 };

export default function Cabins() {
  const [cabins, setCabins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data } = await client.get('/cabins');
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
      if (editing) {
        await client.put(`/cabins/${editing.id}`, form);
      } else {
        await client.post('/cabins', form);
      }
      setShowModal(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar la cabina');
    }
  }

  async function handleDelete(c) {
    if (!confirm(`Eliminar/desactivar la cabina "${c.name}"?`)) return;
    await client.delete(`/cabins/${c.id}`);
    load();
  }

  return (
    <div>
      <h1 className="page-title">Cabinas</h1>
      <p className="page-subtitle">Administra las cabinas disponibles para reserva</p>

      <div className="toolbar">
        <button className="btn" onClick={openCreate}>+ Agregar cabina</button>
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
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editing ? 'Editar cabina' : 'Nueva cabina'}</h2>
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
