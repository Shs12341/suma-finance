# Finance App

Aplicación full-stack de finanzas personales construida como proyecto de portafolio.

## Checkpoint actual: Financial Core

Este checkpoint conserva la autenticación multiusuario y agrega la capa principal de producto financiero:

- React + Vite
- Node.js + Express
- PostgreSQL
- Registro/login con bcrypt + JWT en cookie HttpOnly
- Datos aislados por usuario
- CRUD completo de transacciones
- Búsqueda y filtros por tipo/mes
- CRUD de categorías
- Dashboard mensual
- Presupuestos por categoría y mes
- Metas de ahorro con progreso y aportes
- Analytics de 6 meses
- Gastos por categoría
- Savings rate
- Configuración local persistente fuera del ZIP

## Actualizar desde el checkpoint anterior

Tu archivo local sigue fuera del proyecto:

```text
C:\Users\TU_USUARIO\.finance-app.env
```

Después de reemplazar la carpeta por este ZIP, ejecuta una vez:

```powershell
.\setup-local.ps1
```

Como el archivo `.finance-app.env` ya existe, **no vuelve a pedir la contraseña**. El script preserva tu configuración, instala dependencias y aplica todos los archivos SQL de `backend/sql` en orden.

Después inicia el proyecto con:

```powershell
.\start-dev.ps1
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:3000`

## Base de datos

### Tablas principales

```text
users
categories
transactions
budgets
savings_goals
```

Las migraciones actuales son:

```text
backend/sql/001_initial_schema.sql
backend/sql/002_financial_core.sql
```

`setup-local.ps1` ejecuta todos los `.sql` por orden de nombre y son idempotentes.

## API

```text
GET    /api/health

POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/categories
POST   /api/categories
PATCH  /api/categories/:id
DELETE /api/categories/:id

GET    /api/transactions
POST   /api/transactions
PATCH  /api/transactions/:id
DELETE /api/transactions/:id

GET    /api/budgets?month=YYYY-MM
POST   /api/budgets
DELETE /api/budgets/:id

GET    /api/goals
POST   /api/goals
PATCH  /api/goals/:id
DELETE /api/goals/:id

GET    /api/analytics?month=YYYY-MM&months=6
```

Todas las rutas financieras requieren sesión válida y filtran por `req.user.id`.

## Flujo del dashboard

```text
Overview
├── resumen mensual
├── income vs expenses (6 meses)
├── gasto por categoría
├── budgets
└── savings goals

Transactions
├── create/edit/delete
├── search
├── type filter
└── month filter

Categories
├── create
├── rename/edit type cuando es seguro
└── delete
```

## Siguiente etapa sugerida

Recuperación/cambio de contraseña, perfil, estados de carga más pulidos, toasts, pruebas automatizadas y preparación para deploy.
