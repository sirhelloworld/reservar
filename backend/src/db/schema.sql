-- Esquema de base de datos: Sistema de Reservas de Cabinas

CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cabins (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  capacity INTEGER NOT NULL DEFAULT 2,
  price_per_night NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_per_night_company NUMERIC(10,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cabins ADD COLUMN IF NOT EXISTS price_per_night_company NUMERIC(10,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  tax_id VARCHAR(50),
  contact_name VARCHAR(150),
  contact_email VARCHAR(150),
  contact_phone VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reservations (
  id SERIAL PRIMARY KEY,
  cabin_id INTEGER NOT NULL REFERENCES cabins(id) ON DELETE RESTRICT,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  client_name VARCHAR(150) NOT NULL,
  client_id_number VARCHAR(50) NOT NULL,
  client_email VARCHAR(150),
  client_phone VARCHAR(50),
  guests INTEGER NOT NULL DEFAULT 1,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  nights INTEGER GENERATED ALWAYS AS (check_out - check_in) STORED,
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_type VARCHAR(20) NOT NULL DEFAULT 'normal', -- normal | empresarial
  payment_method VARCHAR(20) NOT NULL DEFAULT 'efectivo', -- efectivo | sinpe | tarjeta
  status VARCHAR(20) NOT NULL DEFAULT 'confirmed', -- confirmed | cancelled
  housekeeping_status VARCHAR(20) NOT NULL DEFAULT 'necesita_limpieza', -- lista | necesita_limpieza
  checked_out_at TIMESTAMPTZ, -- NULL mientras el huesped no ha hecho checkout
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_dates CHECK (check_out > check_in),
  CONSTRAINT chk_guests CHECK (guests > 0)
);

-- Compatibilidad con bases de datos ya migradas antes de agregar estas columnas.
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS guests INTEGER NOT NULL DEFAULT 1;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) NOT NULL DEFAULT 'efectivo';
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS housekeeping_status VARCHAR(20) NOT NULL DEFAULT 'necesita_limpieza';
ALTER TABLE reservations ALTER COLUMN housekeeping_status SET DEFAULT 'necesita_limpieza';
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS price_type VARCHAR(20) NOT NULL DEFAULT 'normal';

CREATE INDEX IF NOT EXISTS idx_reservations_dates ON reservations (cabin_id, check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations (status);
CREATE INDEX IF NOT EXISTS idx_reservations_company ON reservations (company_id);

-- Evita que una misma cabina tenga dos reservas activas que se solapen en fechas.
CREATE OR REPLACE FUNCTION check_reservation_overlap() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND EXISTS (
    SELECT 1 FROM reservations r
    WHERE r.cabin_id = NEW.cabin_id
      AND r.status = 'confirmed'
      AND r.checked_out_at IS NULL
      AND r.id <> COALESCE(NEW.id, -1)
      AND NEW.check_in < r.check_out
      AND NEW.check_out > r.check_in
  ) THEN
    RAISE EXCEPTION 'La cabina ya tiene una reserva confirmada que se solapa con esas fechas';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_reservation_overlap ON reservations;
CREATE TRIGGER trg_check_reservation_overlap
  BEFORE INSERT OR UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION check_reservation_overlap();
