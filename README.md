# Sistema de Reservas de Cabinas

Sistema interno de administración para gestionar reservas de cabinas por noche.

## Estructura

- `backend/` — API en Node.js/Express + PostgreSQL (JWT auth, cron de correo diario).
- `frontend/` — Panel de administración en React (Vite), paleta gris/azul.

## Funcionalidades

- 28 cabinas creadas por defecto (configurable, y se pueden agregar/quitar desde el panel).
- Vista de ocupación en tiempo real (ocupadas vs. disponibles) por fecha.
- Reservas por noche con datos del cliente: nombre, cédula, correo, teléfono.
- Gestión de empresas y selección de empresa (dropdown) al crear una reserva.
- Sección de BI con gráficas (reservas, ingresos, ocupación) filtrables por rango de fechas.
- Envío automático diario (cron) de un correo con las reservas del día.
- Acceso protegido con usuario administrador (JWT).

## Requisitos

- Node.js 18+
- PostgreSQL 13+

## Puesta en marcha — Backend

```bash
cd backend
npm install
cp .env.example .env
```

Edita `backend/.env` con los datos de tu base de datos PostgreSQL, el usuario administrador inicial y las credenciales SMTP para el correo diario.

Crea la base de datos (si no existe) y ejecuta la migración y el seed:

```bash
createdb reservar
npm run migrate
npm run seed
```

`npm run seed` crea las 28 cabinas por defecto y el usuario administrador definido en `.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).

Inicia el servidor:

```bash
npm run dev
```

La API queda disponible en `http://localhost:4000/api`.

### Correo diario automático

El job se programa al iniciar el servidor usando `DAILY_EMAIL_CRON` (por defecto `0 7 * * *`, 7:00am). Para probarlo manualmente sin esperar al cron, con sesión iniciada en el panel:

```bash
curl -X POST http://localhost:4000/api/system/send-daily-summary -H "Authorization: Bearer TU_TOKEN"
```

## Puesta en marcha — Frontend

```bash
cd frontend
npm install
npm run dev
```

Abre `http://localhost:5173`. En desarrollo, Vite redirige `/api` al backend en `http://localhost:4000`.

Inicia sesión con el correo y contraseña del administrador creados por `npm run seed`.

## Notas sobre el modelo de datos

- Una reserva ocupa la cabina desde `check_in` (inclusive) hasta `check_out` (exclusivo) — solo por noche.
- La base de datos evita solapamientos: no se pueden crear dos reservas confirmadas en la misma cabina con fechas que se crucen.
- Al eliminar una cabina con historial de reservas, esta se desactiva en lugar de borrarse (para no perder el histórico).

## Despliegue en Supabase + Vercel

La base de datos vive en Supabase y la app completa (frontend + API) en un solo proyecto de Vercel:
el frontend se sirve como sitio estático (`frontend/dist`) y Express corre como función serverless en `api/index.js`.

### 1. Supabase (base de datos)

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En **Connect → Connection string**, copia la URL del **Transaction pooler** (puerto `6543`) y reemplaza `[YOUR-PASSWORD]`.
3. Desde tu máquina, crea el esquema y los datos iniciales apuntando a Supabase (en `backend/.env` pon `DATABASE_URL=...`):

```bash
cd backend
npm run migrate
npm run seed
```

El esquema activa RLS en todas las tablas para que no sean accesibles desde la API pública de Supabase; el backend no se ve afectado.

### 2. Vercel (app)

1. Importa el repositorio en [vercel.com/new](https://vercel.com/new) dejando el **Root Directory** en la raíz (la configuración está en `vercel.json`).
2. En **Settings → Environment Variables** define: `DATABASE_URL`, `JWT_SECRET`, `CRON_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`, `MAIL_TO`.
3. Despliega.

### Correo diario en Vercel

En Vercel no corre `node-cron`; el envío lo dispara **Vercel Cron** (`vercel.json`) llamando a `/api/cron/daily-summary`.
El horario está en UTC: `0 13 * * *` = 7:00am en Costa Rica.
