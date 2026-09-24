import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './api/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Reservations from './pages/Reservations.jsx';
import Cabins from './pages/Cabins.jsx';
import Companies from './pages/Companies.jsx';
import BI from './pages/BI.jsx';
import Users from './pages/Users.jsx';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function SuperAdminRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'super_admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="reservas" element={<Reservations />} />
        <Route path="cabinas" element={<Cabins unitType="cabina" />} />
        <Route path="cabanas" element={<Cabins unitType="cabana" />} />
        <Route path="empresas" element={<Companies />} />
        <Route
          path="bi"
          element={
            <SuperAdminRoute>
              <BI />
            </SuperAdminRoute>
          }
        />
        <Route
          path="usuarios"
          element={
            <SuperAdminRoute>
              <Users />
            </SuperAdminRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
