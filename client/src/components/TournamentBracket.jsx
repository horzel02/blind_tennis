// src/components/TournamentBracket.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import * as matchService from '../services/matchService';
import '../styles/tournamentBracket.css';
import Breadcrumbs from '../components/Breadcrumbs';
import { socketOrigin } from '../services/api';

// mapowanie kolejnosci kolumn KO od wczesnej do finału
const ROUND_COLUMNS = [
  '1/64 finału',
  '1/32 finału',
  '1/16 finału',
  '1/8 finału',
  'Ćwierćfinał',
  'Półfinał',
  'Finał',
];

function roundKey(roundLabel = '') {
  const r = (roundLabel || '').toLowerCase();
  if (r.includes('1/64')) return 'R128';
  if (r.includes('1/32')) return 'R64';
  if (r.includes('1/16')) return 'R32';
  if (r.includes('1/8')) return 'R16';
  if (r.includes('ćwierćfina')) return 'QF';
  if (r.includes('półfina')) return 'SF';
  if (r.includes('finał')) return 'F';
  return null;
}

function roundTitleByKey(k) {
  if (k === 'R128') return '1/64 finału';
  if (k === 'R64') return '1/32 finału';
  if (k === 'R32') return '1/16 finału';
  if (k === 'R16') return '1/8 finału';
  if (k === 'QF') return 'Ćwierćfinał';
  if (k === 'SF') return 'Półfinał';
  if (k === 'F') return 'Finał';
  return 'KO';
}

function matchIndex(label = '') {
  const m = /mecz\D*([0-9]+)\s*$/i.exec(label || '');
  return m ? Number(m[1]) : null;
}

function isKO(label = '') {
  return /(1\/(8|16|32|64)\s*finału|ćwierćfinał|półfinał|finał)/i.test(label || '');
}

function resultTypeLabel(rt) {
  if (!rt || rt === 'NORMAL') return null;
  if (rt === 'WALKOVER') return 'Walkower';
  if (rt === 'DISQUALIFICATION') return 'Dyskwalifikacja';
  if (rt === 'RETIREMENT') return 'Krecz';
  return rt;
}

export default function TournamentBracket() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [tournamentName, setTournamentName] = useState(null);
  const [tourLoading, setTourLoading] = useState(true);
  const [tourErr, setTourErr] = useState('');

  const canUseScorePanel = useCallback((m) => {
    if (!user) return false;
    if (m.status !== 'scheduled' && m.status !== 'in_progress') return false;
    return m?.referee?.id === user?.id;
  }, [user]);

  const [allMatches, setAllMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  const socketRef = useRef(null);
  const joinedRoomsRef = useRef(new Set());

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await matchService.getMatchesByTournamentId(id);
      setAllMatches((data || []).filter(m => isKO(m.round)));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setTourLoading(true);
      setTourErr('');
      try {
        const res = await fetch(`${socketOrigin()}/api/tournaments/${id}`, { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Nie udało się pobrać turnieju');
        if (alive) setTournamentName(data?.name || null);
      } catch (e) {
        if (alive) { setTournamentName(null); setTourErr(e.message || 'Err'); }
      } finally {
        if (alive) setTourLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    try { socketRef.current?.disconnect(); } catch {}

    let s;
    try {
      s = io(socketOrigin(), {
        withCredentials: true,
        transports: ['websocket', 'polling'],
      });
    } catch (e) {
      console.error('bracket socket init failed', e);
      return;
    }

    socketRef.current = s;

    const tid = parseInt(String(id), 10);
    s.emit('join-tournament', tid);

    s.on('connect_error', (err) => {
      console.warn('bracket socket connect_error', err?.message || err);
    });

    const onStatus = () => fetchAll();

    const onUpdated = (updated) => {
      setAllMatches(prev => {
        const idx = prev.findIndex(x => x.id === updated.id);
        if (!isKO(updated.round)) {
          if (idx !== -1) {
            const copy = [...prev]; copy.splice(idx, 1); return copy;
          }
          return prev;
        }
        if (idx !== -1) { const copy = [...prev]; copy[idx] = updated; return copy; }
        return [...prev, updated];
      });
    };

    const onInvalidate = () => fetchAll();

    const onLive = ({ matchId, sets }) => {
      setAllMatches(prev =>
        prev.map(m =>
          m.id === matchId
            ? {
              ...m,
              matchSets: Array.isArray(sets)
                ? sets.map((x, i) => ({
                  setNumber: i + 1,
                  player1Score: Number(x.player1Score ?? x.player1 ?? x.p1 ?? 0),
                  player2Score: Number(x.player2Score ?? x.player2 ?? x.p2 ?? 0),
                }))
                : [],
            }
            : m
        )
      );
    };

    s.on('match-status-changed', onStatus);
    s.on('match-updated', onUpdated);
    s.on('matches-invalidate', onInvalidate);
    s.on('real-time-score-update', onLive);

    return () => {
      try { s.emit('leave-tournament', tid); } catch {}
      try {
        for (const mid of joinedRoomsRef.current) s.emit('leave-match', mid);
      } catch {}
      joinedRoomsRef.current.clear();

      s.off('match-status-changed', onStatus);
      s.off('match-updated', onUpdated);
      s.off('matches-invalidate', onInvalidate);
      s.off('real-time-score-update', onLive);

      try { s.disconnect(); } catch {}
      if (socketRef.current === s) socketRef.current = null;
    };
  }, [id, fetchAll]);

  useEffect(() => {
    const s = socketRef.current;
    if (!s) return;
    const currentIds = new Set(allMatches.map(m => m.id));
    const joined = joinedRoomsRef.current;

    for (const mid of currentIds) {
      if (!joined.has(mid)) { s.emit('join-match', mid); joined.add(mid); }
    }
    for (const mid of Array.from(joined)) {
      if (!currentIds.has(mid)) { s.emit('leave-match', mid); joined.delete(mid); }
    }
  }, [allMatches]);

  const columns = useMemo(() => {
    const buckets = new Map();
    for (const m of allMatches) {
      const k = roundKey(m.round);
      const title = roundTitleByKey(k);
      if (!buckets.has(title)) buckets.set(title, []);
      buckets.get(title).push(m);
    }
    for (const [, arr] of buckets) {
      arr.sort((a, b) => {
        const ai = matchIndex(a.round);
        const bi = matchIndex(b.round);
        if (ai != null && bi != null) return ai - bi;
        if (ai != null) return -1;
        if (bi != null) return 1;
        return a.id - b.id;
      });
    }
    return ROUND_COLUMNS
      .map(title => [title, buckets.get(title) || []])
      .filter(([, arr]) => arr.length > 0);
  }, [allMatches]);

  const renderPlayer = (p, isWinner) => (
    <div className={`br-player ${isWinner ? 'winner' : ''}`}>
      {p ? `${p.name} ${p.surname}` : 'TBD'}
    </div>
  );

  const renderScore = (m) => {
    if (!m.matchSets || m.matchSets.length === 0) return null;
    return (
      <div className="br-score">
        {m.matchSets.map(s => `${s.player1Score}-${s.player2Score}`).join(', ')}
      </div>
    );
  };

  const renderScheduleChip = (m) => {
    if (!m.matchTime) return null;
    const when = new Date(m.matchTime).toLocaleString();
    const court = m.courtNumber ? `• Kort ${m.courtNumber}` : '';
    const dur = m.durationMin ? `• ${m.durationMin}’` : '';
    return <div className="pill pill-time">{when} {court} {dur}</div>;
  };

  const renderAdminBadge = (m) => {
    if (m.status !== 'finished') return null;
    const txt = resultTypeLabel(m.resultType);
    if (!txt) return null;
    return <div className="pill pill-admin">{txt}</div>;
  };

  const goToScorePanel = (m) => navigate(`/match-score-panel/${m.id}`);

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    {
      label: tournamentName ? `Turniej: ${tournamentName}` : `Turniej #${id}`,
      href: `/tournaments/${id}/details`,
    },
    { label: 'Drabinka pucharowa' },
  ];

  return (
    <section className="br-section">
      <Breadcrumbs items={breadcrumbItems} />
      <div className="br-header">
        <h2>Drabinka pucharowa</h2>
        <div className="br-legend">
          <span className="pill pill-scheduled">Zaplanowany</span>
          <span className="pill pill-live">W trakcie</span>
          <span className="pill pill-done">Zakończony</span>
        </div>
      </div>

      {tourErr && <p className="error">Błąd turnieju: {tourErr}</p>}

      {loading ? (
        <p>Ładowanie…</p>
      ) : columns.length === 0 ? (
        <p>Brak meczów fazy pucharowej.</p>
      ) : (
        <div
          className="br-grid"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(260px, 1fr))` }}
        >
          {columns.map(([title, list]) => (
            <div key={title} className="br-col">
              <div className="br-col-title">{title}</div>
              <div className="br-col-matches">
                {list.map(m => {
                  const live = m.status === 'in_progress';
                  const finished = m.status === 'finished';
                  const wId = m.winner?.id;
                  return (
                    <div key={m.id} className={`br-match ${live ? 'live' : ''} ${finished ? 'finished' : ''}`}>
                      <div className="br-round">{m.round}</div>

                      {renderScheduleChip(m)}

                      <div className="br-players">
                        {renderPlayer(m.player1, wId && m.player1 && wId === m.player1.id)}
                        {renderPlayer(m.player2, wId && m.player2 && wId === m.player2.id)}
                      </div>

                      {renderScore(m)}
                      {renderAdminBadge(m)}

                      <div className="br-footer">
                        {live && <span className="live-dot" aria-label="live" />}
                        {finished && wId && (
                          <span className="winner-badge">
                            {m.winner.name} {m.winner.surname}
                          </span>
                        )}
                        {canUseScorePanel(m) && (
                          <button className="br-btn" onClick={() => goToScorePanel(m)}>
                            Panel wyniku
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
