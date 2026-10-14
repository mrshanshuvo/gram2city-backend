# Backend Requirements — Gram2City

Upgrade your existing backend into a feature-rich, production-ready, and professional API service.

## 1. Stack Requirements

- **Framework**: Express (Express 5 TypeScript backend)
- **Database**: MongoDB / PostgreSQL / MySQL (Gram2City uses MongoDB native driver)
- **ODM / Driver**: Native driver or ODM (Mongoose) / ORM (Prisma)

## 2. Architecture & Organization

- Modular structure (Feature-based module folders with router, controller, service)
- API route separation
- Centralized error handling
- Proper HTTP status code usage (200, 201, 400, 401, 403, 404, 500)

## 3. Database

- Proper schema planning
- Relationships (if needed)

## 4. Security & Authentication

- Password hashing (bcryptjs)
- Native JWT dual-token authentication (Access + httpOnly Refresh)
- Input validation (Zod schemas on request body/query)
- CORS configuration
- Role-based access control (User / Rider / Admin / Merchant)

## 5. Server-Side Validation & Form Handling

- Server-side validation for all incoming payloads:
  - Login
  - Registration
  - Contact
  - Create item / parcel
  - Edit item / parcel
  - Profile update

## 6. Code Quality Rules

- Clean and organized folder structure
- Proper environment variable usage (`.env` typed/validated)
- No console logs in production
- Centralized logging middleware (e.g. Morgan)

## 7. Final Submission Requirements (Backend context)

- GitHub Repository Link (Backend)
- Deployed API / Server URL
- Demo Credentials (User Email & Password, Admin Email & Password)
