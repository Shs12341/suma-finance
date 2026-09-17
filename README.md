# Finance App

Proyecto full-stack de finanzas personales en evolución hacia un portafolio profesional.

## Checkpoint actual

- React + Vite
- Node.js + Express
- PostgreSQL
- CRUD completo de transacciones
- Categorías relacionadas por usuario
- Ingresos y gastos en una sola tabla `transactions`
- Resumen de balance, ingresos y gastos
- Edición y eliminación desde la interfaz
- Usuario demo temporal hasta implementar autenticación

## Arquitectura

```text
React
  ↓ HTTP / JSON
Express API
  ↓ SQL parametrizado
PostgreSQL
```

## 1. Preparar PostgreSQL

Crea la base si todavía no existe:

```sql
CREATE DATABASE finance_app;
```

Desde la raíz del proyecto ejecuta:

```powershell
psql -U postgres -d finance_app -f ".\backend\sql\001_initial_schema.sql"
psql -U postgres -d finance_app -f ".\backend\sql\002_seed_demo.sql"
```

La tabla antigua `gastos` puede permanecer en la base por ahora; esta versión ya trabaja con `transactions`.

## 2. Configurar backend

Copia `backend/.env.example` como `backend/.env` y coloca tu contraseña local de PostgreSQL.

```env
PORT=3000
DB_USER=postgres
DB_HOST=localhost
DB_NAME=finance_app
DB_PASSWORD=tu_password
DB_PORT=5432
DEMO_USER_EMAIL=demo@finance.local
```

Luego:

```powershell
cd backend
npm install
npm start
```

Comprueba:

```text
http://localhost:3000/api/health
```

Debe responder con `database: connected`.

## 3. Ejecutar frontend

En otra terminal:

```powershell
cd frontend
npm install
npm run dev
```

Abre:

```text
http://localhost:5173
```

## API actual

```text
GET    /api/health
GET    /api/categories
POST   /api/categories
GET    /api/transactions
POST   /api/transactions
PATCH  /api/transactions/:id
DELETE /api/transactions/:id
```

## Próxima etapa

Autenticación real, separación por sesión de usuario, presupuestos, metas de ahorro y analytics.
