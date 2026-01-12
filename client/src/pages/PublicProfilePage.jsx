// client/src/pages/PublicProfilePage.jsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Users, Activity, Calendar, Share2 } from 'lucide-react';
import { getPublicProfile } from '../services/publicProfileService';
import '../styles/publicProfile.css';

function formatDate(dateLike) {
  if (!dateLike) return '—';
  const d = new Date(dateLike);
  return d.toLocaleDateString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit' });
}
function formatTimeNoSeconds(dateLike) {
  if (!dateLike) return '';
  const d = new Date(dateLike);
  return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}
function formatDateTimeNoSeconds(dateLike) {
  if (!dateLike) return '—';
  const d = new Date(dateLike);
  return `${formatDate(d)} ${formatTimeNoSeconds(d)}`;
}

// Helper do tłumaczenia płci
function genderPL(g) {
  if (!g) return '';
  const s = String(g).toLowerCase();
  if (s === 'male') return 'Mężczyzna';
  if (s === 'female') return 'Kobieta';
  return g; // fallback
}

export default function PublicProfilePage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    setLoading(true);
    getPublicProfile(id)
      .then(setData)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="container"><p>Ładowanie profilu…</p></div>;
  if (err) return <div className="container"><p className="error">{err}</p></div>;
  if (!data) return <div className="container"><p>Profil nie znaleziony.</p></div>;

  const { user, summary, upcoming, timeline } = data;

  const initials = `${(user.name || '')[0] || ''}${(user.surname || '')[0] || ''}`.toUpperCase();
  const displayName = `${user.name} ${user.surname}`;

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Link skopiowany do schowka');
  };

  return (
    <section className="container profile-container">
      {/* Header */}
      <header className="profile-header">
        <div className="avatar" aria-label={`Avatar ${displayName}`}>{initials}</div>
        <div className="header-main">
          <h1 className="profile-name">{displayName}</h1>
          <div className="profile-meta">
            <span>Preferowana kategoria: <strong>{user.preferredCategory || '—'}</strong></span>
            {/* ZMIANA TUTAJ: użycie genderPL */}
            {user.gender ? <span>• Płeć: <strong>{genderPL(user.gender)}</strong></span> : null}
          </div>
        </div>
        <button onClick={copyLink} className="btn-secondary share-btn">
          <Share2 size={16} /> Udostępnij
        </button>
      </header>

      {/* Statystyki + Nadchodzące */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header"><Users size={16} /> Statystyki</div>
          <div className="card-body">
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-value">{summary.matchesAsPlayer}</div>
                <div className="stat-label">Mecze (zawodnik)</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{summary.wins}</div>
                <div className="stat-label">Wygrane</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{summary.losses}</div>
                <div className="stat-label">Przegrane</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{summary.winRate}%</div>
                <div className="stat-label">Win rate</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{summary.matchesAsReferee}</div>
                <div className="stat-label">Sędziowane</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{summary.tournamentsTotal}</div>
                <div className="stat-label">Turnieje</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><Calendar size={16} /> Nadchodzące</div>
          <div className="card-body upcoming-grid">
            <div>
              <div className="section-subtitle">Jako zawodnik</div>
              {upcoming.asPlayer.length === 0 ? (
                <div className="muted">Brak</div>
              ) : upcoming.asPlayer.map(t => (
                <div key={t.id} className="upcoming-row">
                  <Link to={`/tournaments/${t.id}/details`} className="link-strong">{t.name}</Link>
                  <span className="muted"> — {formatDate(t.start_date)}{t.city ? ` • ${t.city}` : ''}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="section-subtitle">Jako sędzia</div>
              {upcoming.asReferee.length === 0 ? (
                <div className="muted">Brak</div>
              ) : upcoming.asReferee.map(m => (
                <div key={m.id} className="upcoming-row">
                  <Link to={`/tournaments/${m.tournamentId}/details`} className="link-strong">{m.tournamentName}</Link>
                  <span className="muted">
                    {' '}— {m.matchTime ? formatDateTimeNoSeconds(m.matchTime) : 'plan bez godziny'} • {m.round || 'Mecz'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header"><Activity size={16} /> Ostatnia aktywność</div>
        <div className="card-body">
          {timeline.length === 0 ? (
            <div className="muted">Brak aktywności</div>
          ) : (
            <ul className="timeline-list">
              {timeline.map((e, idx) => (
                <li key={idx} className="timeline-item">
                  <span className="muted">{formatDateTimeNoSeconds(e.date)}</span>{' '}
                  <strong>{e.role === 'player' ? 'Zawodnik' : 'Sędzia'}</strong>{' '}
                  — {e.tournament?.id ? (
                    <Link to={`/tournaments/${e.tournament.id}/details`} className="link-strong">
                      {e.tournament.name}
                    </Link>
                  ) : (e.tournament?.name || 'Turniej')}
                  {e.round ? ` • ${e.round}` : ''}
                  {e.players?.length === 2 && (
                    <> • {e.players[0]?.name} {e.players[0]?.surname} vs {e.players[1]?.name} {e.players[1]?.surname}</>
                  )}
                  {e.score ? <> • wynik: {e.score}</> : null}
                  {e.role === 'player' && typeof e.winnerId === 'number' ? (
                    <> • {e.winnerId === Number(id) ? 'W' : 'L'}</>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}