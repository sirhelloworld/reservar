import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../api/AuthContext.jsx';

const links = [
  { to: '/', label: 'Panel principal', end: true },
  { to: '/reservas', label: 'Reservas' },
  { to: '/cabinas', label: 'Cabinas' },
  { to: '/cabanas', label: 'Cabañas' },
  { to: '/empresas', label: 'Empresas' },
  { to: '/bi', label: 'BI / Analitica', superAdminOnly: true },
  { to: '/usuarios', label: 'Usuarios', superAdminOnly: true },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Reservas de Cabinas</div>
        <nav>
          {links
            .filter((l) => !l.superAdminOnly || isSuperAdmin)
            .map((l) => (
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
