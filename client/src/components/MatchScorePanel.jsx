// src/components/MatchScorePanel.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getMatchById, updateMatchScore } from '../services/matchService';
import { useAuth } from '../contexts/AuthContext';
import io from 'socket.io-client';
import '../styles/matchScorePanel.css';
import Breadcrumbs from '../components/Breadcrumbs';
import { toast } from 'react-toastify';
import { socketOrigin } from "../services/api";

function normalizeTieBreak(raw) {
    if (!raw) return 'normal';
    const s = String(raw).toLowerCase().replace(/[\s\-_]/g, '');
    if (['normal', 'zwykly', 'zwyklytiebreak', 'tiebreak', 'standard'].includes(s)) return 'normal';
    if (['supertiebreak', 'supertie', 'super'].includes(s)) return 'super_tie_break';
    if (['brak', 'none', 'notiebreak', 'no', 'bez'].includes(s)) return 'no_tie_break';
    return 'normal';
}
function tieBreakLabel(t) {
    const n = normalizeTieBreak(t);
    if (n === 'normal') return 'zwykły';
    if (n === 'super_tie_break') return 'super tie-break';
    return 'brak';
}

// === logika setów / super TB ===
function makeRules(match) {
    return {
        setsToWin: Number.isInteger(match?.tournament?.setsToWin) && match.tournament.setsToWin > 0
            ? match.tournament.setsToWin : 2,
        gamesPerSet: Number.isInteger(match?.tournament?.gamesPerSet) && match.tournament.gamesPerSet > 0
            ? match.tournament.gamesPerSet : 6,
        tieBreakType: (match?.tournament?.tieBreakType || 'normal'),
        superTbPoints: 10,
    };
}

function isSuperTB(tieBreakType) {
    const t = String(tieBreakType || '').toLowerCase().replace(/[\s\-_]/g, '');
    return t === 'supertiebreak' || t === 'supertie' || t === 'super';
}

/** limit punktów w danym secie */
function limitForSetAt(index, setsArr, rules) {
    const maxSets = rules.setsToWin * 2 - 1;
    const tb = String(rules.tieBreakType || '').toLowerCase().replace(/[\s\-_]/g, '');
    const isNoTB = ['notiebreak', 'brak', 'no', 'bez'].includes(tb);
    const isSuperTB = ['supertiebreak', 'supertie', 'super'].includes(tb);

    let a = 0, b = 0;
    for (let i = 0; i < index && i < setsArr.length; i++) {
        const s = setsArr[i];
        const w = Math.max(s.p1, s.p2);
        const l = Math.min(s.p1, s.p2);
        const diff = w - l;
        if (w >= rules.gamesPerSet && diff >= 2) {
            if (s.p1 > s.p2) a++; else b++;
        }
    }

    const isDecider = (index === (maxSets - 1)) && (a === b);

    if (isSuperTB && isDecider) {
        const currentSet = setsArr[index] || { p1: 0, p2: 0 };
        const currentMax = Math.max(currentSet.p1, currentSet.p2);
        return currentMax >= (rules.superTbPoints - 1) ? currentMax + 2 : rules.superTbPoints;
    }

    if (isNoTB) return undefined;
    return rules.gamesPerSet + 1;
}

function countWonSetsWithLimits(setsArr, rules) {
    let a = 0, b = 0;
    for (let i = 0; i < setsArr.length && i < (rules.setsToWin * 2 - 1); i++) {
        if (isSetCompleteAt(i, setsArr, rules)) {
            const s = setsArr[i];
            if (s.p1 > s.p2) a++; else b++;
        }
    }
    return [a, b];
}


function isSetCompleteAt(index, setsArr, rules) {
    const tb = String(rules.tieBreakType || '').toLowerCase().replace(/[\s\-_]/g, '');
    const isNoTB = ['notiebreak', 'brak', 'no', 'bez'].includes(tb);
    const isSuperTB = ['supertiebreak', 'supertie', 'super'].includes(tb);
    const maxSets = rules.setsToWin * 2 - 1;

    let a = 0, b = 0;
    for (let i = 0; i < index && i < setsArr.length; i++) {
        const s = setsArr[i];
        const w = Math.max(s.p1, s.p2);
        const l = Math.min(s.p1, s.p2);
        const diff = w - l;
        if (w >= rules.gamesPerSet && diff >= 2) {
            if (s.p1 > s.p2) a++; else b++;
        }
    }

    const isDecider = (index === (maxSets - 1)) && (a === b);
    const s = setsArr[index] || { p1: 0, p2: 0 };
    const w = Math.max(s.p1, s.p2);
    const l = Math.min(s.p1, s.p2);
    const diff = w - l;

    if (isSuperTB && isDecider) {
        return (w >= rules.superTbPoints && diff >= 2);
    }

    if (isNoTB) {
        return (w >= rules.gamesPerSet && diff >= 2);
    }

    const N = rules.gamesPerSet;
    if (w === N && diff >= 2) return true;
    if (w === N + 1 && l === N - 1) return true;
    if (w === N + 1 && l === N) return true;

    return false;
}

export default function MatchScorePanel() {
    const { matchId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [match, setMatch] = useState(null);
    const [sets, setSets] = useState([{ p1: 0, p2: 0 }]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const socketRef = useRef(null);
    const [socketReady, setSocketReady] = useState(false);
    const initialLiveSent = useRef(false);

    // === administracyjne zakończenia ===
    const [resultType, setResultType] = useState('NORMAL');
    const [adminWinner, setAdminWinner] = useState('p1');

    // === Reguły (z turnieju) ===
    const rules = useMemo(() => makeRules(match), [match]);
    const maxSets = useMemo(() => rules.setsToWin * 2 - 1, [rules]);
    const tieType = match?.tournament?.tieBreakType;

    const [p1Won, p2Won] = useMemo(
        () => countWonSetsWithLimits(sets, rules),
        [sets, rules]
    );
    const isResolved = p1Won >= rules.setsToWin || p2Won >= rules.setsToWin;

    // 1) fetch meczu
    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const data = await getMatchById(matchId);
                setMatch(data);

                if (Array.isArray(data.matchSets) && data.matchSets.length) {
                    setSets(
                        data.matchSets
                            .sort((a, b) => a.setNumber - b.setNumber)
                            .map(s => ({
                                p1: Number(s.player1Score ?? s.player1Games ?? 0),
                                p2: Number(s.player2Score ?? s.player2Games ?? 0),
                            }))
                    );
                } else {
                    setSets([{ p1: 0, p2: 0 }]);
                }
                setError('');
            } catch (e) {
                setError('Błąd podczas ładowania danych meczu. Upewnij się, że jesteś zalogowany.');
                setMatch(null);
            } finally {
                setLoading(false);
            }
        })();
    }, [matchId]);

    // 2) socket
    useEffect(() => {
        const s = io(socketOrigin(), { withCredentials: true });
        socketRef.current = s;

        const mid = Number(matchId);

        const onConnect = () => {
            setSocketReady(true);
            s.emit('join-match', mid);
        };

        const onMatchUpdated = (updated) => {
            if (updated.id === mid) {
                setMatch(updated);
                if (Array.isArray(updated.matchSets)) {
                    setSets(
                        updated.matchSets
                            .sort((a, b) => a.setNumber - b.setNumber)
                            .map(ss => ({
                                p1: Number(ss.player1Score ?? ss.player1Games ?? 0),
                                p2: Number(ss.player2Score ?? ss.player2Games ?? 0),
                            }))
                    );
                }
            }
        };

        const onLive = (payload) => {
            if (payload.matchId === mid && Array.isArray(payload.sets)) {
                setSets(payload.sets.map(ss => ({
                    p1: Number(ss.p1 ?? ss.player1Score ?? ss.player1 ?? 0),
                    p2: Number(ss.p2 ?? ss.player2Score ?? ss.player2 ?? 0),
                })));
            }
        };

        s.on('connect', onConnect);
        s.on('match-updated', onMatchUpdated);
        s.on('real-time-score-update', onLive);

        return () => {
            s.emit('leave-match', mid);
            s.off('connect', onConnect);
            s.off('match-updated', onMatchUpdated);
            s.off('real-time-score-update', onLive);
            s.disconnect();
            setSocketReady(false);
            initialLiveSent.current = false;
        };
    }, [matchId]);


    useEffect(() => {
        if (!socketReady) return;
        if (initialLiveSent.current) return;
        if (!Array.isArray(sets) || sets.length === 0) return;

        socketRef.current.emit('real-time-score-update', {
            matchId: Number(matchId),
            sets: sets.map(s => ({ p1: +s.p1 || 0, p2: +s.p2 || 0 })),
        });
        initialLiveSent.current = true;
    }, [socketReady, sets, matchId]);

    const emitLive = (nextSets) => {
        socketRef.current?.emit('real-time-score-update', {
            matchId: Number(matchId),
            sets: nextSets,
        });
    };

    // live zmiana jednego pola
    const handleScoreChange = (index, which, rawVal) => {
        if (resultType !== 'NORMAL') return;
        const next = sets.map(s => ({ ...s }));
        const row = next[index] || { p1: 0, p2: 0 };
        const key = which === 1 ? 'p1' : 'p2';
        let val = Number(rawVal);
        if (!Number.isInteger(val) || val < 0) val = 0;
        const limit = limitForSetAt(index, next, rules);
        if (val > limit) val = limit;

        const prev = row[key];
        const [wa, wb] = countWonSetsWithLimits(next, rules);
        const alreadyDecided = wa >= rules.setsToWin || wb >= rules.setsToWin;
        const increasing = val > prev;
        // soft-lock: po domknięciu pozwól zmniejszać, blokuj zwiększanie
        if (alreadyDecided && increasing) {
            return;
        }

        row[key] = val;

        if (row.p1 === limit && row.p2 === limit) {
            // limit==10 tylko w STB
            if (limit === rules.superTbPoints) {
                if (which === 1) row.p1 = Math.max(0, limit - 1);
                else row.p2 = Math.max(0, limit - 1);
            }
        }

        next[index] = row;

        const [na, nb] = countWonSetsWithLimits(next, rules);
        const resolved = na >= rules.setsToWin || nb >= rules.setsToWin;
        if (isSetCompleteAt(index, next, rules) && !resolved && index === next.length - 1 && next.length < maxSets) {
            next.push({ p1: 0, p2: 0 });
        }

        setSets(next);
        emitLive(next);
    };

    const bumpScore = (index, which, delta) => {
        if (resultType !== "NORMAL") return;

        const current = sets[index]?.[which === 1 ? "p1" : "p2"] ?? 0;
        const nextVal = Number(current) + delta;

        handleScoreChange(index, which, String(nextVal));
    };


    const handleAddSet = () => {
        if (isResolved || resultType !== 'NORMAL') return;
        if (sets.length >= maxSets) return;
        const next = [...sets, { p1: 0, p2: 0 }];
        setSets(next);
        emitLive(next);
    };

    const handleRemoveSet = (index) => {
        if (isResolved || resultType !== 'NORMAL') return;
        const next = sets.filter((_, i) => i !== index);
        if (next.length === 0) next.push({ p1: 0, p2: 0 });
        setSets(next);
        emitLive(next);
    };

    const calcWinnerId = () => {
        const [a, b] = countWonSetsWithLimits(sets, rules);
        if (a >= rules.setsToWin) return match.player1?.id || null;
        if (b >= rules.setsToWin) return match.player2?.id || null;
        return null;
    };


    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');

        // Walidacja wstępna - czy user to sędzia
        if (!user) {
            const msg = 'Musisz być zalogowany, aby wprowadzić wynik.';
            setError(msg);
            toast.error(msg);
            return;
        }
        if (user?.id !== match?.referee?.id) {
            const msg = '403 – tylko sędzia może wprowadzać wynik tego meczu.';
            setError(msg);
            toast.error(msg);
            return;
        }

        // ============================================================
        // 1. KROK POTWIERDZENIA (CONFIRMATION DIALOG)
        // ============================================================
        const isConfirmed = window.confirm(
            "Czy na pewno chcesz zapisać ten wynik?\n\n" +
            "Tej operacji nie będzie można łatwo cofnąć. Upewnij się, że wynik jest poprawny."
        );

        if (!isConfirmed) {
            return; // Przerwij, jeśli użytkownik kliknął "Anuluj"
        }

        try {
            if (resultType !== 'NORMAL') {
                // Zakończenie administracyjne (WO/DQ/RET)
                const winnerId = adminWinner === 'p1' ? match.player1?.id : match.player2?.id;
                if (!winnerId) {
                    toast.warn('Wybierz zwycięzcę.');
                    return;
                }

                function mapOutcome(rt) {
                    if (rt === 'WO') return 'WALKOVER';
                    if (rt === 'DQ') return 'DISQUALIFICATION';
                    if (rt === 'RET') return 'RETIREMENT';
                    return 'NORMAL';
                }

                await updateMatchScore(matchId, {
                    status: 'finished',
                    winnerId,
                    outcome: mapOutcome(resultType),
                    matchSets: [],
                });
            } else {
                // Normalne zakończenie (z setami)
                const winnerId = calcWinnerId();
                if (!winnerId) {
                    // Tutaj też używamy toast zamiast tylko settera, żeby było widać
                    toast.warn(`Wynik nie rozstrzyga meczu. Potrzeba ${rules.setsToWin} wygranych setów.`);
                    return;
                }

                const payload = {
                    status: 'finished',
                    winnerId,
                    matchSets: sets.slice(0, maxSets).map((s, i) => ({
                        setNumber: i + 1,
                        player1Score: s.p1,
                        player2Score: s.p2,
                    })),
                };

                await updateMatchScore(matchId, payload);
            }

            // Sukces
            toast.success('Wynik został zapisany pomyślnie!');
            navigate(`/tournaments/${match.tournamentId}/details`, { replace: true });

        } catch (err) {
            // ============================================================
            // 2. OBSŁUGA BŁĘDÓW (ERROR HANDLING)
            // ============================================================
            console.error("Błąd zapisu wyniku:", err);

            // Wyciągamy czytelną wiadomość z błędu (backend zazwyczaj zwraca err.message lub err.payload.error)
            const errorMsg = err?.payload?.error || err?.message || 'Wystąpił nieoczekiwany błąd podczas zapisu.';

            // 1. Pokaż w Toast (dymek)
            toast.error(errorMsg);

            // 2. Pokaż też w interfejsie (czerwony napis pod przyciskiem), żeby nie znikało
            setError(errorMsg);
        }
    };

    if (loading) return <p>Ładowanie panelu sędziowskiego…</p>;
    if (error) return <p className="error">{error}</p>;
    if (!match) return <p className="error">Mecz o podanym ID nie istnieje.</p>;
    if (user?.id !== match?.referee?.id) {
        return <div className="error">403 – Brak uprawnień (tylko sędzia).</div>;
    }

    const breadcrumbItems = [
        { label: 'Home', href: '/' },
        {
            label: match?.tournament?.name ? `Turniej: ${match.tournament.name}` : `Turniej #${match?.tournamentId ?? ''}`,
            href: `/tournaments/${match?.tournamentId ?? ''}/details`,
        },
        { label: 'Panel sędziowski' },
    ];

    return (
        <div className="score-page-wrapper">
            <Breadcrumbs items={breadcrumbItems} />

            <div className="score-panel-container">
                <h2 className="score-panel-title">Panel sędziowski</h2>

                {/* Reguły meczu */}
                <div className="rules-banner">
                    <strong>Reguły meczu:</strong>{' '}
                    Best-of-{maxSets} (wygrane sety: {rules.setsToWin}), set do {rules.gamesPerSet} gemów, tie-break: {tieBreakLabel(tieType)}.
                </div>

                <div className="match-details">
                    <div className="player-name">{match.player1?.name} {match.player1?.surname}</div>
                    <div className="vs-label">vs</div>
                    <div className="player-name">{match.player2?.name} {match.player2?.surname}</div>
                </div>

                {/* Rodzaj zakończenia */}
                <div className="panel" style={{ marginBottom: 12 }}>
                    <label>
                        Rodzaj zakończenia:&nbsp;
                        <select
                            value={resultType}
                            onChange={(e) => setResultType(e.target.value)}
                        >
                            <option value="NORMAL">Normalny</option>
                            <option value="WO">Walkower (WO)</option>
                            <option value="DQ">Dyskwalifikacja (DQ)</option>
                            <option value="RET">Krecz (RET)</option>
                        </select>
                    </label>
                    {resultType !== 'NORMAL' && (
                        <label style={{ marginLeft: 16 }}>
                            Zwycięzca:&nbsp;
                            <select value={adminWinner} onChange={(e) => setAdminWinner(e.target.value)}>
                                <option value="p1">{match.player1?.name} {match.player1?.surname}</option>
                                <option value="p2">{match.player2?.name} {match.player2?.surname}</option>
                            </select>
                        </label>
                    )}
                </div>

                {/* Wygrane sety – live */}
                <div className="sets-scoreline">
                    <span>Wygrane sety:</span>
                    <strong>{p1Won}</strong>&nbsp;:&nbsp;<strong>{p2Won}</strong>
                    {(isResolved && resultType === 'NORMAL') && <span className="resolved-tag">— mecz rozstrzygnięty</span>}
                </div>

                {/* Formularz wyników setów */}
                <form onSubmit={handleSubmit} className="score-input-form">
                    <div className="sets-header">
                        <span>Set</span>
                        <span>{match.player1?.name}</span>
                        <span>{match.player2?.name}</span>
                        <span></span>
                    </div>

                    {sets.map((s, idx) => (
                        <div key={idx} className={`set-row ${resultType !== 'NORMAL' ? 'disabled' : ''}`}>
                            <span>Set {idx + 1}</span>

                            {/* Gracz 1: - input + */}
                            <div className="score-stepper">
                                <button
                                    type="button"
                                    className="score-step-btn"
                                    onClick={() => bumpScore(idx, 1, -1)}
                                    disabled={resultType !== "NORMAL"}
                                    aria-label={`Odejmij punkt: ${match.player1?.name} (set ${idx + 1})`}
                                >
                                    −
                                </button>

                                <input
                                    type="number"
                                    min={0}
                                    max={limitForSetAt(idx, sets, rules)}
                                    value={s.p1}
                                    onChange={(e) => handleScoreChange(idx, 1, e.target.value)}
                                    disabled={resultType !== 'NORMAL'}
                                    className="score-input"
                                    required
                                />

                                <button
                                    type="button"
                                    className="score-step-btn"
                                    onClick={() => bumpScore(idx, 1, +1)}
                                    disabled={resultType !== "NORMAL"}
                                    aria-label={`Dodaj punkt: ${match.player1?.name} (set ${idx + 1})`}
                                >
                                    +
                                </button>
                            </div>

                            {/* Gracz 2: - input + */}
                            <div className="score-stepper">
                                <button
                                    type="button"
                                    className="score-step-btn"
                                    onClick={() => bumpScore(idx, 2, -1)}
                                    disabled={resultType !== "NORMAL"}
                                    aria-label={`Odejmij punkt: ${match.player2?.name} (set ${idx + 1})`}
                                >
                                    −
                                </button>

                                <input
                                    type="number"
                                    min={0}
                                    max={limitForSetAt(idx, sets, rules)}
                                    value={s.p2}
                                    onChange={(e) => handleScoreChange(idx, 2, e.target.value)}
                                    disabled={resultType !== 'NORMAL'}
                                    className="score-input"
                                    required
                                />

                                <button
                                    type="button"
                                    className="score-step-btn"
                                    onClick={() => bumpScore(idx, 2, +1)}
                                    disabled={resultType !== "NORMAL"}
                                    aria-label={`Dodaj punkt: ${match.player2?.name} (set ${idx + 1})`}
                                >
                                    +
                                </button>
                            </div>

                            {resultType === 'NORMAL' && !isResolved && sets.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => handleRemoveSet(idx)}
                                    className="remove-set-btn"
                                    aria-label={`Usuń set ${idx + 1}`}
                                >
                                    &times;
                                </button>
                            )}
                        </div>
                    ))}


                    <div className="form-actions">
                        <button
                            type="button"
                            onClick={handleAddSet}
                            className="add-set-btn"
                            disabled={resultType !== 'NORMAL' || isResolved || sets.length >= maxSets}
                        >
                            Dodaj set
                        </button>
                        <button
                            type="submit"
                            className="submit-score-btn"
                            disabled={resultType === 'NORMAL' ? !isResolved : false}
                        >
                            Zapisz wynik
                        </button>
                    </div>
                </form>

                {message && <p className="success-message">{message}</p>}
                {error && <p className="error-message">{error}</p>}
            </div>
        </div>
    );
}
