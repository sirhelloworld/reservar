import React, { useEffect, useState } from 'react';
import client from '../api/client';

const emptyForm = { name: '', tax_id: '', contact_name: '', contact_email: '', contact_phone: '', notes: '' };

export default function Companies() {
  const [companies, setCompanies] = useState([]);
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
      const { data } = await client.get('/companies');
      setCompanies(data);
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
      tax_id: c.tax_id || '',
      contact_name: c.contact_name || '',
      contact_email: c.contact_email || '',
      contact_phone: c.contact_phone || '',
      notes: c.notes || '',
    });
    setError('');
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      if (editing) {
        await client.put(`/companies/${editing.id}`, form);
      } else {
        await client.post('/companies', form);
      }
      setShowModal(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar la empresa');
    }
  }

  async function handleDelete(c) {
    if (!confirm(`Eliminar la empresa "${c.name}"?`)) return;
    try {
      await client.delete(`/companies/${c.id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al eliminar');
    }
  }

  return (
    <div>
      <h1 className="page-title">Empresas</h1>
      <p className="page-subtitle">Empresas que realizan reservas de cabinas</p>

      <div className="toolbar">
        <button className="btn" onClick={openCreate}>+ Agregar empresa</button>
      </div>

      <div className="card">
        {loading ? (
          <p>Cargando...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Identificacion</th>
                <th>Contacto</th>
                <th>Correo</th>
                <th>Telefono</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.tax_id || '-'}</td>
                  <td>{c.contact_name || '-'}</td>
                  <td>{c.contact_email || '-'}</td>
                  <td>{c.contact_phone || '-'}</td>
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
            <h2>{editing ? 'Editar empresa' : 'Nueva empresa'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>Nombre de la empresa</label>
                <input
                  required
                  style={{ width: '100%' }}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="form-row">
                <div className="field">
                  <label>Identificacion / Cedula juridica</label>
                  <input
                    style={{ width: '100%' }}
                    value={form.tax_id}
                    onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Persona de contacto</label>
                  <input
                    style={{ width: '100%' }}
                    value={form.contact_name}
                    onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="field">
                  <label>Correo</label>
                  <input
                    type="email"
                    style={{ width: '100%' }}
                    value={form.contact_email}
                    onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Telefono</label>
                  <input
                    style={{ width: '100%' }}
                    value={form.contact_phone}
                    onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="field">
                <label>Notas</label>
                <textarea
                  rows={2}
                  style={{ width: '100%' }}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
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
