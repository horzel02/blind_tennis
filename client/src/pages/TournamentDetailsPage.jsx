// client/src/pages/TournamentDetailsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, MapPin, Users, Calendar, Share2, Download } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import InvitePlayerModal from '../components/InvitePlayerModal';
import '../styles/tournamentDetails.css';

import * as tournamentService from '../services/tournamentService';
import * as registrationService from '../services/registrationService';
import * as roleService from '../services/tournamentUserRoleService';
import * as matchService from '../services/matchService';
import { listNotifications, markRead } from '../services/notificationService';
import { guardianApi } from '../services/guardianService';
import Breadcrumbs from '../components/Breadcrumbs';
import TournamentMatches from '../components/TournamentMatches';
import AssignRefereeModal from '../components/AssignRefereeModal';
import GroupStandings from '../components/GroupStandings';
import GuardianPickerModal from '../components/GuardianPickerModal.jsx';
import TournamentStatusBanner, { getTournamentLocks } from '../components/TournamentStatusBanner';


import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function TournamentDetailsPage() {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();

  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [myRoles, setMyRoles] = useState([]);

  const [registrationStatus, setRegistrationStatus] = useState(null);
  const [registrationId, setRegistrationId] = useState(null);
  const [checkingReg, setCheckingReg] = useState(true);

  const [acceptedCount, setAcceptedCount] = useState(0);
  const limit = Number(tournament?.participant_limit ?? Infinity);
  const capacityOK = acceptedCount < limit;

  const [isPlayerModalOpen, setPlayerModalOpen] = useState(false);
  const [isRoleModalOpen, setRoleModalOpen] = useState(false);
  const [roles, setRoles] = useState([]);
  const [isRefereeModalOpen, setRefereeModalOpen] = useState(false);

  const [isGuardianModalOpen, setGuardianModalOpen] = useState(false);
  const [guardianPlayerId, setGuardianPlayerId] = useState(null);
  const [guardians, setGuardians] = useState([]);
  const [guardiansLoading, setGuardiansLoading] = useState(false);
  const [myGuardianInvite, setMyGuardianInvite] = useState(null);
  const [myRefInvite, setMyRefInvite] = useState(null);
  const [myGuardianLink, setMyGuardianLink] = useState(null);
  const { isHidden, isDeleted, readOnly, signOff } = getTournamentLocks(tournament);


  const refreshGuardians = useCallback(async (pid = guardianPlayerId) => {
    if (!tournament?.id || !pid) return;
    setGuardiansLoading(true);
    try {
      const rows = await guardianApi.list({ tid: tournament.id, playerId: pid });
      setGuardians(rows || []);
    } catch (e) {
      console.error(e);
      setGuardians([]);
    } finally {
      setGuardiansLoading(false);
    }
  }, [tournament?.id, guardianPlayerId]);

  useEffect(() => {
    (async () => {
      if (!user || !tournament?.id) {
        setMyGuardianLink(null);
        return;
      }
      try {
        const rows = await guardianApi.list({ tid: tournament.id });
        const mine = (rows || []).find(
          r => r.guardianUserId === user.id && r.status === 'accepted'
        );
        setMyGuardianLink(mine || null);
      } catch {
        setMyGuardianLink(null);
      }
    })();
  }, [user, tournament?.id]);


  useEffect(() => {
    (async () => {
      if (!user || !tournament) return;
      const rows = await guardianApi.list({ tid: tournament.id });
      const mine = (rows || []).find(r => r.guardianUserId === user.id && r.status === 'invited');
      setMyGuardianInvite(mine || null);
    })();
  }, [user, tournament]);

  useEffect(() => {
    if (!tournament?.id || !user?.id) return;
    setGuardianPlayerId(user.id);
    refreshGuardians(user.id);
  }, [tournament?.id, user?.id, refreshGuardians]);


  // Referee invite – pokaż kartę akceptacji na stronie
  useEffect(() => {
    (async () => {
      if (!user || !tournament) return;
      try {
        const rows = await listNotifications();
        const n = (rows || []).find(
          x => !x.readAt &&
            x.type === 'referee_invite' &&
            (x.meta?.tournamentId === tournament.id ||
              x.metaJson?.tournamentId === tournament.id)
        );
        setMyRefInvite(n || null);
      } catch {
        setMyRefInvite(null);
      }
    })();
  }, [user, tournament]);

  // ====== Fetch turnieju ======
  useEffect(() => {
    setLoading(true);
    tournamentService
      .getTournamentById(id)
      .then(setTournament)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  // ====== Role / rejestracja / accepted count ======
  const refreshRoles = useCallback(async () => {
    try {
      if (!tournament?.id) return;
      setRoles(await roleService.listRoles(tournament.id));
    } catch {
    }
  }, [tournament?.id]);

  const fetchMyRegistration = useCallback(() => {
    if (!tournament || !user) {
      setCheckingReg(false);
      return;
    }
    setCheckingReg(true);
    registrationService
      .getMyRegistration(tournament.id)
      .then((reg) => {
        if (reg) {
          setRegistrationStatus(reg.status);
          setRegistrationId(reg.id);
        } else {
          setRegistrationStatus(null);
          setRegistrationId(null);
        }
      })
      .catch(console.error)
      .finally(() => setCheckingReg(false));
  }, [tournament, user]);

  const fetchAcceptedCount = useCallback(() => {
    if (!tournament) return;
    registrationService.getAcceptedCount(tournament.id).then(setAcceptedCount).catch(console.error);
  }, [tournament]);

  useEffect(() => {
    if (!tournament) return;
    fetchMyRegistration();
    fetchAcceptedCount();
    roleService
    if (user?.id === tournament.organizer_id) {
      roleService.listRoles(tournament.id)
        .then(setRoles)
        .catch(() => setRoles([]));
    } else {
    }
  }, [tournament, fetchMyRegistration, fetchAcceptedCount]);

  useEffect(() => {
    if (!user || !tournament?.id) return;
    roleService.getMyRoles(tournament.id)
      .then(setMyRoles)
      .catch(() => setMyRoles([]));
  }, [user, tournament?.id]);

  const amReferee = myRoles.some(r => r.role === 'referee');

  const acceptRefereeOnPage = async () => {
    try {
      await roleService.acceptRefereeInvite(tournament.id);
      if (myRefInvite) await markRead(myRefInvite.id);
      setMyRefInvite(null);
      toast.success('Dołączyłeś jako sędzia');
      setRoles(prev => [...prev, { id: `tmp-${Date.now()}`, role: 'referee', user }]);
    } catch (e) {
      toast.error(e?.message || 'Nie udało się zaakceptować');
    }
  };

  const declineRefereeOnPage = async () => {
    try {
      await roleService.declineRefereeInvite(tournament.id);
      if (myRefInvite) await markRead(myRefInvite.id);
      setMyRefInvite(null);
      toast.info('Odrzucono zaproszenie');
    } catch (e) {
      toast.error(e?.message || 'Nie udało się odrzucić');
    }
  };



  // ====== Guardy i pomocnicze ======
  if (loading) return <p>Ładowanie…</p>;
  if (error) return <p className="error">Błąd: {error}</p>;
  if (!tournament) return <p>Turniej nie znaleziono.</p>;

  const {
    name,
    description,
    street,
    postalCode,
    city,
    country,
    start_date,
    end_date,
    registration_deadline,
    participant_limit,
    applicationsOpen,
    type,
    organizer_id
  } = tournament;

  const isLoggedIn = Boolean(user);
  const isCreator = user?.id === organizer_id;
  const isTournyOrg = roles.some((r) => r.role === 'organizer' && r.user.id === user?.id);
  const address = `${street}, ${postalCode} ${city}, ${country}`;
  const isInviteOnly = type === 'invite';
  const isFull = Number.isFinite(limit) && acceptedCount >= limit;

  // ====== Normalizacja płci  ======
  const norm = (g) => {
    if (!g) return null;
    const s = String(g).trim().toLowerCase();
    if (['m', 'male', 'men', 'man', 'mezczyzni', 'mężczyźni', 'mezczyzna', 'mężczyzna', 'm.'].includes(s)) return 'male';
    if (['w', 'female', 'women', 'woman', 'kobiety', 'k', 'f', 'kobieta', 'k.'].includes(s)) return 'female';
    if (['coed', 'mixed', 'mix', 'open'].includes(s)) return 'coed';
    return null;
  };

  const genderPolish = (g) => (g === 'male' ? 'mężczyzn' : g === 'female' ? 'kobiet' : 'coed');
  const userGenderLabel = (g) => (g === 'male' ? 'mężczyzna' : g === 'female' ? 'kobieta' : '—');

  // User gender
  const userGender = norm(user?.gender);

  // Kategorie profil płci turnieju
  const catGendersSet = new Set((tournament?.categories || []).map((c) => norm(c?.gender)).filter(Boolean));
  const hasCoed = catGendersSet.has('coed');
  const sexSet = new Set([...catGendersSet].filter((g) => g === 'male' || g === 'female'));

  // Jedna płeć  limit; dwie albo coed open
  const genderLimited = !hasCoed && sexSet.size === 1;
  const requiredGender = genderLimited ? [...sexSet][0] : null;

  // Rejestracja: deadline
  const deadlineOK = (() => {
    if (!registration_deadline) return true;
    const end = new Date(registration_deadline);
    end.setHours(23, 59, 59, 999);
    return new Date() <= end;
  })();

  // Czy w ogóle można się rejestrować teraz 
  const canRegisterNow = Boolean(!readOnly && applicationsOpen && deadlineOK && capacityOK);

  // Prewalidacja płci
  const canPrevalidate = !!userGender;
  const genderConflict = genderLimited && canPrevalidate && userGender !== requiredGender;

  // Chipsy (kategorie i płeć)
  const normChip = (g) => {
    const x = norm(g);
    if (x === 'male') return 'M';
    if (x === 'female') return 'W';
    if (x === 'coed') return 'Coed';
    return null;
  };
  const getCategoryChips = (t) => {
    if (!t) return [];
    if (Array.isArray(t.categories) && t.categories.length) {
      return t.categories
        .map((c) => (typeof c === 'string' ? c : c?.categoryName ?? c?.name ?? c?.label ?? ''))
        .filter(Boolean);
    }
    return t.category ? [t.category] : [];
  };
  const computeGenderChips = (t) => {
    if (!t) return [];
    const set = new Set((t.categories || []).map((c) => normChip(c?.gender)).filter(Boolean));
    if (set.has('Coed') || (set.has('M') && set.has('W'))) return ['Coed'];
    return Array.from(set);
  };

  const categoryChips = getCategoryChips(tournament);
  const genderChips = computeGenderChips(tournament);

  const formulaLabel = ({
    towarzyski: 'Towarzyski',
    mistrzowski: 'Mistrzowski'
  })[tournament.formula] || 'Open';


  const openGuardianModalFor = (pid) => {
    setGuardianPlayerId(pid);
    setGuardianModalOpen(true);
    refreshGuardians(pid);
  };

  const removeGuardian = async (gId) => {
    if (!window.confirm('Usunąć opiekuna?')) return;
    try {
      await guardianApi.remove(gId);
      await refreshGuardians();
      toast.success('Usunięto opiekuna');
      setTimeout(() => window.location.reload(), 300);
    } catch (e) {
      toast.error(e?.message || 'Błąd usuwania');
    }
  };


  // ====== Handlery ======
  const handleRegister = async () => {
    if (readOnly) {
      toast.error('Turniej jest zablokowany.');
      return;
    }
    if (!applicationsOpen) {
      toast.error('Zgłoszenia są zamknięte.');
      return;
    }
    if (!deadlineOK) {
      toast.error('Termin rejestracji minął.');
      return;
    }
    if (!capacityOK) {
      toast.error('Brak miejsc (limit osiągnięty).');
      return;
    }

    try {
      await registrationService.createRegistration(tournament.id);
      fetchMyRegistration();
      fetchAcceptedCount();
      toast.success('Zgłoszenie wysłane.');
    } catch (err) {
      const code = err?.payload?.code || err?.code || err?.response?.data?.code;
      const msg =
        err?.payload?.error ||
        err?.response?.data?.error ||
        err?.message ||
        'Nie udało się wysłać zgłoszenia.';

      if (code === 'GENDER_REQUIRED' || code === 'GENDER_MISMATCH') {
        toast.error(msg);
      } else {
        toast.error(msg);
      }
    }
  };

  const handleUnregister = async () => {
    if (!window.confirm('Wycofać zgłoszenie?')) return;
    try {
      await registrationService.deleteRegistration(registrationId);
      setRegistrationStatus(null);
      setRegistrationId(null);
      fetchAcceptedCount();
      toast.success('Zgłoszenie wycofane');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleAddPlayer = async (u) => {
    try {
      await tournamentService.addParticipant(tournament.id, u.id);
      fetchAcceptedCount();
      toast.success(`${u.name} zaproszony!`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleAddOrganizer = async (u) => {
    try {
      await roleService.addRole(tournament.id, u.id, 'organizer');
      setRoles(await roleService.listRoles(tournament.id));
      toast.success(`${u.name} dodany jako organizator`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleRemoveOrganizer = async (roleRecordId) => {
    if (!window.confirm('Usunąć organizatora?')) return;
    try {
      await roleService.removeRole(tournament.id, roleRecordId);
      setRoles(await roleService.listRoles(tournament.id));
      toast.success('Usunięto organizatora');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleAcceptInvite = async () => {
    try {
      const upd = await registrationService.updateRegistrationStatus(registrationId, { status: 'accepted' });
      setRegistrationStatus(upd.status);
      fetchAcceptedCount();
      toast.success('Zaproszenie przyjęte!');
    } catch (err) {
      toast.error('Błąd przy akceptacji: ' + err.message);
    }
  };

  const handleDeclineInvite = async () => {
    if (!window.confirm('Odrzucić zaproszenie?')) return;
    try {
      await registrationService.deleteRegistration(registrationId);
      setRegistrationStatus(null);
      setRegistrationId(null);
      fetchAcceptedCount();
      toast.success('Zaproszenie odrzucone');
    } catch (err) {
      toast.error('Błąd przy odrzuceniu: ' + err.message);
    }
  };

  const handleResignAsReferee = async () => {
    if (!window.confirm('Na pewno chcesz się wypisać z roli sędziego w tym turnieju?')) return;
    try {
      await roleService.resignAsReferee(tournament.id);
      toast.success('Wypisano z roli sędziego');
      setRoles(prev => prev.filter(r => !(r.role === 'referee' && r.user?.id === user?.id)));
      setTimeout(() => window.location.reload(), 300);
    } catch (e) {
      toast.error(e?.message || 'Nie udało się wypisać');
    }
  };

  const handleResignAsGuardian = async () => {
    if (!myGuardianLink?.id) return;
    if (!window.confirm('Na pewno chcesz się wypisać jako opiekun w tym turnieju?')) return;
    try {
      await guardianApi.remove(myGuardianLink.id);
      toast.success('Wypisano z roli opiekuna');
      setMyGuardianLink(null);
      refreshGuardians();
      setTimeout(() => window.location.reload(), 300);
    } catch (e) {
      toast.error(e?.message || 'Nie udało się wypisać jako opiekun');
    }
  };


  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Link skopiowany!');
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(tournament, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tournament-${tournament.id}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async () => {
    if (!window.confirm('Na pewno usunąć turniej?')) return;
    try {
      await tournamentService.deleteTournament(tournament.id);
      navigate('/tournaments');
    } catch (err) {
      toast.error('Błąd przy usuwaniu: ' + err.message);
    }
  };

  const handleGenerateMatches = async () => {
    if (
      !window.confirm(
        'Czy na pewno chcesz wygenerować mecze turnieju? Spowoduje to usunięcie wszystkich istniejących meczów!'
      )
    ) {
      return;
    }
    try {
      await matchService.generateTournamentStructure(id);
      toast.success('Mecze wygenerowane pomyślnie!');
      window.location.reload();
    } catch (err) {
      toast.error(err.message || 'Wystąpił błąd podczas generowania meczów.');
    }
  };

  const organizerIds = new Set(roles.filter((r) => r.role === 'organizer').map((r) => r.user.id));

  const renderProgressBar = (current, total) => {
    const pct = total ? Math.round((current / total) * 100) : 0;

    return (
      <div className="progress-bar" aria-label={`${current}/${total} uczestników`}>
        <div className="progress-fill" style={{ width: `${pct}%` }} />
        <span className="progress-text">
          {current}/{total || '∞'}
        </span>
      </div>
    );
  };

  // ====== UI ======
  function MapPreview({ address }) {
    const src = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
    return (
      <div className="map-preview">
        <iframe title="Mapa" src={src} frameBorder="0" allowFullScreen />
      </div>
    );
  }

  return (
    <section className="tournament-details container" role="main">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Turnieje', href: '/tournaments' }, { label: name }]} />

      <div className="details-grid">
        <div className="left-panel">
          <h1 className="details-title">{name}</h1>
          <TournamentStatusBanner tournament={tournament} />
          {description && <p className="details-description">{description}</p>}

          <div className="chips">
            {getCategoryChips(tournament).map((txt, i) => (
              <span key={`cat-${i}-${txt}`} className="chip">
                {txt}
              </span>
            ))}
            {genderChips.map((txt, i) => (
              <span key={`gender-${i}-${txt}`} className="chip">
                {txt}
              </span>
            ))}
            {genderLimited && (
              <span className="chip chip-info">Tylko dla {genderPolish(requiredGender)}</span>
            )}
            <span className="chip chip-info">{formulaLabel}</span>
          </div>

          <p className="icon-label">
            <Clock size={16} /> {new Date(start_date).toLocaleDateString()} – {new Date(end_date).toLocaleDateString()}
          </p>
          <p className="icon-label">
            <Users size={16} /> Status zapisów:{' '}
            {isInviteOnly
              ? 'tylko na zaproszenie'
              : isFull
                ? 'lista pełna (brak miejsc)'
                : applicationsOpen
                  ? 'otwarta'
                  : 'zamknięta'}
          </p>

          <p className="icon-label">
            <Users size={16} /> Limit miejsc: {participant_limit || '∞'}
          </p>
          <div className="progress-container">
            <p>
              <Users size={16} /> Uczestnicy:
            </p>
            {renderProgressBar(acceptedCount, participant_limit)}
          </div>
        </div>

        <div className="right-panel">
          <p className="icon-label">
            <MapPin size={16} /> {address}
          </p>
          <MapPreview address={address} />
          <p className="icon-label">
            <Calendar size={16} /> Rejestracja do:{' '}
            {registration_deadline ? new Date(registration_deadline).toLocaleDateString() : 'brak'}
          </p>
        </div>
      </div>

      <div className="public-actions">
        {readOnly && (
          <p className="muted">Ten turniej jest zablokowany — akcje uczestników są niedostępne.</p>
        )}
        {!isLoggedIn && <p>Musisz się <a href="/login">zalogować</a>, aby się zapisać</p>}

        {isLoggedIn && registrationStatus === 'invited' && (
          <>
            <p>Otrzymałeś zaproszenie do tego turnieju!</p>
            <button className="btn-primary" onClick={handleAcceptInvite}>
              Akceptuj zaproszenie
            </button>
            <button className="btn-secondary" onClick={handleDeclineInvite}>
              Odrzuć zaproszenie
            </button>
          </>
        )}

        {isLoggedIn && registrationStatus !== 'invited' && type === 'invite' && (
          <p>Turniej wyłącznie na zaproszenia. Skontaktuj się z organizatorem.</p>
        )}

        {isLoggedIn && registrationStatus !== 'invited' && type !== 'invite' && (
          checkingReg ? (
            <p>Sprawdzam stan zgłoszenia…</p>
          ) : registrationStatus === null ? (
            canRegisterNow ? (
              <button
                className="btn-primary"
                onClick={handleRegister}
                disabled={readOnly || !canRegisterNow || genderConflict}
                title={
                  readOnly
                    ? 'Turniej zablokowany'
                    : !applicationsOpen
                      ? 'Zgłoszenia zamknięte'
                      : !deadlineOK
                        ? 'Po terminie'
                        : !capacityOK
                          ? 'Brak miejsc'
                          : genderConflict
                            ? `Ten turniej jest wyłącznie dla ${genderPolish(requiredGender)}.`
                            : undefined
                }
              >
                Zgłoś udział
              </button>
            ) : (
              <button className="btn-secondary" disabled>
                Zamknięte zgłoszenia
              </button>
            )
          ) : registrationStatus === 'pending' ? (
            <>
              <p>Twoje zgłoszenie czeka na akceptację.</p>
              <button className="btn-secondary" onClick={handleUnregister}>
                Wycofaj zgłoszenie
              </button>
            </>
          ) : registrationStatus === 'accepted' ? (
            <>
              <p>Jesteś zakwalifikowany do turnieju!</p>
              <button
                className="btn-secondary"
                onClick={handleUnregister}
                disabled={readOnly}
                title={readOnly ? 'Turniej zablokowany' : undefined}
              >
                Wypisz się z turnieju
              </button>
            </>
          ) : (
            <p>Niestety, Twoje zgłoszenie zostało odrzucone.</p>
          )
        )}
      </div>

      {isLoggedIn && registrationStatus === 'accepted' && (
        <div style={{ marginTop: 8 }}>
          <button className="btn-primary" onClick={() => openGuardianModalFor(user.id)} disabled={readOnly}
            title={readOnly ? 'Turniej zablokowany' : undefined}>
            Dodaj opiekuna
          </button>
        </div>
      )}
      {(guardiansLoading || guardians.length > 0) && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="card-header">Opiekunowie zawodnika</div>
          <div className="card-body">
            {guardiansLoading ? (
              <div className="muted">Ładowanie…</div>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {guardians.map(g => (
                  <li key={g.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <span>
                      {g.guardian ? `${g.guardian.name} ${g.guardian.surname}` : '—'}{' '}
                      <span className="muted">({g.status})</span>
                    </span>
                    <button className="btn-secondary" onClick={() => removeGuardian(g.id)}>
                      Usuń
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {isLoggedIn && myGuardianLink && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-header">Twoja rola opiekuna</div>
          <div className="card-body">
            Jesteś opiekunem zawodnika{' '}
            <strong>
              {myGuardianLink.player?.name} {myGuardianLink.player?.surname}
            </strong>
            .
            <div style={{ marginTop: 8 }}>
              <button className="btn-secondary" onClick={handleResignAsGuardian}>
                Wypisz się jako opiekun
              </button>
            </div>
          </div>
        </div>
      )}


      {isLoggedIn && myGuardianInvite && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-header">Zaproszenie jako opiekun</div>
          <div className="card-body">
            Zaproszono Cię jako opiekuna zawodnika <strong>{myGuardianInvite.player?.name} {myGuardianInvite.player?.surname}</strong>.
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button className="btn-primary" onClick={async () => {
                await guardianApi.accept(myGuardianInvite.id);
                toast.success('Przyjęto zaproszenie opiekuna');
                setMyGuardianInvite(null);
              }}>Akceptuj</button>
              <button className="btn-secondary" onClick={async () => {
                await guardianApi.decline(myGuardianInvite.id);
                toast.info('Odrzucono zaproszenie');
                setMyGuardianInvite(null);
              }}>Odrzuć</button>
            </div>
          </div>
        </div>
      )}

      {isLoggedIn && myRefInvite && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-header">Zaproszenie do sędziowania</div>
          <div className="card-body">
            Organizator zaprasza Cię do sędziowania tego turnieju.
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button className="btn-primary" onClick={acceptRefereeOnPage} disabled={readOnly}
                title={readOnly ? 'Turniej zablokowany' : undefined}>Akceptuj</button>
              <button className="btn-secondary" onClick={declineRefereeOnPage}>Odrzuć</button>
            </div>
          </div>
        </div>
      )}

      {isLoggedIn && amReferee && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-header">Twoja rola sędzia</div>
          <div className="card-body">
            <div style={{ marginTop: 8 }}>
              <button className="btn-secondary" onClick={handleResignAsReferee} disabled={readOnly}
                title={readOnly ? 'Turniej zablokowany' : undefined}>
                Wypisz się jako sędzia
              </button>
            </div>
          </div>
        </div>
      )}

      {(isCreator || isTournyOrg) && (
        <div className="organizer-section">
          <div className="organizer-list">
            <div className="organizer-list-header">
              <h2>Organizatorzy</h2>
              <button className="btn-primary btn-add-org" onClick={() => setRoleModalOpen(true)}>
                Dodaj organizatora
              </button>
            </div>
            <ul>
              {roles
                .filter((r) => r.role === 'organizer')
                .map((r) => (
                  <li key={r.id}>
                    <span className="org-name">
                      {r.user.name} {r.user.surname}
                    </span>
                    {r.user.id !== user.id && (
                      <button className="btn-delete" onClick={() => handleRemoveOrganizer(r.id)} disabled={readOnly}
                        title={readOnly ? 'Turniej zablokowany' : undefined}>
                        Usuń
                      </button>
                    )}
                  </li>
                ))}
            </ul>
          </div>

          <div className="organizer-actions">
            <h2>Opcje organizatora:</h2>
            <div className="actions-toolbar">
              <button className="btn-primary" onClick={() => navigate(`/tournaments/${tournament.id}/manage/registrations`)} disabled={readOnly}
                title={readOnly ? 'Turniej zablokowany' : undefined}>
                Zarządzaj zgłoszeniami
              </button>
              <button className="btn-primary" onClick={() => setPlayerModalOpen(true)} disabled={readOnly}
                title={readOnly ? 'Turniej zablokowany' : undefined}>
                Dodaj zawodnika
              </button>
              <button
                className="btn-primary"
                onClick={handleGenerateMatches}
                disabled={readOnly}
                title={readOnly
                  ? 'Turniej zablokowany'
                  : 'Na podstawie ustawień turnieju utworzy grupy i/lub drabinkę KO oraz mecze'}
              >
                Utwórz strukturę meczów
              </button>
              <button className="btn-primary" onClick={() => setRefereeModalOpen(true)} disabled={readOnly}
                title={readOnly ? 'Turniej zablokowany' : undefined}>
                Zaproś sędziego
              </button>
              <button className="btn-secondary" onClick={() => navigate(`/tournaments/${tournament.id}/edit`)} disabled={readOnly}
                title={readOnly ? 'Turniej zablokowany' : undefined}>
                Edytuj turniej
              </button>
              <button className="btn-delete" onClick={handleDelete} disabled={readOnly}
                title={readOnly ? 'Turniej jest już usunięty' : undefined}>
                Usuń turniej
              </button>
            </div>
          </div>
        </div>
      )}

      <InvitePlayerModal
        isOpen={isPlayerModalOpen}
        onClose={() => setPlayerModalOpen(false)}
        existingIds={new Set()}
        title="Dodaj zawodnika"
        placeholder="Szukaj zawodnika…"
        onSelectUser={handleAddPlayer}
      />
      <InvitePlayerModal
        isOpen={isRoleModalOpen}
        onClose={() => setRoleModalOpen(false)}
        existingIds={new Set(roles.filter((r) => r.role === 'organizer').map((r) => r.user.id))}
        title="Dodaj organizatora"
        placeholder="Szukaj organizatora…"
        onSelectUser={handleAddOrganizer}
      />

      <AssignRefereeModal
        isOpen={isRefereeModalOpen}
        onClose={() => setRefereeModalOpen(false)}
        tournamentId={tournament.id}
        onChanged={refreshRoles}
      />

      <GuardianPickerModal
        isOpen={isGuardianModalOpen}
        onClose={() => setGuardianModalOpen(false)}
        tournamentId={tournament.id}
        playerId={guardianPlayerId}
        existingIds={new Set([
          guardianPlayerId,
          ...guardians.map(g => g.guardianUserId).filter(Boolean)
        ])}
        onChanged={() => refreshGuardians()}
      />


      <GroupStandings tournamentId={tournament.id} isOrganizer={isCreator || isTournyOrg} />

      <div className="details-actions sticky">
        <button className="btn-secondary" onClick={handleShare}>
          <Share2 size={16} /> Udostępnij
        </button>
        <button className="btn-secondary" onClick={handleExport}>
          <Download size={16} /> Eksport JSON
        </button>
      </div>

      <TournamentMatches roles={roles} />
    </section>
  );
}