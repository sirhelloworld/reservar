import React, { useEffect, useMemo, useState } from 'react';
import client from '../api/client';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function buildInitialForm({ editing, initialCabinId, initialDate }) {
  if (editing) {
    return {
      cabin_id: String(editing.cabin_id),
      company_id: editing.company_id || '',
      client_name: editing.client_name,
      client_id_number: editing.client_id_number,
      client_email: editing.client_email || '',
      client_phone: editing.client_phone || '',
      guests: editing.guests || 1,
      check_in: editing.check_in.slice(0, 10),
      check_out: editing.check_out.slice(0, 10),
      total_price: editing.total_price,
      price_type: editing.price_type || 'normal',
      payment_method: editing.payment_method || 'efectivo',
      housekeeping_status: editing.housekeeping_status || 'necesita_limpieza',
      notes: editing.notes || '',
    };
  }
  const checkIn = initialDate || todayStr();
  return {
    cabin_id: initialCabinId ? String(initialCabinId) : '',
    company_id: '',
    client_name: '',
    client_id_number: '',
    client_email: '',
    client_phone: '',
    guests: 1,
    check_in: checkIn,
    check_out: addDays(checkIn, 1),
    total_price: 0,
    price_type: 'normal',
    payment_method: 'efectivo',
    housekeeping_status: 'necesita_limpieza',
    notes: '',
  };
}

function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const diff = new Date(`${checkOut}T00:00:00`) - new Date(`${checkIn}T00:00:00`);
  const nights = Math.round(diff / 86400000);
  return nights > 0 ? nights : 0;
}

function isCheckedOut(reservation) {
  return !!(reservation && reservation.checked_out_at);
}

export default function ReservationModal({ companies, editing, initialCabinId, initialDate, onClose, onSaved }) {
  const [form, setForm] = useState(() => buildInitialForm({ editing, initialCabinId, initialDate }));
  const [availability, setAvailability] = useState([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [error, setError] = useState('');
  // Evita sobreescribir el monto una vez que el usuario lo edita a mano.
  const [priceTouched, setPriceTouched] = useState(!!editing);
  // La cabina ya quedo determinada (se hizo clic en un tile especifico, o se esta editando
  // una reserva existente): no tiene sentido volver a pedirla en un dropdown.
  const cabinLocked = !!initialCabinId || !!editing;

  useEffect(() => {
    loadAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.check_in, form.check_out]);

  async function loadAvailability() {
    if (!form.check_in || !form.check_out || form.check_out <= form.check_in) {
      setAvailability([]);
      return;
    }
    setLoadingAvailability(true);
    try {
      const params = { from: form.check_in, to: form.check_out };
      if (editing) params.exclude_reservation_id = editing.id;
      const { data } = await client.get('/cabins/availability', { params });
      setAvailability(data);
    } finally {
      setLoadingAvailability(false);
    }
  }

  const selectedCabin = useMemo(
    () => availability.find((c) => String(c.id) === String(form.cabin_id)),
    [availability, form.cabin_id]
  );

  // Autocompleta el monto cobrado a partir del precio de la cabina (normal o empresarial) y las
  // noches, mientras el usuario no lo haya editado manualmente.
  useEffect(() => {
    if (priceTouched || !selectedCabin) return;
    const nights = nightsBetween(form.check_in, form.check_out);
    if (nights <= 0) return;
    const nightlyRate = form.price_type === 'empresarial'
      ? Number(selectedCabin.price_per_night_company)
      : Number(selectedCabin.price_per_night);
    setForm((f) => ({ ...f, total_price: Math.round(nightlyRate * nights * 100) / 100 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCabin, form.price_type, form.check_in, form.check_out, priceTouched]);

  const occupiedCount = availability.filter((c) => c.status === 'occupied').length;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const payload = { ...form, company_id: form.company_id || null };
    try {
      if (editing) {
        await client.put(`/reservations/${editing.id}`, payload);
      } else {
        await client.post('/reservations', payload);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar la reserva');
    }
  }

  async function handleCheckout() {
    if (!confirm(`Registrar el checkout de ${editing.client_name}?`)) return;
    setError('');
    try {
      await client.post(`/reservations/${editing.id}/checkout`);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar el checkout');
    }
  }

  async function handleCancelReservation() {
    if (!confirm(`Cancelar la reserva de ${editing.client_name}?`)) return;
    setError('');
    try {
      await client.put(`/reservations/${editing.id}`, { status: 'cancelled' });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cancelar la reserva');
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{editing ? 'Editar reserva' : 'Nueva reserva'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="field">
              <label>Fecha de entrada</label>
              <input
                type="date"
                required
                style={{ width: '100%' }}
                value={form.check_in}
                onChange={(e) => setForm({ ...form, check_in: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Fecha de salida</label>
              <input
                type="date"
                required
                style={{ width: '100%' }}
                value={form.check_out}
                onChange={(e) => setForm({ ...form, check_out: e.target.value })}
              />
            </div>
          </div>

          <div className="field">
            <label>Cabina / Cabaña</label>
            {cabinLocked ? (
              <div
                style={{
                  padding: '9px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface-alt)',
                  color: 'var(--color-text)',
                }}
              >
                {selectedCabin
                  ? `${selectedCabin.name} · ${selectedCabin.unit_type === 'cabana' ? 'Cabaña' : 'Cabina'} (capacidad ${selectedCabin.capacity})`
                  : 'Cargando...'}
              </div>
            ) : (
              <>
                <select
                  required
                  style={{ width: '100%' }}
                  value={form.cabin_id}
                  onChange={(e) => setForm({ ...form, cabin_id: e.target.value })}
                >
                  <option value="">Seleccione...</option>
                  {availability.map((c) => (
                    <option key={c.id} value={c.id} disabled={c.status === 'occupied'}>
                      {c.name} · {c.unit_type === 'cabana' ? 'Cabaña' : 'Cabina'} (capacidad {c.capacity})
                      {c.status === 'occupied' ? ' - Sin espacio' : ''}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 11, color: 'var(--color-text-soft)', marginTop: 4 }}>
                  {loadingAvailability
                    ? 'Revisando disponibilidad...'
                    : availability.length > 0
                    ? `${occupiedCount} sin espacio para estas fechas`
                    : ''}
                </div>
              </>
            )}
          </div>

          <div className="field">
            <label>Empresa (opcional)</label>
            <select
              style={{ width: '100%' }}
              value={form.company_id}
              onChange={(e) => setForm({ ...form, company_id: e.target.value })}
            >
              <option value="">Particular / sin empresa</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Nombre del cliente</label>
            <input
              required
              style={{ width: '100%' }}
              value={form.client_name}
              onChange={(e) => setForm({ ...form, client_name: e.target.value })}
            />
          </div>

          <div className="form-row">
            <div className="field">
              <label>Cedula</label>
              <input
                required
                style={{ width: '100%' }}
                value={form.client_id_number}
                onChange={(e) => setForm({ ...form, client_id_number: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Telefono</label>
              <input
                style={{ width: '100%' }}
                value={form.client_phone}
                onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
              />
            </div>
          </div>

          <div className="field">
            <label>Correo</label>
            <input
              type="email"
              style={{ width: '100%' }}
              value={form.client_email}
              onChange={(e) => setForm({ ...form, client_email: e.target.value })}
            />
          </div>

          <div className="form-row">
            <div className="field">
              <label>Cantidad de personas</label>
              <input
                type="number"
                min={1}
                max={selectedCabin?.capacity || undefined}
                required
                style={{ width: '100%' }}
                value={form.guests}
                onChange={(e) => setForm({ ...form, guests: Number(e.target.value) })}
                onFocus={(e) => e.target.select()}
                onClick={(e) => e.target.select()}
              />
            </div>
            <div className="field">
              <label>Monto cobrado (₡)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                style={{ width: '100%' }}
                value={form.total_price}
                onChange={(e) => {
                  setPriceTouched(true);
                  setForm({ ...form, total_price: Number(e.target.value) });
                }}
                onFocus={(e) => e.target.select()}
                onClick={(e) => e.target.select()}
              />
              {!priceTouched && selectedCabin && (
                <div style={{ fontSize: 11, color: 'var(--color-text-soft)', marginTop: 4 }}>
                  Calculado automaticamente segun la tarifa y las noches. Puedes editarlo.
                </div>
              )}
            </div>
          </div>

          <div className="field">
            <label>Tipo de tarifa</label>
            <select
              required
              style={{ width: '100%' }}
              value={form.price_type}
              onChange={(e) => setForm({ ...form, price_type: e.target.value })}
            >
              <option value="normal">Normal</option>
              <option value="empresarial">Empresarial</option>
            </select>
            {selectedCabin && (
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
                Normal: ₡{Number(selectedCabin.price_per_night).toFixed(2)}/noche · Empresarial: ₡
                {Number(selectedCabin.price_per_night_company).toFixed(2)}/noche
              </div>
            )}
          </div>

          <div className="field">
            <label>Metodo de pago</label>
            <select
              required
              style={{ width: '100%' }}
              value={form.payment_method}
              onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
            >
              <option value="efectivo">Efectivo</option>
              <option value="sinpe">Sinpe</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="transferencia">Transferencia</option>
            </select>
          </div>

          {editing && editing.status === 'confirmed' && (
            <div className="field">
              <label>Estado de limpieza de la cabina</label>
              <select
                required
                style={{ width: '100%' }}
                value={form.housekeeping_status}
                onChange={(e) => setForm({ ...form, housekeeping_status: e.target.value })}
              >
                <option value="necesita_limpieza">Necesita limpieza</option>
                <option value="lista">Limpia</option>
              </select>
              <div style={{ fontSize: 11, color: 'var(--color-text-soft)', marginTop: 4 }}>
                {isCheckedOut(editing)
                  ? 'La cabina ya tuvo checkout: indica si ya se limpio para poder volver a alquilarla.'
                  : 'La cabina esta ocupada: marca si necesita limpieza durante la estadia (ej. servicio diario).'}
              </div>
            </div>
          )}

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
            {editing && editing.status === 'confirmed' && !isCheckedOut(editing) && (
              <button type="button" className="btn secondary" onClick={handleCheckout}>
                Hacer checkout
              </button>
            )}
            {editing && editing.status === 'confirmed' && (
              <button type="button" className="btn danger" onClick={handleCancelReservation}>
                Cancelar reserva
              </button>
            )}
            <button type="button" className="btn secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
