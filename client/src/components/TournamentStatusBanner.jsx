// src/components/TournamentStatusBanner.jsx
import React from 'react';

/** Proste wyliczenie blokad do ponownego użycia */
export function getTournamentLocks(tournament) {
  if (!tournament) return { isHidden: false, isDeleted: false, readOnly: false, signOff: false };
  const isHidden  = tournament.status === 'hidden';
  const isDeleted = tournament.status === 'deleted';
  const readOnly  = isHidden || isDeleted;
  const signOff   = tournament.applicationsOpen === false;
  return { isHidden, isDeleted, readOnly, signOff };
}

export default function TournamentStatusBanner({ tournament, className = '' }) {
  if (!tournament) return null;

  const { isHidden, isDeleted, signOff } = getTournamentLocks(tournament);

  const flags = [];
  if (isHidden)  flags.push('Turniej jest ukryty (niewidoczny publicznie).');
  if (isDeleted) flags.push('Turniej jest oznaczony jako usunięty.');
  if (signOff)   flags.push('Zapisy są wstrzymane.');

  if (flags.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={className}
      style={{
        margin: '12px 0',
        padding: '12px 16px',
        borderRadius: 8,
        background: '#fff3cd',
        color: '#664d03',
        border: '1px solid #ffe69c',
      }}
    >
      <strong>Uwaga:</strong>
      <ul style={{ margin: '8px 0 0 20px' }}>
        {flags.map((t, i) => <li key={i}>{t}</li>)}
      </ul>
    </div>
  );
}
