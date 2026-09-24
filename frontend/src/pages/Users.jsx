import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../api/AuthContext.jsx';

const ROLE_LABELS = { super_admin: 'Super admin', operador: 'Operador' };

const emptyForm = { email: '', password: '', role: 'operador' };

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
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
      const { data } = await client.get('/users');
      setUsers(data);
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

  function openEdit(u) {
    setEditing(u);
    setForm({ email: u.email, password: '', role: u.role });
    setError('');
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      if (editing) {
        const payload = { email: form.email, role: form.role };
        if (form.password) payload.password = form.password;
        await client.put(`/users/${editing.id}`, payload);
      } else {
        await client.post('/users', form);
      }
      setShowModal(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar el usuario');
    }
  }

  async function handleDelete(u) {
    if (!confirm(`Eliminar el usuario "${u.email}"?`)) return;
    try {
      await client.delete(`/users/${u.id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al eliminar el usuario');
    }
  }

  return (
    <div>
      <h1 className="page-title">Usuarios</h1>
      <p className="page-subtitle">
        Administra quien puede acceder al sistema. Los operadores no pueden ver la seccion de BI / Analitica.
      </p>

      <div className="toolbar">
        <button className="btn" onClick={openCreate}>+ Agregar usuario</button>
      </div>

      <div className="card">
        {loading ? (
          <p>Cargando...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Correo</th>
                <th>Rol</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>
                    <span className={`badge ${u.role === 'super_admin' ? 'occupied' : 'available'}`}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="btn secondary sm" onClick={() => openEdit(u)}>Editar</button>
                      {String(u.id) !== String(currentUser?.id) && (
                        <button className="btn danger sm" onClick={() => handleDelete(u)}>Eliminar</button>
                      )}
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
            <h2>{editing ? 'Editar usuario' : 'Nuevo usuario'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>Correo</label>
                <input
                  type="email"
                  required
                  style={{ width: '100%' }}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="field">
                <label>{editing ? 'Nueva contrasena (opcional)' : 'Contrasena'}</label>
                <input
                  type="password"
                  required={!editing}
                  style={{ width: '100%' }}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Rol</label>
                <select
                  style={{ width: '100%' }}
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="operador">Operador (no ve BI / Analitica)</option>
                  <option value="super_admin">Super admin (acceso total)</option>
                </select>
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
