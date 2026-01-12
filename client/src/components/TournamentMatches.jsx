// src/components/TournamentMatches.jsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { socketOrigin } from '../services/api';

import * as matchService from '../services/matchService';
import * as tournamentService from '../services/tournamentService';
import * as roleService from '../services/tournamentUserRoleService';

import ScheduleMatchModal from '../components/ScheduleMatchModal';
import AutoScheduleModal from '../components/AutoScheduleModal';

import TournamentStatusBanner, { getTournamentLocks } from '../components/TournamentStatusBanner';

import '../styles/tournamentMatches.css';

/* ============================================================================
 *  KONFIG
 * ========================================================================== */


const TABS = {
  scheduled: 'Zaplanowane',
  in_progress: 'W trakcie',
  finished: 'Zakończone',
};

const isKO = (round = '') =>
  /(1\/(8|16|32|64)\s*finału|ćwierćfinał|półfinał|finał)/i.test(round);

const ROUND_ORDER = [
  'Grupa',
  '1/64 finału',
  '1/32 finału',
  '1/16 finału',
  '1/8 finału',
  'Ćwierćfinał',
  'Półfinał',
  'Finał',
];

const KO_BASES = ['1/64', '1/32', '1/16', '1/8', 'Ćwierćfinał', 'Półfinał', 'Finał'];
const baseRoundName = (label = '') => {
  const s = String(label).toLowerCase();
  if (s.includes('1/64')) return '1/64';
  if (s.includes('1/32')) return '1/32';
  if (s.includes('1/16')) return '1/16';
  if (s.includes('1/8')) return '1/8';
  if (s.includes('ćwierćfina')) return 'Ćwierćfinał';
  if (s.includes('półfina')) return 'Półfinał';
  if (s.includes('finał')) return 'Finał';
  return null;
};

/* ============================================================================
 *  KOMPONENT
 * ========================================================================== */

export default function TournamentMatches({ roles: rolesProp = [] }) {
  const { id } = useParams();
  const tournamentId = Number(id);
  const { user } = useAuth();
  const navigate = useNavigate();

  // lista / stan
  const [activeTab, setActiveTab] = useState('scheduled');
  const [matches, setMatches] = useState([]);
  const [groupedMatches, setGroupedMatches] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ustawienia turnieju (format itp.)
  const [settings, setSettings] = useState(null);
  const [tournament, setTournament] = useState(null);

  // reset KO
  const [resetFrom, setResetFrom] = useState('');
  const [alsoKO, setAlsoKO] = useState(true);
  const [resetBusy, setResetBusy] = useState(false);

  // wybór meczów
  const [selected, setSelected] = useState(() => new Set());

  // modal: przypisywanie sędziego z puli
  const [refModalOpen, setRefModalOpen] = useState(false);
  const [referees, setReferees] = useState([]);
  const [refSearch, setRefSearch] = useState('');
  const [chosenRef, setChosenRef] = useState(null);
  const [refLoading, setRefLoading] = useState(false);

  // modal: parowanie KO
  const [pairingOpen, setPairingOpen] = useState(false);
  const [pairingMatch, setPairingMatch] = useState(null);
  const [eligible, setEligible] = useState([]);
  const [p1User, setP1User] = useState(null);
  const [p2User, setP2User] = useState(null);
  const [p1Query, setP1Query] = useState('');
  const [p2Query, setP2Query] = useState('');
  const [p1Open, setP1Open] = useState(false);
  const [p2Open, setP2Open] = useState(false);
  const p1ComboRef = useRef(null);
  const p2ComboRef = useRef(null);

  const [openSchedule, setOpenSchedule] = useState(false);
  const [targetMatch, setTargetMatch] = useState(null);

  const [openAuto, setOpenAuto] = useState(false);

  // sockets
  const socketRef = useRef(null);
  const joinedRoomsRef = useRef(new Set());
  const invalidateTimerRef = useRef(null);

  // role (z props)
  const roles = Array.isArray(rolesProp) ? rolesProp : [];

  const isTournyOrg = useMemo(
    () => !!user && roles.some(r => r.role === 'organizer' && r.user?.id === user.id),
    [roles, user]
  );
  const isTournyReferee = useMemo(
    () => !!user && roles.some(r => r.role === 'referee' && r.user?.id === user.id),
    [roles, user]
  );

  const locks = useMemo(() => getTournamentLocks(tournament || {}), [tournament]);
  const { readOnly } = locks;

  const canScore = useCallback(
    (match) => !!user && isTournyReferee && match?.referee?.id === user.id && !readOnly,
    [user, isTournyReferee, readOnly]
  );

  const fmtDT = v =>
    v ? new Date(v).toLocaleString('pl-PL', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    }) : null;

  useEffect(() => {
    const s = socketRef.current;
    if (!s) return;

    const now = new Set(matches.map(m => m.id));

    for (const mid of now) {
      if (!joinedRoomsRef.current.has(mid)) {
        s.emit('join-match', mid);
        joinedRoomsRef.current.add(mid);
      }
    }
    for (const mid of [...joinedRoomsRef.current]) {
      if (!now.has(mid)) {
        s.emit('leave-match', mid);
        joinedRoomsRef.current.delete(mid);
      }
    }
  }, [matches]);

  // ustawienia + detale turnieju
  useEffect(() => {
    let alive = true;

    tournamentService
      .getTournamentSettings(tournamentId)
      .then((s) => { if (alive) setSettings(s); })
      .catch(() => setSettings({ format: 'GROUPS_KO' }));

    tournamentService
      .getTournamentById(tournamentId)
      .then((t) => { if (alive) setTournament(t); })
      .catch(() => setTournament(null));

    return () => { alive = false; };
  }, [tournamentId]);

  const groupMatchesByRound = useCallback((list) => {
    return list.reduce((acc, m) => {
      const base = (m.round || '').split(/[-–]/)[0].trim() || '—';
      if (!acc[base]) acc[base] = [];
      acc[base].push(m);
      return acc;
    }, {});
  }, []);

  const visibleGroups = useMemo(() => {
    const out = {};
    for (const [roundName, arr] of Object.entries(groupedMatches)) {
      const allTBD =
        arr.length > 0 &&
        arr.every((m) => m.status === 'scheduled' && !m.player1Id && !m.player2Id);
      const koRound = /(1\/(8|16|32|64)\s*finału|ćwierćfinał|półfinał|finał)/i.test(roundName);
      if (!koRound && allTBD) continue;
      out[roundName] = arr;
    }
    return out;
  }, [groupedMatches]);

  const fetchForTab = useCallback(async () => {
    setLoading(true);
    let fetched = [];
    try {
      fetched = await matchService.getMatchesByTournamentId(tournamentId, activeTab);
      setMatches(fetched);
      setGroupedMatches(groupMatchesByRound(fetched));
      setError(null);
    } catch (err) {
      setError(err.message || 'Błąd podczas ładowania meczów. Sprawdź, czy jesteś zalogowany.');
      setMatches([]);
      setGroupedMatches({});
      fetched = [];
    } finally {
      setLoading(false);
      setSelected((prev) => {
        const ids = new Set(fetched.map((m) => m.id));
        const next = new Set();
        prev.forEach((id) => { if (ids.has(id)) next.add(id); });
        return next;
      });
    }
  }, [tournamentId, activeTab, groupMatchesByRound]);

  useEffect(() => { fetchForTab(); }, [fetchForTab]);

  // KO reset – dostępne rundy
  const availableResetRounds = useMemo(() => {
    const bases = new Set();
    for (const m of matches) {
      const b = baseRoundName(m.round);
      if (b) bases.add(b);
    }
    return KO_BASES.filter((b) => bases.has(b));
  }, [matches]);

  useEffect(() => {
    if (!resetFrom && availableResetRounds.length) {
      setResetFrom(availableResetRounds[0]);
    }
  }, [availableResetRounds, resetFrom]);

  // sockets
  const onInvalidate = useCallback(() => {
    if (invalidateTimerRef.current) clearTimeout(invalidateTimerRef.current);
    invalidateTimerRef.current = setTimeout(() => fetchForTab(), 80);
  }, [fetchForTab]);


  useEffect(() => {
    const s = io(socketOrigin(), {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
    socketRef.current = s;

    const tid = parseInt(String(tournamentId), 10);
    s.emit('join-tournament', tid);

    s.on('connect_error', (err) => {
      console.warn('socket connect_error', err?.message || err);
    });

    const onStatusChanged = ({ matchId, status }) => {
      if (status !== activeTab) {
        setMatches((prev) => prev.filter((m) => m.id !== matchId));
        setSelected((prev) => {
          if (prev.has(matchId)) {
            const c = new Set(prev);
            c.delete(matchId);
            return c;
          }
          return prev;
        });
        return;
      }
      matchService
        .getMatchById(matchId)
        .then((m) => {
          setMatches((prev) => {
            const idx = prev.findIndex((x) => x.id === matchId);
            if (idx !== -1) {
              const copy = [...prev];
              copy[idx] = m;
              return copy;
            }
            return [...prev, m];
          });
        })
        .catch(() => { });
    };

    const onMatchUpdated = (updatedMatch) => {
      setMatches((prev) => {
        if (updatedMatch.status !== activeTab) {
          return prev.filter((m) => m.id !== updatedMatch.id);
        }
        const idx = prev.findIndex((m) => m.id === updatedMatch.id);
        if (idx !== -1) {
          const copy = [...prev];
          copy[idx] = updatedMatch;
          return copy;
        }
        return [...prev, updatedMatch];
      });
    };

    const onLive = ({ matchId, sets }) => {
      setMatches(prev =>
        prev.map(m => {
          if (m.id !== matchId) return m;
          const incoming = Array.isArray(sets) && sets.length ? sets : [{ p1: 0, p2: 0 }];
          return {
            ...m,
            matchSets: incoming.map((s, i) => ({
              setNumber: i + 1,
              player1Score: Number(s.player1Score ?? s.player1 ?? s.p1 ?? 0),
              player2Score: Number(s.player2Score ?? s.player2 ?? s.p2 ?? 0),
            })),
          };
        })
      );
    };

    const onRefereeChanged = ({ matchId, referee }) => {
      setMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, referee } : m)));
    };

    s.on('match-status-changed', onStatusChanged);
    s.on('match-updated', onMatchUpdated);
    s.on('real-time-score-update', onLive);
    s.on('match-referee-changed', onRefereeChanged);
    s.on('matches-invalidate', onInvalidate);

    return () => {
      s.emit('leave-tournament', tid);
      for (const mid of joinedRoomsRef.current) s.emit('leave-match', mid);
      joinedRoomsRef.current.clear();

      s.off('match-status-changed', onStatusChanged);
      s.off('match-updated', onMatchUpdated);
      s.off('real-time-score-update', onLive);
      s.off('match-referee-changed', onRefereeChanged);
      s.off('matches-invalidate', onInvalidate);

      s.disconnect();
    };
  }, [tournamentId, activeTab, onInvalidate]);

  useEffect(() => {
  return () => {
    if (invalidateTimerRef.current) clearTimeout(invalidateTimerRef.current);
    invalidateTimerRef.current = null;
  };
}, []);

  useEffect(() => {
    setGroupedMatches(groupMatchesByRound(matches));
  }, [matches, groupMatchesByRound]);

  function resultBadge(m) {
    if (m.status !== 'finished') return null;
    if (!m.resultType || m.resultType === 'NORMAL') return null;
    const map = { WALKOVER: 'Walkower', DISQUALIFICATION: 'Dyskwalifikacja', RETIREMENT: 'Krecz' };
    const label = map[m.resultType] || m.resultType;
    const w = m.winner ? ` – ${m.winner.name} ${m.winner.surname}` : '';
    return <span className="badge badge-warning">{label}{w}</span>;
  }

  /* ============================================================================
   *  AKCJE: GENERATORY / SEED / RESET
   * ========================================================================== */

  const hasGroupMatches = useMemo(() => matches.some((m) => !isKO(m.round)), [matches]);

  const guardReadOnly = () => {
    if (readOnly) {
      toast.error('Turniej jest zablokowany.');
      return true;
    }
    return false;
  };

  const handleGenerateGroups = async () => {
    if (guardReadOnly()) return;
    try {
      const res = await matchService.generateGroupsAndKO(tournamentId);
      toast.success(`Wygenerowano fazę grupową + szkielet KO (${res?.count ?? '?'} meczów).`);
      await fetchForTab();
    } catch (e) {
      toast.error(e.message || 'Błąd generowania grup/KO');
    }
  };

  const handleSeedKO = async () => {
    if (guardReadOnly()) return;
    try {
      const res = await matchService.seedKnockout(tournamentId, { overwrite: true });
      toast.success(`Zasiano KO od ${res?.baseRound || 'rundy'} (zaktualizowano ${res?.updated ?? res?.changed ?? '?'} meczów).`);
      await fetchForTab();
    } catch (e) {
      toast.error(e.message || 'Błąd zasiewania KO');
    }
  };

  const handleGenerateKOOnly = async () => {
    if (guardReadOnly()) return;
    try {
      const res = await matchService.generateKnockoutOnly(tournamentId);
      toast.success(`Wygenerowano drabinkę KO (pary R1: ${res?.created ?? '?'}).`);
      await fetchForTab();
    } catch (e) {
      toast.error(e.message || 'Błąd generowania KO');
    }
  };

  const handleGenerateKOSkeleton = async () => {
    if (guardReadOnly()) return;
    try {
      const res = await matchService.generateKnockoutSkeleton(tournamentId);
      toast.success(`Utworzono pustą drabinkę KO od ${res?.baseRound || 'rundy'}.`);
      await fetchForTab();
    } catch (e) {
      toast.error(e.message || 'Błąd tworzenia pustej drabinki KO');
    }
  };

  const handleResetGroups = async () => {
    if (guardReadOnly()) return;
    if (!confirm('Na pewno usunąć WSZYSTKIE mecze fazy grupowej?')) return;
    setResetBusy(true);
    try {
      const res = await matchService.resetGroupPhase(tournamentId, alsoKO);
      toast.success(`Usunięto ${res?.cleared ?? 0} meczów grupowych${alsoKO ? ' + KO' : ''}.`);
      await fetchForTab();
    } catch (e) {
      toast.error(e.message || 'Błąd usuwania meczów grupowych');
    } finally {
      setResetBusy(false);
    }
  };

  const handleResetKO = async () => {
    if (guardReadOnly()) return;
    if (!resetFrom) return;
    if (!confirm(`Na pewno zresetować KO od rundy: ${resetFrom}?`)) return;
    try {
      const res = await matchService.resetKnockoutFromRound(tournamentId, resetFrom);
      toast.success(`Wyczyszczono ${res?.cleared ?? 0} meczów od ${resetFrom}.`);
      await fetchForTab();
    } catch (e) {
      toast.error(e.message || 'Błąd resetu KO');
    }
  };

  /* ============================================================================
   *  BULK: wybór + modal sędziego
   * ========================================================================== */

  const toggleSelected = (matchId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(matchId)) next.delete(matchId);
      else next.add(matchId);
      return next;
    });
  };
  const selectAllVisible = () => {
    const ids = Object.values(visibleGroups).flat().map((m) => m.id);
    setSelected(new Set(ids));
  };
  const clearSelection = () => setSelected(new Set());
  const anySelected = selected.size > 0;

  const openRefModal = async () => {
    if (guardReadOnly()) return;
    setRefModalOpen(true);
    setRefLoading(true);
    try {
      const r = await roleService.listRoles(tournamentId);
      const pool = (r || []).filter((x) => x.role === 'referee').map((x) => x.user).filter(Boolean);
      const map = new Map(pool.map((u) => [u.id, u]));
      setReferees(Array.from(map.values()));
    } catch {
      setReferees([]);
    } finally {
      setRefLoading(false);
    }
  };

  const closeRefModal = () => {
    setRefModalOpen(false);
    setChosenRef(null);
    setRefSearch('');
  };

  const filteredRefs = useMemo(() => {
    const q = refSearch.trim().toLowerCase();
    if (!q) return referees;
    return referees.filter((u) =>
      `${u.name} ${u.surname} ${u.email || ''}`.toLowerCase().includes(q)
    );
  }, [referees, refSearch]);

  const saveRefAssign = async () => {
    if (guardReadOnly()) return;
    const ids = Array.from(selected);
    if (!ids.length) {
      toast.info('Zaznacz mecze.');
      return;
    }
    const refId = chosenRef?.id ?? null;
    try {
      const out = await matchService.assignRefereeBulk({
        tournamentId,
        matchIds: ids,
        refereeId: refId,
      });
      const { updated = 0, skipped = [] } = out || {};
      if (refId) {
        if (updated) toast.success(`Przypisano sędziego w ${updated} meczach.`);
        if (skipped.length) toast.warn(`Pominięto ${skipped.length} (konflikt ról).`);
      } else {
        toast.success(`Usunięto sędziów w ${updated} meczach.`);
      }
      await fetchForTab();
      closeRefModal();
    } catch (e) {
      toast.error(e.message || 'Błąd przypisywania sędziego');
    }
  };

  /* ============================================================================
   *  MODAL PAROWANIA KO
   * ========================================================================== */

  useEffect(() => {
    const onDown = (e) => {
      if (p1ComboRef.current?.contains(e.target)) return;
      if (p2ComboRef.current?.contains(e.target)) return;
      setP1Open(false);
      setP2Open(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = (pairingOpen || refModalOpen) ? 'hidden' : prev || '';
    return () => { document.body.style.overflow = prev; };
  }, [pairingOpen, refModalOpen]);

  const filterEligible = (q, excludeId) => {
    const s = (q || '').trim().toLowerCase();
    return (eligible || [])
      .filter(u => u && u.id !== excludeId)
      .filter(u => {
        if (!s) return true;
        const label = `${u.name ?? ''} ${u.surname ?? ''} ${u.email ?? ''}`.toLowerCase();
        return label.includes(s);
      });
  };

  const openPairingModal = async (match) => {
    if (guardReadOnly()) return;
    setPairingMatch(match);
    setPairingOpen(true);
    try {
      const list = await matchService.getEligiblePlayersForMatch(match.id);
      const arr =
        Array.isArray(list) ? list
          : Array.isArray(list?.users) ? list.users
            : Array.isArray(list?.players) ? list.players
              : [];
      const normalizeUser = (raw) => {
        const base = raw?.user ? raw.user : raw;
        return {
          id: base?.id ?? raw?.userId ?? raw?.playerId ?? null,
          name: base?.name ?? base?.firstName ?? '',
          surname: base?.surname ?? base?.lastName ?? '',
          email: base?.email ?? ''
        };
      };
      setEligible(arr.map(normalizeUser).filter(u => u.id));
    } catch {
      setEligible([]);
    }
    setP1User(match.player1 || null);
    setP2User(match.player2 || null);
    setP1Query(match.player1 ? `${match.player1.name} ${match.player1.surname}` : '');
    setP2Query(match.player2 ? `${match.player2.name} ${match.player2.surname}` : '');
    setP1Open(false);
    setP2Open(false);
  };

  const closePairingModal = () => {
    setPairingOpen(false);
    setPairingMatch(null);
    setEligible([]);
    setP1User(null);
    setP2User(null);
    setP1Query('');
    setP2Query('');
    setP1Open(false);
    setP2Open(false);
  };

  const swapSides = () => {
    const u1 = p1User;
    const u2 = p2User;
    const q1 = p1Query;
    const q2 = p2Query;
    setP1User(u2);
    setP2User(u1);
    setP1Query(q2);
    setP2Query(q1);
  };

  const savePairing = async () => {
    if (guardReadOnly()) return;
    if (p1User && p2User && p1User.id === p2User.id) {
      toast.error('Ten sam zawodnik po obu stronach');
      return;
    }
    if (!pairingMatch) return;

    const payload = {};
    const oldP1 = pairingMatch.player1?.id ?? null;
    const oldP2 = pairingMatch.player2?.id ?? null;
    const newP1 = p1User?.id ?? null;
    const newP2 = p2User?.id ?? null;

    if (newP1 !== oldP1) payload.player1Id = newP1;
    if (newP2 !== oldP2) payload.player2Id = newP2;

    try {
      const updated = await matchService.setPairing(pairingMatch.id, payload);
      setMatches(prev => prev.map(m => (m.id === updated.id ? updated : m)));
      toast.success('Pary zaktualizowane');
      closePairingModal();
    } catch (e) {
      toast.error(e.message || 'Błąd ustawiania pary');
    }
  };

  const currentBaseRound = useMemo(
    () => baseRoundName(pairingMatch?.round || ''),
    [pairingMatch]
  );

  const isUsedInSameRoundElsewhere = useCallback((userId) => {
    if (!userId || !pairingMatch) return false;
    return matches.some(m =>
      m.id !== pairingMatch.id &&
      baseRoundName(m.round) === currentBaseRound &&
      (m.player1?.id === userId || m.player2?.id === userId)
    );
  }, [matches, pairingMatch, currentBaseRound]);

  /* ============================================================================
   *  RENDER
   * ========================================================================== */

  const renderMatch = (match) => {
    const isSelected = selected.has(match.id);
    const showScoreBtn =
      (match.status === 'scheduled' || match.status === 'in_progress') && canScore(match);

    return (
      <div key={match.id} className={`match-card ${isSelected ? 'selected' : ''}`}>
        <div className="match-card-top">
          {isTournyOrg && (
            <label className="match-select">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSelected(match.id)}
                disabled={readOnly}
                title={readOnly ? 'Turniej zablokowany' : undefined}
              />
              <span>Zaznacz</span>
            </label>
          )}

          <div className="match-info">
            <span className="match-round">{match.round}</span>
            <span className="match-category">
              {match.category
                ? `${match.category.gender === 'male' ? 'Mężczyźni' : 'Kobiety'} ${match.category.categoryName}`
                : 'Brak kategorii'}
            </span>
          </div>

          <div className="match-referee">
            {match.referee ? (
              <span className="ref-pill" title={`ID: ${match.referee.id}`}>
                Sędzia:{' '}
                <Link to={`/u/${match.referee.id}`} className="referee-link" title="Zobacz profil sędziego">
                  {match.referee.name} {match.referee.surname}
                </Link>
              </span>
            ) : (
              <span className="ref-none">Brak sędziego</span>
            )}
          </div>
        </div>

        <div className="match-players">
          <div className="player">
            {match.player1 ? (
              <Link to={`/u/${match.player1.id}`} title="Profil zawodnika">
                {match.player1.name} {match.player1.surname}
              </Link>
            ) : 'TBD'}
          </div>

          <div className="vs">vs</div>

          <div className="player">
            {match.player2 ? (
              <Link to={`/u/${match.player2.id}`} title="Profil zawodnika">
                {match.player2.name} {match.player2.surname}
              </Link>
            ) : 'TBD'}
          </div>
        </div>

        {match.matchTime
          ? <div className="pill pill-time">
            {fmtDT(match.matchTime)} {match.courtNumber ? `• Kort ${match.courtNumber}` : ''}
          </div>
          : <div className="pill pill-muted">Termin: TBA</div>
        }

        {match.status === 'finished' && match.resultType && match.resultType !== 'NORMAL' && (
          <div className="pill pill-admin">
            {match.resultType === 'WALKOVER' ? 'Walkover'
              : match.resultType === 'DISQUALIFICATION' ? 'Dyskwalifikacja'
                : match.resultType === 'RETIREMENT' ? 'Krecz'
                  : match.resultType}
          </div>
        )}

        <div className="match-status">
          {match.status === 'scheduled' && 'Zaplanowany'}
          {match.status === 'in_progress' && <span className="live-pill">W trakcie • LIVE</span>}
          {match.status === 'finished' &&
            (match.winner
              ? `Zwycięzca: ${match.winner.name} ${match.winner.surname}`
              : 'Zakończony')}
          {' '}
          {resultBadge(match)}
        </div>

        {isTournyOrg && (
          <div className="org-tools">
            <button
              className="btn-secondary"
              onClick={() => { if (readOnly) { toast.error('Turniej jest zablokowany.'); return; } setTargetMatch(match); setOpenSchedule(true); }}
              disabled={readOnly}
              title={readOnly ? 'Turniej zablokowany' : undefined}
            >
              Ustaw termin
            </button>
          </div>
        )}

        {/* Przycisk do panelu wyniku – tylko dla sędziego tego meczu, i tylko gdy nie zablokowany */}
        {showScoreBtn && (
          <button
            onClick={() => navigate(`/match-score-panel/${match.id}`)}
            className="score-input-btn"
            disabled={readOnly}
            title={readOnly ? 'Turniej zablokowany' : undefined}
          >
            Wprowadź wynik
          </button>
        )}

        {/* KO tools – dla organizatora */}
        {isTournyOrg && isKO(match.round) && match.status !== 'finished' && (
          <div className="ko-tools">
            <button
              className="btn-secondary"
              onClick={() => openPairingModal(match)}
              disabled={readOnly}
              title={readOnly ? 'Turniej zablokowany' : 'Ustaw parę zawodników w tym meczu KO'}
            >
              Ustaw parę
            </button>
          </div>
        )}

        {match.matchSets?.length > 0 && (
          <div className="match-score">
            <div className="match-score-sets">
              Wynik:{' '}
              {match.matchSets.map((set) => `${set.player1Score}-${set.player2Score}`).join(', ')}
            </div>
          </div>
        )}
      </div>
    );
  };

  const sortedRounds = useMemo(() => {
    const keys = Object.keys(visibleGroups);
    return keys.sort((a, b) => {
      const typeA = ROUND_ORDER.find((type) => a.startsWith(type));
      const typeB = ROUND_ORDER.find((type) => b.startsWith(type));
      const indexA = typeA ? ROUND_ORDER.indexOf(typeA) : 999;
      const indexB = typeB ? ROUND_ORDER.indexOf(typeB) : 999;
      return indexA === indexB ? a.localeCompare(b) : indexA - indexB;
    });
  }, [visibleGroups]);

  return (
    <section className="matches-section">
      <header className="matches-header">
        <div className="matches-header-top">
          <h2 className="section-title">Mecze turnieju</h2>
        </div>

        {/* informacja o blokadzie */}
        {readOnly && (
          <div
            className="notice-blocked"
            role="status"
            aria-live="polite"
            style={{
              margin: '8px 0 0',
              padding: '8px 12px',
              background: '#fff3cd',
              border: '1px solid #ffe69c',
              borderRadius: 8,
              color: '#664d03',
            }}
          >
            Ten turniej jest zablokowany — akcje organizatora i sędziego są niedostępne.
          </div>
        )}

        {/* KO toolbar – tylko dla organizatora */}
        {isTournyOrg && (
          <div className="ko-toolbar">
            {settings?.format === 'GROUPS_KO' ? (
              <>
                {/* RZĄD 1 – trzy główne przyciski */}
                <div className="ko-row">
                  <button
                    className="btn-primary"
                    onClick={handleGenerateGroups}
                    disabled={readOnly || hasGroupMatches || resetBusy}
                    title={
                      readOnly
                        ? 'Turniej zablokowany'
                        : hasGroupMatches
                          ? 'Najpierw usuń mecze grupowe'
                          : 'Stwórz grupy + szkielet drabinki'
                    }
                  >
                    Stwórz grupy + szkielet drabinki
                  </button>

                  <button
                    className="btn-primary"
                    onClick={handleSeedKO}
                    disabled={readOnly}
                    title={
                      readOnly
                        ? 'Turniej zablokowany'
                        : 'Rozstaw zawodników w KO (wg ustawień)'
                    }
                  >
                    Rozstaw zawodników w KO (wg ustawień)
                  </button>

                  <button
                    className="btn-secondary"
                    onClick={handleGenerateKOSkeleton}
                    disabled={readOnly}
                    title={readOnly ? 'Turniej zablokowany' : 'Utwórz pustą drabinkę KO'}
                  >
                    Pusta drabinka KO
                  </button>
                </div>

                {/* RZĄD 2 – usuwanie grup + opcja KO */}
                <div className="ko-row">
                  <button
                    className="btn-danger"
                    onClick={handleResetGroups}
                    disabled={readOnly || !matches.length || resetBusy}
                    title={
                      readOnly
                        ? 'Turniej zablokowany'
                        : !matches.length
                          ? 'Brak meczów do usunięcia'
                          : 'Usuń wszystkie mecze grupowe (i opcjonalnie KO)'
                    }
                  >
                    {resetBusy ? 'Usuwam…' : 'Usuń mecze grupowe'}
                  </button>

                  <label
                    className="chk"
                    style={{ opacity: readOnly ? 0.6 : 1 }}
                  >
                    <input
                      type="checkbox"
                      checked={alsoKO}
                      onChange={(e) => setAlsoKO(e.target.checked)}
                      disabled={readOnly}
                    />
                    Usuń także mecze KO
                  </label>
                </div>

                {/* RZĄD 3 – reset KO od wybranej rundy */}
                {availableResetRounds.length > 0 && (
                  <div className="ko-row ko-row--reset">
                    <strong>Wyczyść KO od rundy:</strong>
                    <select
                      value={resetFrom}
                      onChange={(e) => setResetFrom(e.target.value)}
                      className="select"
                      disabled={readOnly}
                      title={readOnly ? 'Turniej zablokowany' : undefined}
                    >
                      {availableResetRounds.map((r) => (
                        <option key={r} value={r}>
                          {r === '1/64' || r === '1/32' || r === '1/16' || r === '1/8'
                            ? `${r} finału`
                            : r}
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn-danger"
                      onClick={handleResetKO}
                      disabled={readOnly}
                      title={
                        readOnly
                          ? 'Turniej zablokowany'
                          : 'Wyczyść mecze KO od wybranej rundy'
                      }
                    >
                      Wyczyść od tej rundy
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* KO_ONLY – RZĄD 1 */}
                <div className="ko-row">
                  <button
                    className="btn-primary"
                    onClick={handleGenerateKOOnly}
                    disabled={readOnly}
                    title={
                      readOnly
                        ? 'Turniej zablokowany'
                        : 'Wygeneruj drabinkę KO (losowo)'
                    }
                  >
                    Wygeneruj drabinkę KO (losowo)
                  </button>

                  <button
                    className="btn-secondary"
                    onClick={handleGenerateKOSkeleton}
                    disabled={readOnly}
                    title={readOnly ? 'Turniej zablokowany' : 'Utwórz pustą drabinkę KO'}
                  >
                    Pusta drabinka KO
                  </button>
                </div>

                {/* KO_ONLY – RZĄD 2 (reset KO) */}
                {availableResetRounds.length > 0 && (
                  <div className="ko-row ko-row--reset">
                    <strong>Wyczyść KO od rundy:</strong>
                    <select
                      value={resetFrom}
                      onChange={(e) => setResetFrom(e.target.value)}
                      className="select"
                      disabled={readOnly}
                      title={readOnly ? 'Turniej zablokowany' : undefined}
                    >
                      {availableResetRounds.map((r) => (
                        <option key={r} value={r}>
                          {r === '1/64' || r === '1/32' || r === '1/16' || r === '1/8'
                            ? `${r} finału`
                            : r}
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn-danger"
                      onClick={handleResetKO}
                      disabled={readOnly}
                      title={
                        readOnly
                          ? 'Turniej zablokowany'
                          : 'Wyczyść mecze KO od wybranej rundy'
                      }
                    >
                      Wyczyść od tej rundy
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}


        {/* BULK toolbar – tylko dla organizatora */}
        {isTournyOrg && (
          <div className="bulk-toolbar">
            <div className="bulk-row">
              <button
                className="btn-secondary"
                onClick={selectAllVisible}
                disabled={readOnly}
                title={readOnly ? 'Turniej zablokowany' : 'Zaznacz wszystkie widoczne'}
              >
                Zaznacz widoczne
              </button>
              <button
                className="btn-secondary"
                onClick={clearSelection}
                disabled={!anySelected}
              >
                Wyczyść wybór
              </button>

              <button
                className="btn-primary"
                onClick={openRefModal}
                disabled={readOnly || !anySelected}
                style={{ marginLeft: 12 }}
                title={
                  readOnly
                    ? 'Turniej zablokowany'
                    : anySelected
                      ? 'Przypisz sędziego do zaznaczonych meczów'
                      : 'Zaznacz mecze'
                }
              >
                Przydziel sędziego… ({selected.size})
              </button>
            </div>
          </div>
        )}

        {isTournyOrg && (
          <button
            className="btn-primary"
            onClick={() => {
              if (readOnly) {
                toast.error('Turniej jest zablokowany.');
                return;
              }
              setOpenAuto(true);
            }}
            disabled={readOnly}
            title={readOnly ? 'Turniej zablokowany' : 'Automatyczne zaplanowanie meczów'}
          >
            Auto-plan
          </button>
        )}
      </header>

      <div className="tabs-container">
        {Object.keys(TABS).map((tab) => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {TABS[tab]}
          </button>
        ))}
      </div>

      {loading ? (
        <p>Ładowanie meczów...</p>
      ) : error ? (
        <p className="error">Błąd: {error}</p>
      ) : matches.length > 0 ? (
        <div className="matches-list">
          {Object.keys(visibleGroups).length === 0 ? (
            <p>Brak meczów do wyświetlenia.</p>
          ) : (
            Object.keys(visibleGroups).sort((a, b) => {
              const typeA = ROUND_ORDER.find((type) => a.startsWith(type));
              const typeB = ROUND_ORDER.find((type) => b.startsWith(type));
              const indexA = typeA ? ROUND_ORDER.indexOf(typeA) : 999;
              const indexB = typeB ? ROUND_ORDER.indexOf(typeB) : 999;
              return indexA === indexB ? a.localeCompare(b) : indexA - indexB;
            }).map((roundName) => (
              <div key={roundName} className="match-group-section">
                <h3>
                  {roundName}{' '}
                  {isTournyOrg && (
                    <button
                      className="btn-link"
                      onClick={() => {
                        if (readOnly) { toast.error('Turniej jest zablokowany.'); return; }
                        const ids = (visibleGroups[roundName] || []).map((m) => m.id);
                        setSelected((prev) => {
                          const next = new Set(prev);
                          ids.forEach((id) => next.add(id));
                          return next;
                        });
                      }}
                      disabled={readOnly}
                      title={readOnly ? 'Turniej zablokowany' : 'Zaznacz mecze z tej sekcji'}
                    >
                      (zaznacz tę sekcję)
                    </button>
                  )}
                </h3>

                {visibleGroups[roundName].map(renderMatch)}
              </div>
            ))
          )}
        </div>
      ) : (
        <p>Brak meczów w tej kategorii.</p>
      )}

      {/* MODAL: przypisywanie sędziego */}
      {refModalOpen && (
        <div className="pair-modal__backdrop" role="dialog" aria-modal="true">
          <div className="pair-modal__card" style={{ maxWidth: 640 }}>
            <div className="pair-modal__header">
              <h3>
                Przydziel sędziego ({selected.size} mecz{selected.size === 1 ? '' : 'y'})
              </h3>
              <button className="pair-modal__close" aria-label="Zamknij" onClick={closeRefModal}>×</button>
            </div>

            <div className="pair-modal__body">
              <div className="pairing-row">
                <label className="pairing-label">Szukaj</label>
                <input
                  className="pairing-input"
                  placeholder="Nazwisko / e-mail…"
                  value={refSearch}
                  onChange={(e) => setRefSearch(e.target.value)}
                />
              </div>

              <div className="pairing-row" style={{ maxHeight: 280, overflow: 'auto', border: '1px solid #eee', borderRadius: 8 }}>
                {refLoading ? (
                  <div className="muted" style={{ padding: 12 }}>Ładuję listę sędziów…</div>
                ) : filteredRefs.length ? (
                  <ul className="pairing-list" style={{ position: 'relative', display: 'block' }}>
                    <li
                      key="none"
                      onMouseDown={() => setChosenRef(null)}
                      className={!chosenRef ? 'selected' : ''}
                      style={{ cursor: 'pointer' }}
                    >
                      — Brak sędziego (usuń) —
                    </li>
                    {filteredRefs.map((u) => (
                      <li
                        key={u.id}
                        onMouseDown={() => setChosenRef(u)}
                        className={chosenRef?.id === u.id ? 'selected' : ''}
                        style={{ cursor: 'pointer' }}
                      >
                        {u.name} {u.surname}
                        {u.email ? ` (${u.email})` : ''}{' '}
                        <span className="muted">#{u.id}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="muted" style={{ padding: 12 }}>
                    Brak użytkowników z rolą „sędzia” w tym turnieju.
                  </div>
                )}
              </div>
            </div>

            <div className="pair-modal__footer">
              <button className="btn-secondary" onClick={closeRefModal}>Anuluj</button>
              <button className="btn-primary" onClick={saveRefAssign} disabled={refLoading || readOnly}
                title={readOnly ? 'Turniej zablokowany' : undefined}>
                {chosenRef ? 'Przypisz do zaznaczonych' : 'Usuń sędziego w zaznaczonych'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: parowanie KO */}
      {pairingOpen && (
        <div className="pair-modal__backdrop" role="dialog" aria-modal="true">
          <div className="pair-modal__card">
            <div className="pair-modal__header">
              <h3>Ustaw parę {pairingMatch ? `– ${pairingMatch.round}` : ''}</h3>
              <button className="pair-modal__close" aria-label="Zamknij" onClick={closePairingModal}>×</button>
            </div>

            <div className="pair-modal__body">
              <div className="pairing-grid">
                <div className="pairing-row">
                  <label className="pairing-label">Zawodnik A</label>
                  <div className="pairing-combo player-one" ref={p1ComboRef}>
                    <input
                      className="pairing-input"
                      placeholder="Szukaj zawodnika…"
                      value={p1Query}
                      onFocus={() => setP1Open(true)}
                      onChange={(e) => { setP1Query(e.target.value); setP1User(null); setP1Open(true); }}
                      onKeyDown={(e) => { if (e.key === 'Escape') setP1Open(false); }}
                      disabled={readOnly}
                    />
                    {p1User && isUsedInSameRoundElsewhere(p1User.id) && (
                      <p className="pairing-hint">Ten zawodnik jest już w innym meczu tej rundy.</p>
                    )}
                    {p1Open && !readOnly && (
                      <ul className="pairing-list">
                        {filterEligible(p1Query, p2User?.id).length ? (
                          filterEligible(p1Query, p2User?.id).map((u) => (
                            <li
                              key={u.id}
                              onMouseDown={() => { setP1User(u); setP1Query(`${u.name} ${u.surname}`); setP1Open(false); }}
                            >
                              {u.name} {u.surname}{u.email ? ` (${u.email})` : ''}
                            </li>
                          ))
                        ) : (
                          <li className="muted">Brak dopuszczonych</li>
                        )}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="pairing-row">
                  <label className="pairing-label">Zawodnik B</label>
                  <div className="pairing-combo player-two" ref={p2ComboRef}>
                    <input
                      className="pairing-input"
                      placeholder="Szukaj zawodnika…"
                      value={p2Query}
                      onFocus={() => setP2Open(true)}
                      onChange={(e) => { setP2Query(e.target.value); setP2User(null); setP2Open(true); }}
                      onKeyDown={(e) => { if (e.key === 'Escape') setP2Open(false); }}
                      disabled={readOnly}
                    />
                    {p2User && isUsedInSameRoundElsewhere(p2User.id) && (
                      <p className="pairing-hint">Ten zawodnik jest już w innym meczu tej rundy.</p>
                    )}
                    {p2Open && !readOnly && (
                      <ul className="pairing-list">
                        {filterEligible(p2Query, p1User?.id).length ? (
                          filterEligible(p2Query, p1User?.id).map((u) => (
                            <li
                              key={u.id}
                              onMouseDown={() => { setP2User(u); setP2Query(`${u.name} ${u.surname}`); setP2Open(false); }}
                            >
                              {u.name} {u.surname}{u.email ? ` (${u.email})` : ''}
                            </li>
                          ))
                        ) : (
                          <li className="muted">Brak dopuszczonych</li>
                        )}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>


            <div className="pair-modal__footer">
              <button className="btn-secondary" onClick={swapSides} disabled={readOnly}
                title={readOnly ? 'Turniej zablokowany' : undefined}>
                Zamień strony
              </button>
              <div className="pair-modal__spacer" />
              <button className="btn-secondary" onClick={closePairingModal}>Anuluj</button>
              <button className="btn-primary" onClick={savePairing} disabled={readOnly}
                title={readOnly ? 'Turniej zablokowany' : undefined}>
                Zapisz
              </button>
            </div>
          </div>
        </div>
      )}

      <ScheduleMatchModal
        open={openSchedule}
        match={targetMatch}
        onClose={(saved) => {
          setOpenSchedule(false);
          setTargetMatch(null);
        }}
      />

      <AutoScheduleModal
        open={openAuto}
        tournamentId={id}
        onClose={() => setOpenAuto(false)}
      />
    </section>
  );
}
