// client/src/components/Layout.jsx
import React from 'react';
import { useLocation } from 'react-router-dom'; // 1. Importujemy useLocation
import Header from './Header';
import Footer from './Footer';

export default function Layout({ children }) {
  const location = useLocation(); // 2. Pobieramy aktualny adres

  // 3. Sprawdzamy, czy jesteśmy na stronie, która wymaga pełnej szerokości.
  // 'manage' - bo tam są tabele zgłoszeń
  // 'bracket' - bo drabinki są szerokie
  // 'admin' - główny panel admina
  const isWidePage = 
    location.pathname.includes('/manage/') || 
    location.pathname.includes('/bracket') ||
    location.pathname.includes('/admin');

  return (
    <div className="app-shell">
      <header role="banner">
        <Header />
      </header>

      {/* 4. Warunkowa klasa: jeśli strona ma być szeroka -> container-fluid, w przeciwnym razie zwykły container */}
      <main 
        role="main" 
        className={isWidePage ? "container-fluid" : "container"} 
        style={{ paddingTop: '80px', paddingBottom: '2rem' }}
      >
        {children}
      </main>

      <footer role="contentinfo">
        <Footer />
      </footer>
    </div>
  );
}