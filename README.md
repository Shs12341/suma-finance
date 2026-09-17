# Finance App

Aplicación full-stack de finanzas personales construida como proyecto de portafolio.

## Checkpoint actual: Security Hardening

La base financiera anterior sigue intacta y este checkpoint endurece la aplicación alrededor de los hallazgos de una auditoría real del estado anterior.

### Stack y producto

- React + Vite
- Node.js + Express
- PostgreSQL
- Registro/login con bcrypt
- JWT en cookie HttpOnly
- Sesiones revocables almacenadas en PostgreSQL
- Datos aislados por usuario
- Transacciones, categorías, presupuestos, metas y analytics
- Cursor pagination para transacciones
- Gestión visible de sesiones activas

### Seguridad añadida

- logout con revocación real del token emitido
- cerrar todas las sesiones
- revocar sesiones individuales
- CSRF token ligado a la sesión
- validación estricta de Origin para escrituras del navegador
- rate limiting de login/register
- validación server-side alineada con PostgreSQL
- límites de paginación
- headers de seguridad
- `X-Powered-By` deshabilitado
- manejo uniforme de errores de entrada
- pruebas unitarias de controles de seguridad

Más detalles: `SECURITY.md` y `docs/security/HARDENING_CHECKPOINT.md`.

## Actualizar desde el checkpoint anterior

Tu configuración local continúa fuera del proyecto:

```text
C:\Users\TU_USUARIO\.finance-app.env
```

Después de reemplazar la carpeta por este ZIP ejecuta:

```powershell
cd C:\Users\yessy\finance-app
.\setup-local.ps1
```

El script conserva `.finance-app.env`, instala dependencias y aplica todas las migraciones SQL, incluida:

```text
backend/sql/003_security_hardening.sql
```

Luego inicia:

```powershell
.\start-dev.ps1
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:3000`

> Este checkpoint cambia el formato de sesión. Las cookies/JWT emitidas por checkpoints anteriores se consideran inválidas una vez actualizado el backend. Esto cierra la sesión anterior, pero no borra usuarios ni datos.

## Base de datos

Tablas principales:

```text
users
categories
transactions
budgets
savings_goals
auth_sessions
```

Migraciones:

```text
backend/sql/001_initial_schema.sql
backend/sql/002_financial_core.sql
backend/sql/003_security_hardening.sql
```

`setup-local.ps1` aplica todos los `.sql` en orden y las migraciones son idempotentes.

## API principal

```text
GET    /api/health

POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/logout-all
GET    /api/auth/me
GET    /api/auth/csrf
GET    /api/auth/sessions
DELETE /api/auth/sessions/:id

GET    /api/categories?limit=100&offset=0
POST   /api/categories
PATCH  /api/categories/:id
DELETE /api/categories/:id

GET    /api/transactions?limit=30&cursor=...&type=expense&month=YYYY-MM&search=...
POST   /api/transactions
PATCH  /api/transactions/:id
DELETE /api/transactions/:id

GET    /api/budgets?month=YYYY-MM
POST   /api/budgets
DELETE /api/budgets/:id

GET    /api/goals?limit=50&offset=0
POST   /api/goals
PATCH  /api/goals/:id
DELETE /api/goals/:id

GET    /api/analytics?month=YYYY-MM&months=6
```

Todas las rutas financieras requieren una sesión activa y filtran por `req.user.id`. Los métodos de escritura protegidos también requieren `X-CSRF-Token`.

## Tests

Desde backend:

```powershell
cd backend
npm test
```

Actualmente cubren validación de calendario, dinero, payloads inesperados, paginación, CSRF y rate limiting.

## Auditoría

El informe pre-hardening está preservado en:

```text
docs/security/SECURITY_AUDIT_BASELINE.md
```

La idea es repetir exactamente la misma auditoría contra este checkpoint y comparar evidencia antes/después.
