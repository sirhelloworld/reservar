import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../api/AuthContext.jsx';

const links = [
  { to: '/', label: 'Panel de cabinas', end: true },
  { to: '/reservas', label: 'Reservas' },
  { to: '/cabinas', label: 'Cabinas' },
  { to: '/empresas', label: 'Empresas' },
  { to: '/bi', label: 'BI / Analitica' },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Reservas de Cabinas</div>
        <nav>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="logout" onClick={logout}>
          Cerrar sesion {user ? `(${user.email})` : ''}
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
