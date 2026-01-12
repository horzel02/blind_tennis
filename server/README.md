# 🎾 Blind Tennis Tournament Manager - Server API

The backend REST API and WebSocket server for the Blind Tennis Tournament Management System. This application handles tournament logic, user authentication, real-time match scoring, and database management.

## 🚀 Key Features

* **🏆 Tournament Management:** Logic for creating tournaments, generating group phases, and building knockout brackets (with auto-seeding and BYEs support).
* **🔐 Authentication & RBAC:** Session-based authentication using **Passport.js**. Role-Based Access Control distinguishing between Global Roles (Admin, Moderator) and Tournament Roles (Organizer, Referee, Participant).
* **⚡ Real-Time Updates:** Implemented via **Socket.io** to synchronize match scores and notifications instantly across all connected clients.
* **📅 Auto-Scheduling:** Algorithm ("Auto-plan") that automatically assigns match times and courts based on resource availability.
* **👥 Guardian System:** Specialized support for linking visually impaired players with their guardians.

## 🛠️ Tech Stack

* **Runtime:** Node.js
* **Framework:** Express.js
* **Database:** PostgreSQL
* **ORM:** Prisma
* **Real-time:** Socket.io
* **Security:** Bcrypt (hashing), CORS, Helmet

## 📂 Project Structure

* `controllers/` - Request logic and response handling.
* `services/` - Business logic (brackets generation, scoring rules).
* `routes/` - API endpoint definitions.
* `prisma/` - Database schema and migration files.
* `middlewares/` - Auth verification and error handling.

## 🔌 API Endpoints Overview

The API is organized into several modules:

* **Auth:** `/api/auth` (Login, Register, Profile)
* **Tournaments:** `/api/tournaments` (CRUD, Settings, Generators)
* **Matches:** `/api/matches` (Scoring, Scheduling)
* **Users:** `/api/users` & `/api/admin/users`
* **Notifications:** `/api/notifications`
