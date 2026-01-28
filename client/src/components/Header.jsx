// Header.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Home,
  List,
  PlusSquare,
  LogIn,
  UserPlus,
  User,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import '../styles/header.css';
import SidebarMenu from './SidebarMenu';
import NotificationBell from './NotificationBell';
import HighContrastToggle from './HighContrastToggle';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const profileHref = user ? `/u/${user.id}` : '/login';

  const toggleSidebar = () => setSidebarOpen(prev => !prev);

  const handleLogout = async () => {
    try {
      await logout();
      setSidebarOpen(false);
      window.location.replace('/');
      toast.success('Wylogowano pomyślnie');
    } catch (err) {
      console.error(err);
      toast.error('Wystąpił błąd podczas wylogowywania.');
    }
  };

  return (
    <nav role="navigation" aria-label="Główne menu" className="header">
      <div className="header-inner">
        <Link to="/" className="header-logo">
          <span className="header-logo-icon">🎾</span>
          <span className="header-logo-text">Blind Tennis</span>
        </Link>

        <div className="header-nav">
          <Link to="/" className="icon-button" aria-label="Strona główna">
            <Home size={24} color="#fff" />
            <span className="tooltip">Strona główna</span>
          </Link>

          <Link to="/tournaments" className="icon-button" aria-label="Lista turniejów">
            <List size={24} color="#fff" />
            <span className="tooltip">Lista turniejów</span>
          </Link>

          <Link to="/tournaments/new" className="icon-button" aria-label="Dodaj turniej">
            <PlusSquare size={24} color="#fff" />
            <span className="tooltip">Dodaj turniej</span>
          </Link>

          {user && <NotificationBell />}

          <HighContrastToggle />

          {user ? (
            <div className="user-menu">
              <button
                type="button"
                className="icon-button"
                aria-label="Menu użytkownika"
                onClick={toggleSidebar}
              >
                <User size={24} color="#fff" />
                <span className="tooltip">Twoje konto</span>
              </button>
            </div>
          ) : (
            <>
              <Link to="/login" className="icon-button" aria-label="Zaloguj się">
                <LogIn size={24} color="#fff" />
                <span className="tooltip">Zaloguj się</span>
              </Link>

              <Link to="/register" className="icon-button" aria-label="Zarejestruj się">
                <UserPlus size={24} color="#fff" />
                <span className="tooltip">Zarejestruj się</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {user && (
        <SidebarMenu
          isOpen={sidebarOpen}
          onClose={toggleSidebar}
          title="Twoje Konto"
          user={user}
        >
          <div className="sidebar-user-info">
            {user.profilePictureUrl ? (
              <img src={user.profilePictureUrl} alt="Awatar użytkownika" className="sidebar-avatar" />
            ) : (
              <div className="sidebar-avatar-placeholder">
                <User size={40} color="#fff" />
              </div>
            )}
            <p className="sidebar-username">
              {user.name && user.surname
                ? `${user.name} ${user.surname}`
                : user.username || "Użytkownik"}
            </p>
            {user.email && <p className="sidebar-email">{user.email}</p>}
          </div>

          <div className="sidebar-section-title">Nawigacja</div>
          <Link to={profileHref} onClick={toggleSidebar}>Profil</Link>
          <Link to="/tournaments/mine" onClick={toggleSidebar}>Moje turnieje</Link>
          <Link to="/registrations/mine" onClick={toggleSidebar}>Moje zgłoszenia</Link>
          <Link to="/timetable" onClick={toggleSidebar}>Terminarz</Link>
          <Link to="/account" onClick={toggleSidebar}>Moje konto</Link>
          {(() => {
            const appRoles = user?.appRoles || [];
            const isPriv = user?.role === 'admin'
              || user?.role === 'moderator'
              || appRoles.includes('admin')
              || appRoles.includes('moderator');
            if (!isPriv) return null;
            return (
              <>
                <div className="sidebar-section-title">Administracja</div>
                <Link to="/admin" onClick={toggleSidebar}>Panel administracyjny</Link>
              </>
            );
          })()}



          <button onClick={handleLogout} className="logout-btn">Wyloguj</button>
        </SidebarMenu>
      )}
    </nav>
  );
}
