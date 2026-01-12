// client/src/components/TournamentCard.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/tournamentCard.css';
import {
  getCategoryChips,
  getGenderChips,
  genderLabelPL,
} from '../utils/tournamentMeta';

export default function TournamentCard({ tournament }) {
  const navigate = useNavigate();
  const { id, name, start_date, end_date, city, applicationsOpen, type } = tournament;

  const catChips = getCategoryChips(tournament);
  const genderChips = getGenderChips(tournament);
  const catLabel = catChips[0] || '—';
  const genderLabel = genderChips.length ? genderLabelPL(genderChips[0]) : '—';
  const formulaLabel = ({
    towarzyski: 'Towarzyski',
    mistrzowski: 'Mistrzowski'
  })[tournament.formula] || 'Open';
  const isInviteOnly = type === 'invite';
  const statusLabel = isInviteOnly
    ? 'Tylko na zaproszenie'
    : applicationsOpen
      ? 'Przyjmowanie zgłoszeń'
      : hasLimit
        ? 'Brak miejsc'
        : 'Zamknięte zgłoszenia';

  return (
    <article className="card" tabIndex="0" role="region" aria-labelledby={`tour-${id}-title`}>
      <h2 id={`tour-${id}-title`} className="card-title">{name}</h2>

      {/* pigułki */}
      <div className="pills">
        <span className="pill">{genderLabel}</span>
        <span className="pill">{catLabel}</span>
        <span className="pill pill-soft">{formulaLabel}</span>
      </div>

      <p className="card-date">
        {new Date(start_date).toLocaleDateString()} – {new Date(end_date).toLocaleDateString()}
      </p>

      {city && <p className="card-location">Lokalizacja: {city}</p>}
      <p className={`card-meta ${applicationsOpen ? 'open' : 'closed'}`}>
        {statusLabel}
      </p>

      <div className="card-actions">
        <button onClick={() => navigate(`/tournaments/${id}/details`)} className="btn-secondary">
          Szczegóły
        </button>
      </div>
    </article>
  );
}
