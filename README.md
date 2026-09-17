# Finance App

Proyecto full-stack de finanzas personales en desarrollo.

## Estado actual

- Frontend: React + Vite
- Backend: Node.js + Express
- API: GET, POST y DELETE de gastos
- Persistencia actual: memoria del backend
- Siguiente etapa: PostgreSQL y rediseño del modelo de datos

## Ejecutar localmente

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
npm install
npm start
```

El frontend usa `http://localhost:5173` y el backend `http://localhost:3000` por defecto.

## Variables de entorno

Copia `backend/.env.example` como `backend/.env` si necesitas cambiar el puerto. El archivo `.env` está ignorado por Git.
