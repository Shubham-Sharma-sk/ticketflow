# Real-Time Ticket Booking System

Full-stack ticket booking app with JWT authentication, seat booking APIs, and real-time seat status sync using Socket.io.

## Tech Stack

- Frontend: React.js, Redux Toolkit, RTK Query, Socket.io Client, Vite
- Backend: Node.js, Express.js, JWT, Socket.io
- Database: SQLite (`better-sqlite3`)

## Project Structure

```text
task/
├── backend/
│   ├── src/
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   └── rateLimit.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── seats.js
│   │   │   └── admin.js
│   │   ├── app.js
│   │   ├── db.js
│   │   └── server.js
│   ├── test/
│   │   └── api.test.js
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   └── store.js
│   │   ├── features/
│   │   │   └── auth/
│   │   │       └── authSlice.js
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## Features

- User registration + login with JWT
- Access + refresh token authentication flow
- Password reset (token-based demo flow)
- Rate limiting on auth routes
- Protected seat APIs
- Seat listing, hold-before-confirm booking, and cancel booking
- My Bookings view
- Admin controls for user CRUD, role updates, seat creation, and seat reset
- Real-time updates across clients (no page refresh needed)
- Clean and modular frontend/backend folder structure
- Backend integration tests using Node test runner + supertest

## Setup Instructions

## 1) Backend Setup

```bash
cd backend
npm install
cp .env.example .env
```

Update `.env` if needed:

```env
PORT=5000
JWT_SECRET=your_jwt_secret_here
FRONTEND_URL=http://localhost:5173
```

Run backend:

```bash
npm run dev
```

## 2) Frontend Setup

Open a new terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend default URL: `http://localhost:5173`

## API Overview

- `POST /api/auth/register` - register user
- `POST /api/auth/login` - login user
- `POST /api/auth/refresh` - refresh access token
- `POST /api/auth/logout` - revoke refresh token
- `POST /api/auth/forgot-password` - generate reset token
- `POST /api/auth/reset-password` - update password via token
- `GET /api/seats` - get all seats (auth required)
- `GET /api/seats/mine` - get current user bookings
- `POST /api/seats/:seatId/hold` - hold seat temporarily
- `POST /api/seats/:seatId/book` - confirm booking (requires active hold)
- `POST /api/seats/:seatId/unbook` - cancel own booking
- `GET /api/admin/users` - list users (admin)
- `POST /api/admin/users` - create user (admin)
- `PATCH /api/admin/users/:userId` - edit user (username/role/password) (admin)
- `PATCH /api/admin/users/:userId/role` - update role (admin)
- `DELETE /api/admin/users/:userId` - delete user (admin)
- `POST /api/admin/seats/create` - create seats by name list (admin)
- `POST /api/admin/seats/reset` - reset all seats (admin)

## Testing

Run backend automated tests:

```bash
cd backend
npm test
```

## Real-Time Event

- Server emits `seat:held`, `seat:booked`, `seat:released`, `seat:updated`, and `seats:reset`.
- All connected clients receive update and refresh seat data automatically.

## Submission Notes

This repository includes:

- React frontend using RTK Query
- Node + Express backend with JWT auth
- SQLite database integration
- Socket.io based real-time booking updates
