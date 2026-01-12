# 🎾 Blind Tennis Tournament Manager - Client

The frontend interface for the Blind Tennis Management System. Built with React and Vite, it provides a responsive and accessible UI for organizers, referees, and visually impaired players.

## 🚀 Key Features

* **🎨 Accessibility First:** Dedicated High Contrast Mode and accessible navigation structure for visually impaired users.
* **📊 Interactive Dashboards:**
    * **Organizer Panel:** Manage participants, generate brackets, and approve registrations.
    * **Referee Panel:** Real-time scoring form with validation for sets, gems, and tie-breaks.
* **⚡ Real-Time Data:** Live updates for match results and notifications using **Socket.io Client**.
* **📱 Responsive Design:** Fully functional on desktop and mobile devices.
* **🏆 Visual Brackets:** Dynamic rendering of tournament trees (Knockout phase) and group tables.

## 🛠️ Tech Stack

* **Framework:** React 18
* **Build Tool:** Vite
* **Routing:** React Router
* **Icons:** Lucide React
* **Notifications:** React-Toastify

## 📂 Project Structure

The source code is organized as follows:

* `components/` - Reusable UI elements (Forms, Tables, Cards).
* `pages/` - Full page views (Tournament Details, Dashboard, Profile).
* `contexts/` - Global state management (Auth, Theme).
* `services/` - API communication modules.
* `styles/` - Global styles and Tailwind config.

## 👥 User Roles

The interface adapts based on the user's role:
* **Guest:** View tournaments and public profiles.
* **Player:** Manage registrations and view personal schedule.
* **Guardian:** View associated player's schedule and results.
* **Referee:** Input match scores.
* **Organizer:** Full tournament administration.