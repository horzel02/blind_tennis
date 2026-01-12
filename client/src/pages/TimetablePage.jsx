// client/src/pages/TimetablePage.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import Breadcrumbs from '../components/Breadcrumbs';
import * as userTimetableService from '../services/userTimetableService';
import '../styles/timetable.css';
import { socketOrigin } from '../services/api';


const s = io(socketOrigin(), { withCredentials: true });

function fmtDT(dt) {
  try {
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString(undefined, {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return null; }
}

function resultBadge(m) {
  if (m?.resultType && m.resultType !== 'NORMAL') {
    const map = { WALKOVER: 'Walkower', DISQUALIFICATION: 'Dyskwalifikacja', RETIREMENT: 'Krecz' };
    return <span className="sl-badge sl-badge--admin">{map[m.resultType] || m.resultType}</span>;
  }
  return null;
}

function statusBadge(m) {
  if (m.status === 'in_progress') return <span className="sl-badge sl-badge--live">LIVE</span>;
  if (m.status === 'finished') return <span className="sl-badge sl-badge--done">Zakończony</span>;
  return <span className="sl-badge">Zaplanowany</span>;
}

function scoreLine(m) {
  if (!m?.matchSets?.length) return null;
  const s = m.matchSets.map(x => `${x.player1Score}-${x.player2Score}`).join(', ');
  return <div className="sl-score">{s}</div>;
}

export default function TimetablePage() {
  const { user } = useAuth();
  const [role, setRole] = useState('player');
  const [state, setState] = useState('upcoming');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const socketRef = useRef(null);
  const sentinelRef = useRef(null);

  const breadcrumbItems = useMemo(() => ([
    { label: 'Home', href: '/' },
    { label: 'Terminarz' },
  ]), []);

  const fetchList = useCallback(async (reset = false) => {
    if (!user) return;
    if (reset) { setLoading(true); setPage(1); }
    try {
      const resp = await userTimetableService.getMyMatches({
        role, state, page: reset ? 1 : page, limit: 20
      });
      if (reset) {
        setItems(resp.items || []);
      } else {
        setItems(prev => [...prev, ...(resp.items || [])]);
      }
      setTotal(resp.total || 0);
    } finally {
      if (reset) setLoading(false);
      setLoadingMore(false);
    }
  }, [user, role, state, page]);

  // initial + role/state change
  useEffect(() => {
    setPage(1);
    fetchList(true);
  }, [role, state, fetchList]);

  // pagination (infinite)
  useEffect(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver((entries) => {
      const ent = entries[0];
      if (ent.isIntersecting && !loading && !loadingMore) {
        const canMore = items.length < total;
        if (!canMore) return;
        setLoadingMore(true);
        setPage(p => p + 1);
      }
    }, { rootMargin: '200px' });

    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [items.length, total, loading, loadingMore]);

  useEffect(() => {
    if (page > 1) fetchList(false);
  }, [page, fetchList]);

  // sockets: prosty invalidator listy
  useEffect(() => {
    const s = io(API_URL, { withCredentials: true });
    socketRef.current = s;
    const invalidate = () => fetchList(true);
    s.on('match-updated', invalidate);
    s.on('matches-invalidate', invalidate);
    s.on('match-status-changed', invalidate);

    return () => {
      s.off('match-updated', invalidate);
      s.off('matches-invalidate', invalidate);
      s.off('match-status-changed', invalidate);
      s.disconnect();
    };
  }, [fetchList]);

  const emptyText = useMemo(() => {
    if (state === 'upcoming') return 'Brak nadchodzących meczów.';
    if (state === 'live') return 'Brak meczów w trakcie.';
    return 'Brak zakończonych meczów.';
  }, [state]);

  const renderOpponent = (m) => {
    const A = m.player1 ? `${m.player1.name} ${m.player1.surname}` : 'TBD';
    const B = m.player2 ? `${m.player2.name} ${m.player2.surname}` : 'TBD';

    if (role === 'referee') {
      return `${A} vs ${B}`;
    }
    if (role === 'guardian') {
      // jeśli backend zwraca ward/wardId, pokaż chip
      const wardName =
        (m.ward && `${m.ward.name} ${m.ward.surname}`) ||
        (m.wardPlayer && `${m.wardPlayer.name} ${m.wardPlayer.surname}`) ||
        null;

      return (
        <>
          {A} vs {B}
          {wardName ? <span className="sl-chip sl-chip--muted" style={{ marginLeft: 6 }}>podopieczny: {wardName}</span> : null}
        </>
      );
    }
    // role === 'player'
    const meId = user?.id;
    const opp = (m.player1 && m.player1.id !== meId) ? m.player1 : (m.player2 && m.player2.id !== meId) ? m.player2 : null;
    return opp ? `Twój przeciwnik: ${opp.name} ${opp.surname}` : 'Przeciwnik: TBD';
  };

  const onClickRow = (m) => {
    window.location.href = `/tournaments/${m.tournamentId}/details`;
  };

  return (
    <section className="schedule-shell container">
      <Breadcrumbs items={breadcrumbItems} />
      <div className="schedule-head">
        <h2>Terminarz</h2>
        <div className="schedule-tabs">
          <div className="st-group">
            <button className={`st-tab ${role === 'player' ? 'active' : ''}`} onClick={() => setRole('player')}>
              Jako zawodnik
            </button>
            <button className={`st-tab ${role === 'referee' ? 'active' : ''}`} onClick={() => setRole('referee')}>
              Jako sędzia
            </button>
            <button className={`st-tab ${role === 'guardian' ? 'active' : ''}`} onClick={() => setRole('guardian')}>
              Jako opiekun
            </button>
          </div>
          <div className="st-group">
            <button className={`st-tab ${state === 'upcoming' ? 'active' : ''}`} onClick={() => setState('upcoming')}>
              Nadchodzące
            </button>
            <button className={`st-tab ${state === 'live' ? 'active' : ''}`} onClick={() => setState('live')}>
              W trakcie
            </button>
            <button className={`st-tab ${state === 'finished' ? 'active' : ''}`} onClick={() => setState('finished')}>
              Zakończone
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="sl-empty">Ładowanie…</div>
      ) : items.length === 0 ? (
        <div className="sl-empty">{emptyText}</div>
      ) : (
        <div className="schedule-list">
          {items.map((m) => {
            const dt = m.matchTime ? fmtDT(m.matchTime) : null;
            const court = m.courtNumber ? ` • Kort ${m.courtNumber}` : '';
            const dur = m.durationMin ? ` • ${m.durationMin}’` : '';
            return (
              <div key={m.id} className="schedule-item" role="button" tabIndex={0}
                   onClick={() => onClickRow(m)}
                   onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClickRow(m)}>
                <div className="sl-left">
                  <div className="sl-title">{m.tournament?.name || `Turniej #${m.tournamentId}`}</div>
                  <div className="sl-sub">
                    <span className="sl-round">{m.round}</span>
                    {m.tournament?.category && (
                      <span className="sl-tourmeta"> • {m.tournament.category}</span>
                    )}
                  </div>
                  <div className="sl-opponent">{renderOpponent(m)}</div>
                </div>

                <div className="sl-meta">
                  {dt ? (
                    <span className="sl-chip">📅 {dt}{court}{dur}</span>
                  ) : (
                    <span className="sl-chip sl-chip--muted">Termin: TBA</span>
                  )}
                  {statusBadge(m)}
                  {resultBadge(m)}
                </div>

                <div className="sl-right">
                  {scoreLine(m)}
                  {m.status === 'in_progress' && <span className="live-dot" aria-label="live" />}
                </div>
              </div>
            );
          })}
          <div ref={sentinelRef} style={{ height: 1 }} />
          {loadingMore && <div className="sl-loading-more">Ładowanie…</div>}
        </div>
      )}
    </section>
  );
}
