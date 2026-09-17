# Finance App

Aplicación full-stack de finanzas personales construida como proyecto de portafolio.

## Checkpoint actual: autenticación multiusuario

- React + Vite
- Node.js + Express
- PostgreSQL
- Registro y login reales
- Contraseñas hasheadas con bcrypt
- Sesión JWT en cookie HttpOnly
- Logout y restauración de sesión
- Datos aislados por usuario
- Categorías iniciales creadas al registrarse
- CRUD completo de transacciones
- Balance, ingresos, gastos y filtros
- Configuración local fuera del ZIP para no perder credenciales en cada checkpoint

## Arquitectura

```text
React
  ↓ HTTP / JSON + cookie HttpOnly
Express API
  ↓ middleware de autenticación
PostgreSQL
```

## Inicio rápido en Windows

### Primera vez con este checkpoint

Desde la raíz del proyecto:

```powershell
.\setup-local.ps1
```

El script hace tres cosas:

1. Guarda la configuración local en `C:\Users\TU_USUARIO\.finance-app.env`.
2. Genera un `JWT_SECRET` aleatorio.
3. Ejecuta `npm install` en backend y frontend.

La contraseña de PostgreSQL se solicita de forma interactiva y ya no queda dentro de la carpeta del proyecto. Los próximos ZIP pueden reemplazar `finance-app` sin borrar esa configuración. Si alguna vez cambias la contraseña local, vuelve a crear la configuración con `.\setup-local.ps1 -ResetConfig`.

Después inicia todo con:

```powershell
.\start-dev.ps1
```

Se abrirán dos terminales automáticamente:

```text
Frontend → http://localhost:5173
Backend  → http://localhost:3000
```

## Base de datos

La base usada es `finance_app`. Si partes desde una instalación nueva, crea la base y aplica el esquema:

```powershell
psql -U postgres -d postgres -c "CREATE DATABASE finance_app;"
psql -U postgres -d finance_app -f ".\backend\sql\001_initial_schema.sql"
```

Si ya venías del checkpoint anterior, no necesitas recrear nada. El antiguo usuario demo puede permanecer en PostgreSQL; esta versión ya no depende de él.

## Flujo de autenticación

```text
Register
  ↓
bcrypt hash
  ↓
users + default categories
  ↓
JWT firmado
  ↓
HttpOnly cookie
  ↓
requireAuth middleware
  ↓
req.user.id
  ↓
queries filtradas por usuario
```

El token no se guarda en `localStorage` ni se expone directamente al código React.

## API

```text
GET    /api/health

POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/categories
POST   /api/categories

GET    /api/transactions
POST   /api/transactions
PATCH  /api/transactions/:id
DELETE /api/transactions/:id
```

Las rutas de categorías y transacciones requieren una sesión válida.

## Próxima etapa

Dashboard más completo, presupuestos, metas de ahorro y analytics.
