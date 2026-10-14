# Gram2City — Server

## Overview

Express 5 REST API + Socket.io backend for the Gram2City logistics/parcel-delivery platform.  
Handles auth, parcel management, rider assignment, payments, real-time chat, and file uploads.

**Root path**: `gram2city-server/`  
**Dev server**: `npm run dev` (ts-node-dev, `--respawn --transpile-only`)  
**Package name**: `gram2city-server`  
**Deployed to**: Vercel (`vercel.json` present)  
**API version**: `2.3.0`  

---

## Tech Stack

| Concern      | Library / Version                                    |
| ------------ | ---------------------------------------------------- |
| Framework    | Express 5 (CommonJS)                                 |
| Language     | TypeScript 6                                         |
| Database     | MongoDB native driver v6                             |
| Auth         | Google OAuth (google-auth-library) + Native JWT      |
| Real-time    | Socket.io v4                                         |
| Payments     | Stripe v18                                           |
| File uploads | Multer v2                                            |
| Security     | Helmet, CORS, express-rate-limit (1000 req / 15 min) |
| Compression  | compression (gzip)                                   |
| Logging      | Morgan (via custom `logger` middleware)              |
| Validation   | Zod v4                                               |

---

## Source Structure (`src/`)

```
src/
├── app.ts                # Express app: middleware stack, routes setup
├── server.ts             # HTTP server entry + Socket.io init
├── config/               # Env config (typed, validated)
├── db/                   # MongoDB connection helper
├── middleware/
│   ├── logger.ts         # Morgan request logger
│   ├── globalErrorHandler.ts  # Centralized error handler
│   └── auth.ts           # Native JWT verification & RBAC guards
├── modules/              # Feature modules (MVC)
│   ├── app.routes.ts     # Root API router (mounts all modules)
│   ├── admin/            # Admin-only operations
│   ├── auth/             # Login, register, token refresh
│   ├── finance/          # Financial settings, Stripe integration
│   ├── parcel/           # Parcel CRUD, status updates
│   ├── public/           # Unauthenticated public endpoints
│   ├── rider/            # Rider deliveries, earnings
│   ├── support/          # Feedback / support tickets
│   └── user/             # User profile, addresses
├── socket/               # Socket.io event handlers (chat, live updates)
├── types/                # Shared server-side TypeScript types
└── utils/                # Utility helpers
```

---

## Key Conventions

- **Module pattern**: Each feature has its own folder with `router`, `controller`, and `service` files
- **Auth**: All protected routes use native JWT token verification middleware (`verifyToken` / `verifyRole`) with `Authorization: Bearer <token>`
- **Error handling**: Always throw to `globalErrorHandler`; never send error responses inline in controllers
- **Validation**: Zod schemas on request body/query before hitting controller logic
- **Env**: All config loaded from `.env` via `src/config/` — never `process.env` directly in business logic
- **File naming**: camelCase for all server files
- **DB**: MongoDB native driver — no ODM (no Mongoose); collections accessed via helpers in `src/db/`

---

## Auth Flow

1. Client signs in with Email/Password (`POST /api/auth/login`) or Google OAuth token (`POST /api/auth/google`).
2. Server validates credentials / Google token, ensures MongoDB user record exists, and issues a short-lived access JWT (`15m`) + httpOnly refresh JWT (`7d`).
3. Refresh token hash/family is tracked in MongoDB `refresh_tokens` collection with auto-expiring TTL index.
4. Client sends access JWT in `Authorization: Bearer <token>` header on protected API requests.
5. Auth middleware validates JWT signature with `JWT_SECRET` and attaches user claims (`req.user = { email, role, id }`).
6. Token refresh endpoint (`POST /api/auth/refresh`) silently exchanges httpOnly refresh cookie for a fresh access token.

---

## Environment Variables (`.env`)

| Variable                | Purpose                                      |
| ----------------------- | -------------------------------------------- |
| `PORT`                  | Express server port (default 5000)           |
| `MONGODB_URI`           | MongoDB Atlas connection string              |
| `DB_NAME`               | MongoDB database name (`parcelDB`)           |
| `CLIENT_URL`            | Allowed CORS origins                         |
| `JWT_SECRET`            | Secret key for signing access JWTs           |
| `JWT_REFRESH_SECRET`    | Secret key for signing refresh JWTs          |
| `GOOGLE_CLIENT_ID`      | Google OAuth 2.0 Web Client ID               |
| `STRIPE_SECRET_KEY`     | Stripe secret key                            |
| `STRIPE_CURRENCY`       | Stripe billing currency (`bdt`)              |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary storage account name              |
| `CLOUDINARY_API_KEY`    | Cloudinary API key                           |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret                        |

---

## API Overview

All routes mounted under `/` via `app.routes.ts`:

| Prefix     | Module     | Auth               |
| ---------- | ---------- | ------------------ |
| `/auth`    | auth       | Public + Protected |
| `/user`    | user       | User role          |
| `/rider`   | rider      | Rider role         |
| `/admin`   | admin      | Admin role         |
| `/parcel`  | parcel     | Mixed              |
| `/finance` | finance    | Admin role         |
| `/support` | support    | Mixed              |
| `/public`  | public     | None               |

---

## Socket.io

- Initialized in `server.ts` alongside the HTTP server
- Event handlers in `src/socket/`
- Used for: real-time chat (`messages`), live parcel status updates for riders and users

---

## Notes

- Dual-token session model: Access tokens in Authorization header, Refresh tokens in httpOnly cookies
- Rate limiter is set to 1000 req / 15 min (intentionally high to support dashboard polling + dev)
- `logs.txt` in root is generated at runtime — not committed to git
- The project was previously named **ZapShift**; package name is now `gram2city-server`
