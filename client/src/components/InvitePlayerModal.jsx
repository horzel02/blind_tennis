// src/components/InvitePlayerModal.jsx
import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { searchUsers } from '../services/userService';
import '../styles/invitePlayer.css';

export default function InvitePlayerModal({
  isOpen,
  onClose,
  onSelectUser,
  existingIds = new Set(),
  title = 'Wybierz użytkownika',
  placeholder = 'Szukaj po nazwisku lub e-mailu…'
}) {
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!query) return setResults([]);
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const users = await searchUsers(query);
        setResults(users.filter(u => !existingIds.has(u.id)));
      } catch (e) {
        toast.error('Błąd wyszukiwania');
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, existingIds]);

  const handleAdd = async () => {
    if (!selected) return;
    try {
      await onSelectUser(selected);
      onClose();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (!isOpen) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h2>{title}</h2>
        <input
          className="modal-input"
          placeholder={placeholder}
          value={query}
          onChange={e => { setQuery(e.target.value); setSelected(null); }}
          autoFocus
        />
        {loading ? (
          <p>Ładowanie…</p>
        ) : (
          <ul className="list">
            {results.length ? results.map(u => (
              <li
                key={u.id}
                className={`list-item ${selected?.id === u.id ? 'selected' : ''}`}
                onClick={() => setSelected(u)}
              >
                {u.name} {u.surname} ({u.email})
              </li>
            )) : (
              <li>Brak wyników</li>
            )}
          </ul>
        )}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Anuluj</button>
          <button
            className="btn btn-primary"
            disabled={!selected}
            onClick={handleAdd}
          >
            Dodaj
          </button>
        </div>
      </div>
    </div>
  );
}
