// client/src/pages/AdminPanel.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import * as adminApi from '../services/adminService';
import { toast } from 'react-toastify';
import Breadcrumbs from '../components/Breadcrumbs';
import {
  listUsers,
  setUserActive,
  setUserRole,
  listTournaments,
  deleteTournament,
  setTournamentHidden,
  softDeleteTournament,
  setUserPassword,
} from '../services/adminService';
import '../styles/adminPanel.css';

export default function AdminPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const isAdmin = (user?.role || '').toLowerCase() === 'admin';
  const isModerator = isAdmin || ((user?.role || '').toLowerCase() === 'moderator');

  useEffect(() => {
    if (!isModerator) navigate('/', { replace: true });
  }, [isModerator, navigate]);

  const [tab, setTab] = useState(isAdmin ? 'users' : 'tournaments');

  // ===== USERS (admin only) =====
  const [uQuery, setUQuery] = useState('');
  const [uRole, setURole] = useState('');
  const [uActive, setUActive] = useState('');
  const [users, setUsers] = useState([]);
  const [uLoading, setULoading] = useState(false);
  const [uPage, setUPage] = useState(1);
  const [uLimit] = useState(25);
  const [uTotal, setUTotal] = useState(0);

  const loadUsers = async (page = uPage) => {
    if (!isAdmin) return;
    setULoading(true);
    try {
      const data = await adminApi.listUsers({
        query: uQuery,
        role: uRole,
        active: uActive,
        page,
        limit: uLimit,
      });
      setUsers(data.items || []);
      setUTotal(data.total || 0);
      setUPage(data.page || page);
    } catch (e) {
      toast.error(e.message || 'Nie udało się pobrać użytkowników');
    } finally {
      setULoading(false);
    }
  };
  useEffect(() => {
    if (tab === 'users') loadUsers(1);
  }, [tab]);
  const onFilterUsers = () => loadUsers(1);
  const uTotalPages = Math.max(1, Math.ceil(uTotal / uLimit));

  // ===== TOURNAMENTS (moderator+) =====
  const [tQuery, setTQuery] = useState('');
  const [tournaments, setTournaments] = useState([]);
  const [tLoading, setTLoading] = useState(false);
  const [tPage, setTPage] = useState(1);
  const [tLimit] = useState(25);
  const [tTotal, setTTotal] = useState(0);

  const loadTournaments = async (page = tPage) => {
    if (!isModerator) return;
    setTLoading(true);
    try {
      const data = await adminApi.listTournaments({ query: tQuery, page, limit: tLimit });
      setTournaments(data.items || []);
      setTTotal(data.total || 0);
      setTPage(data.page || page);
    } catch (e) {
      toast.error(e.message || 'Nie udało się pobrać turniejów');
    } finally {
      setTLoading(false);
    }
  };
  useEffect(() => {
    if (tab === 'tournaments') loadTournaments(1);
  }, [tab]);
  const onFilterTournaments = () => loadTournaments(1);
  const tTotalPages = Math.max(1, Math.ceil(tTotal / tLimit));

  // ===== Actions: users =====
  const toggleActive = async (u) => {
    try {
      await adminApi.setUserActive(u.id, !u.active);
      toast.success(!u.active ? 'Konto aktywne' : 'Konto dezaktywowane');
      loadUsers(uPage);
    } catch (e) {
      toast.error(e.message || 'Nie udało się zmienić statusu');
    }
  };

  const changeRole = async (u, role) => {
    try {
      await adminApi.setUserRole(u.id, role);
      toast.success('Zmieniono rolę');
      loadUsers(uPage);
    } catch (e) {
      toast.error(e.message || 'Nie udało się zmienić roli');
    }
  };

  const onResetPassword = async (targetUser) => {
    const pwd = window.prompt(
      `Podaj nowe hasło dla użytkownika ${targetUser.email} (min. 6 znaków):`
    );
    if (!pwd) return;
    if (pwd.length < 6) {
      toast.error('Hasło musi mieć co najmniej 6 znaków.');
      return;
    }
    try {
      await setUserPassword(targetUser.id, pwd);
      toast.success('Hasło użytkownika zostało zmienione.');
    } catch (e) {
      console.error(e);
      toast.error(e.message || 'Nie udało się zmienić hasła.');
    }
  };

  // ===== Actions: tournaments =====
  const hardDeleteTournament = async (t) => {
    if (!window.confirm(`Usunąć turniej „${t.name}” (twardo)?`)) return;
    try {
      await adminApi.deleteTournament(t.id);
      toast.success('Usunięto turniej');
      loadTournaments(tPage);
    } catch (e) {
      toast.error(e.message || 'Nie udało się usunąć turnieju');
    }
  };

  const hideTournament = async (t, hidden) => {
    try {
      await adminApi.setTournamentHidden(t.id, hidden);
      toast.success(hidden ? 'Ukryto turniej' : 'Przywrócono widoczność');
      loadTournaments(tPage);
    } catch (e) {
      toast.error(e.message || 'Nie udało się zmienić widoczności');
    }
  };

  const toggleApplications = async (t) => {
    try {
      await adminApi.setTournamentHidden(
        t.id,
        t.status === 'hidden' ? true : undefined,
        !t.applicationsOpen
      );
      toast.success(t.applicationsOpen ? 'Wstrzymano zapisy' : 'Otwarto zapisy');
      loadTournaments(tPage);
    } catch (e) {
      toast.error(e.message || 'Nie udało się zmienić zapisów');
    }
  };

  const softDelete = async (t) => {
    if (!window.confirm(`Oznaczyć „${t.name}” jako usunięty?`)) return;
    try {
      await adminApi.softDeleteTournament(t.id);
      toast.success('Oznaczono jako usunięty');
      loadTournaments(tPage);
    } catch (e) {
      toast.error(e.message || 'Nie udało się oznaczyć');
    }
  };

  // ===== breadcrumbs & pagination helper =====
  const crumbs = [
    { label: 'Home', href: '/' },
    { label: 'Administracja', href: '/admin' },
    { label: tab === 'users' ? 'Użytkownicy' : 'Turnieje' },
  ];

  const renderPagination = (page, totalPages, go) => (
    <div className="ap-pagination" aria-label="Paginacja">
      <button onClick={() => go(1)} disabled={page === 1} aria-label="Pierwsza">
        ⏮
      </button>
      <button
        onClick={() => go(Math.max(1, page - 1))}
        disabled={page === 1}
        aria-label="Poprzednia"
      >
        ‹
      </button>
      <span>
        Strona {page} / {totalPages}
      </span>
      <button
        onClick={() => go(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        aria-label="Następna"
      >
        ›
      </button>
      <button
        onClick={() => go(totalPages)}
        disabled={page === totalPages}
        aria-label="Ostatnia"
      >
        ⏭
      </button>
    </div>
  );

  return (
    <section className="container-fluid ap-wrap">
      <Breadcrumbs items={crumbs} />
      <h1>Panel administracyjny</h1>

      <div className="ap-tabs">
        {isAdmin && (
          <button
            className={`st-tab ${tab === 'users' ? 'active' : ''}`}
            onClick={() => setTab('users')}
          >
            Użytkownicy
          </button>
        )}
        {isModerator && (
          <button
            className={`st-tab ${tab === 'tournaments' ? 'active' : ''}`}
            onClick={() => setTab('tournaments')}
          >
            Turnieje
          </button>
        )}
      </div>

      {/* USERS */}
      {tab === 'users' && isAdmin && (
        <div className="card">
          <div className="card-header">Użytkownicy</div>
          <div className="card-body">
            <div className="ap-filters">
              <input
                className="input"
                placeholder="Szukaj (email, imię, nazwisko)…"
                value={uQuery}
                onChange={(e) => setUQuery(e.target.value)}
              />
              <select
                className="input"
                value={uRole}
                onChange={(e) => setURole(e.target.value)}
              >
                <option value="">— rola —</option>
                <option value="user">user</option>
                <option value="moderator">moderator</option>
                <option value="admin">admin</option>
              </select>
              <select
                className="input"
                value={uActive}
                onChange={(e) => setUActive(e.target.value)}
              >
                <option value="">— aktywne? —</option>
                <option value="true">aktywne</option>
                <option value="false">dezaktywowane</option>
              </select>
              <button
                className="btn-primary"
                onClick={onFilterUsers}
                disabled={uLoading}
              >
                Filtruj
              </button>
            </div>

            {uLoading ? (
              <div className="muted">Ładowanie…</div>
            ) : users.length === 0 ? (
              <div className="muted">Brak wyników</div>
            ) : (
              <>
                <div className="tbl-wrap">
                  <table className="tbl" role="table">
                    <thead>
                      <tr>
                        <th style={{ width: 80 }}>ID</th>
                        <th>Imię</th>
                        <th>Nazwisko</th>
                        <th>E-mail</th>
                        <th style={{ width: 170 }}>Aktywne</th>
                        <th style={{ width: 30 }}>Rola</th>
                        <th style={{ width: 140 }}>Hasło</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => {
                        const curRole = (
                          u.user_roles?.[0]?.roles?.role_name ||
                          u.user_roles?.[0]?.role ||
                          'user'
                        ).toLowerCase();
                        return (
                          <tr key={u.id}>
                            <td className="mono">{u.id}</td>
                            <td>{u.name}</td>
                            <td>{u.surname}</td>
                            <td className="nowrap">{u.email}</td>

                            {/* AKTYWNE: badge + przycisk */}
                            <td>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                }}
                              >
                                {u.active ? (
                                  <span className="badge ok">tak</span>
                                ) : (
                                  <span className="badge off">nie</span>
                                )}
                                <button
                                  className="btn-secondary btn-sm"
                                  onClick={() => toggleActive(u)}
                                >
                                  {u.active ? 'Dezaktywuj' : 'Aktywuj'}
                                </button>
                              </div>
                            </td>

                            {/* ROLA: badge + kompaktowy select */}
                            <td>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  justifyContent: 'space-between',
                                }}
                              >
                                <span
                                  className={
                                    curRole === 'admin'
                                      ? 'badge role-admin'
                                      : curRole === 'moderator'
                                        ? 'badge role-moderator'
                                        : 'badge role-user'
                                  }
                                  style={{ flexShrink: 0 }}
                                >
                                  {curRole}
                                </span>
                                <select
                                  className="input input-sm"
                                  style={{ maxWidth: '110px', paddingInline: '0.4rem' }}
                                  value={curRole}
                                  onChange={(e) => changeRole(u, e.target.value)}
                                >
                                  <option value="user">user</option>
                                  <option value="moderator">moderator</option>
                                  <option value="admin">admin</option>
                                </select>
                              </div>
                            </td>

                            {/* HASŁO: tylko akcja */}
                            <td className="actions">
                              <button
                                className="btn-secondary btn-sm"
                                onClick={() => onResetPassword(u)}
                              >
                                Zmień hasło
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {renderPagination(uPage, uTotalPages, (p) => loadUsers(p))}
              </>
            )}
          </div>
        </div>
      )}

      {/* TOURNAMENTS */}
      {tab === 'tournaments' && isModerator && (
        <div className="card">
          <div className="card-header">Turnieje</div>
          <div className="card-body">
            <div className="ap-filters">
              <input
                className="input"
                placeholder="Szukaj po nazwie…"
                value={tQuery}
                onChange={(e) => setTQuery(e.target.value)}
              />
              <button
                className="btn-primary"
                onClick={onFilterTournaments}
                disabled={tLoading}
              >
                Filtruj
              </button>
            </div>

            {tLoading ? (
              <div className="muted">Ładowanie…</div>
            ) : tournaments.length === 0 ? (
              <div className="muted">Brak wyników</div>
            ) : (
              <>
                <div className="tbl-wrap">
                  <table className="tbl" role="table">
                    <thead>
                      <tr>
                        <th style={{ width: 70 }}>ID</th>
                        <th>Nazwa</th>
                        <th>Organizer</th>
                        <th>Miasto</th>
                        <th>Data</th>
                        <th>Status</th>
                        <th style={{ width: 420 }}>Akcje</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tournaments.map((t) => (
                        <tr key={t.id}>
                          <td className="mono">{t.id}</td>
                          <td>{t.name}</td>
                          <td>
                            {t.organizer
                              ? `${t.organizer.name} ${t.organizer.surname}`
                              : '—'}
                          </td>
                          <td>{t.city || '—'}</td>
                          <td className="nowrap">
                            {t.start_date
                              ? new Date(t.start_date).toLocaleDateString()
                              : '—'}{' '}
                            –{' '}
                            {t.end_date
                              ? new Date(t.end_date).toLocaleDateString()
                              : '—'}
                          </td>
                          <td>
                            <div className="status-cell">
                              <span className={`status-dot ${t.status}`}></span>{' '}
                              {t.status || '—'}
                              {t.applicationsOpen === false && (
                                <div className="muted small">
                                  zapisy wstrzymane
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="actions">
                            <button
                              className="btn-secondary btn-sm"
                              onClick={() =>
                                hideTournament(t, t.status !== 'hidden')
                              }
                            >
                              {t.status === 'hidden' ? 'Pokaż' : 'Ukryj'}
                            </button>
                            <button
                              className="btn-secondary btn-sm"
                              onClick={() => toggleApplications(t)}
                            >
                              {t.applicationsOpen
                                ? 'Wstrzymaj zapisy'
                                : 'Otwórz zapisy'}
                            </button>
                            <button
                              className="btn-warning btn-sm"
                              onClick={() => softDelete(t)}
                            >
                              Oznacz jako usunięty
                            </button>
                            <button
                              className="btn-delete btn-sm"
                              onClick={() => hardDeleteTournament(t)}
                            >
                              Usuń (twardo)
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {renderPagination(tPage, tTotalPages, (p) => loadTournaments(p))}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
