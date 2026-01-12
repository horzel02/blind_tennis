// SidebarMenu.jsx
import React, { useRef, useEffect } from 'react';
import '../styles/sidebarMenu.css';
import { X } from 'lucide-react';

// Komponent ikony "X"
const CloseIcon = ({ size = 24, color = "currentColor" }) => (
  <X size={size} color={color} />
);

const SidebarMenu = ({ isOpen, onClose, title, user, children }) => {
  const menuRef = useRef();

  // Obsługa kliknięcia poza menu, aby je zamknąć
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target) && isOpen) {
        onClose();
      }
    };

    // Obsługa klawisza ESC
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
      }, 100);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <div className={`sidebar-menu-overlay${isOpen ? ' open' : ''}`}>
      <div className="sidebar-menu-panel" ref={menuRef}>
        <div className="sidebar-menu-header">
          <h3>{title || "Menu"}</h3>
          <button className="sidebar-menu-close-btn" onClick={onClose} aria-label="Zamknij menu">
            <CloseIcon />
          </button>
        </div>
        <div className="sidebar-menu-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default SidebarMenu;