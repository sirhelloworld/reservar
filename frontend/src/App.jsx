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

function PrivateRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
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
        <Route path="cabinas" element={<Cabins />} />
        <Route path="empresas" element={<Companies />} />
        <Route path="bi" element={<BI />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
