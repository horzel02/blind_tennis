// src/components/GroupStandings.jsx
import React, { useEffect, useState, useRef } from 'react';
import { getGroupStandings } from '../services/matchService';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

import { socketOrigin } from "../services/api";

export default function GroupStandings({ tournamentId, isOrganizer }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [err, setErr] = useState(null);
  const socketRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getGroupStandings(tournamentId);
      setGroups(data || []);
      setErr(null);
    } catch (e) {
      setErr(e.message || 'Nie udało się pobrać tabel.');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [tournamentId]);

  useEffect(() => {
    const s = io(socketOrigin(), { withCredentials: true });
    socketRef.current = s;

    const tid = Number(tournamentId);
    s.emit("join-tournament", tid);

    const onInvalidate = () => load();
    s.on("standings-invalidate", onInvalidate);

    return () => {
      s.emit("leave-tournament", tid);
      s.off("standings-invalidate", onInvalidate);
      s.disconnect();
    };
  }, [tournamentId]);


  return (
    <section className="group-standings">
      <header className="group-standings-header">
        <h2 className="section-title">Faza grupowa – tabele</h2>
        <p className="group-standings-subtitle">
          Bilans meczów, setów i gemów w poszczególnych grupach.
        </p>
      </header>

      {loading ? (
        <p>Ładowanie tabel…</p>
      ) : err ? (
        <p className="error">Błąd: {err}</p>
      ) : !groups.length ? (
        <p>Brak danych tabelowych.</p>
      ) : (
        <div className="group-standings-grid">
          {groups.map((g) => (
            <article key={g.group} className="group-card">
              <header className="group-card-header">
                <h3 className="group-card-title">{g.group}</h3>
                {isOrganizer && (
                  <span className="group-card-pill">
                    {g.standings?.length || 0} zawodników
                  </span>
                )}
              </header>

              <div className="group-table-wrapper">
                <table className="standings-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Zawodnik</th>
                      <th title="Mecze">M</th>
                      <th title="Wygrane">W</th>
                      <th title="Przegrane">P</th>
                      <th>Sety</th>
                      <th>Gemy</th>
                      <th>Pkt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.standings.map((row, idx) => (
                      <tr key={row.userId}>
                        <td className="col-rank">{idx + 1}</td>
                        <td className="col-player">
                          <span className="player-name">
                            {row.name} {row.surname}
                          </span>
                        </td>
                        <td>{row.played}</td>
                        <td>{row.wins}</td>
                        <td>{row.losses}</td>
                        <td>
                          {row.setsWon}:{row.setsLost}
                        </td>
                        <td>
                          {row.gamesWon}:{row.gamesLost}
                        </td>
                        <td className="col-points">{row.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="header-actions" style={{ marginTop: '1.5rem' }}>
        <button
          className="btn-primary"
          onClick={() => navigate(`/tournaments/${tournamentId}/bracket`)}
          title="Przejdź do drabinki KO"
        >
          Drabinka Fazy Pucharowej
        </button>
      </div>
    </section>
  );
}
