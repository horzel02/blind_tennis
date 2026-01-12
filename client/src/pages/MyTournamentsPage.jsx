// client/src/pages/MyTournamentsPage.jsx
import React, { useEffect, useState } from 'react';
import { getMyTournaments } from '../services/tournamentService';
import TournamentList from '../components/TournamentList';

export default function MyTournamentsPage() {
  const [tours, setTours]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    getMyTournaments()
      .then(data => setTours(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p aria-live="polite">Ładowanie Twoich turniejów…</p>;
  if (error)   return <p className="error">Błąd: {error}</p>;
  if (!tours.length) return <p>Nie utworzyłeś jeszcze żadnych turniejów.</p>;

  return (
    <TournamentList 
      title="Moje turnieje"
      initialTournaments={tours}
      showCreateButton={false}
    />
  );
}
