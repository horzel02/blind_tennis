// client/src/components/NotificationBell.jsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { listNotifications, markRead, markAllRead } from '../services/notificationService';
import * as registrationService from '../services/registrationService';
import * as roleService from '../services/tournamentUserRoleService';
import { guardianApi } from '../services/guardianService';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import { Link, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { socketOrigin } from '../services/api';
import '../styles/notifications.css';

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const ref = useRef(null);
  const socketRef = useRef(null);

  const removeFromList = useCallback((id) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const upsert = useCallback((n) => {
    if (!n?.id) return;
    setItems((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev]));
  }, []);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const rows = await listNotifications();
      setItems((rows || []).filter((r) => !r.readAt));
    } catch (e) {
      console.error('notif refresh failed', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // zamykanie dropdowna po kliknięciu poza
  useEffect(() => {
    const onClick = (e) => {
      if (open && ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [open]);

  // initial refresh po zalogowaniu / zmianie usera
  useEffect(() => {
    if (!user?.id) {
      setItems([]);
      setOpen(false);
      return;
    }
    refresh();
  }, [user?.id, refresh]);

  // socket: realtime noty
  useEffect(() => {
    if (!user?.id) return;

    // ważne: ubij ewentualny poprzedni socket (np. szybkie relogi)
    try {
      socketRef.current?.disconnect();
    } catch {}

    let s;
    try {
      s = io(socketOrigin(), {
        withCredentials: true,
        transports: ['websocket', 'polling'], // stabilniej w dev
      });
    } catch (e) {
      console.error('notif socket init failed', e);
      return;
    }

    socketRef.current = s;

    const uid = user.id;

    const onConnect = () => {
      s.emit('notif:join', uid);
    };

    const onNew = (n) => upsert(n);
    const onRead = ({ id }) => removeFromList(id);
    const onReadAll = () => setItems([]);

    s.on('connect', onConnect);
    s.on('notif:new', onNew);
    s.on('notif:read', onRead);
    s.on('notif:read-all', onReadAll);

    // jak socket nie wstanie -> NIE ZABIJAJ APPKI
    s.on('connect_error', (err) => {
      console.warn('notif socket connect_error', err?.message || err);
      // nie toastuj tego, bo user dostanie pierdolca; debug w konsoli wystarczy
    });

    return () => {
      try {
        s.emit('notif:leave', uid);
      } catch {}
      s.off('connect', onConnect);
      s.off('notif:new', onNew);
      s.off('notif:read', onRead);
      s.off('notif:read-all', onReadAll);
      try {
        s.disconnect();
      } catch {}
      socketRef.current = null;
    };
  }, [user?.id, upsert, removeFromList]);

  const unread = items.length;

  const openLink = (n) => {
    if (n?.link) navigate(n.link);
  };

  const markOne = async (n) => {
    try {
      await markRead(n.id);
      removeFromList(n.id);
    } catch (e) {
      toast.error(e?.message || 'Nie udało się oznaczyć');
    }
  };

  const markAll = async () => {
    try {
      await markAllRead();
      setItems([]);
    } catch (e) {
      toast.error('Nie udało się oznaczyć wszystkich');
    }
  };

  // === akcje: player invite
  const acceptPlayerInvite = async (n) => {
    try {
      const tid = n?.meta?.tournamentId;
      if (!tid) return openLink(n);

      const reg = await registrationService.getMyRegistration(tid);
      if (!reg) return openLink(n);

      await registrationService.updateRegistrationStatus(reg.id, { status: 'accepted' });
      await markRead(n.id);
      removeFromList(n.id);
      toast.success('Dołączono do turnieju');
    } catch (e) {
      toast.error(e?.message || 'Nie udało się zaakceptować');
    }
  };

  const declinePlayerInvite = async (n) => {
    try {
      const tid = n?.meta?.tournamentId;
      if (!tid) return openLink(n);

      const reg = await registrationService.getMyRegistration(tid);
      if (!reg) return openLink(n);

      await registrationService.deleteRegistration(reg.id);
      await markRead(n.id);
      removeFromList(n.id);
      toast.info('Odrzucono zaproszenie');
    } catch (e) {
      toast.error(e?.message || 'Nie udało się odrzucić');
    }
  };

  // === akcje: guardian invite
  const acceptGuardianInvite = async (n) => {
    try {
      const gid = n?.meta?.guardianId;

      if (gid) {
        await guardianApi.accept(gid);
      } else {
        const all = await guardianApi.list({});
        const row = (all || []).find(
          (r) =>
            r.status === 'invited' &&
            r.guardianUserId === user.id &&
            r.tournamentId === n?.meta?.tournamentId &&
            r.playerId === n?.meta?.playerId
        );
        if (row) await guardianApi.accept(row.id);
      }

      await markRead(n.id);
      removeFromList(n.id);
      toast.success('Przyjęto rolę opiekuna');
    } catch (e) {
      toast.error(e?.message || 'Nie udało się zaakceptować');
    }
  };

  const declineGuardianInvite = async (n) => {
    try {
      const gid = n?.meta?.guardianId;

      if (gid) {
        await guardianApi.decline(gid);
      } else {
        const all = await guardianApi.list({});
        const row = (all || []).find(
          (r) =>
            r.status === 'invited' &&
            r.guardianUserId === user.id &&
            r.tournamentId === n?.meta?.tournamentId &&
            r.playerId === n?.meta?.playerId
        );
        if (row) await guardianApi.decline(row.id);
      }

      await markRead(n.id);
      removeFromList(n.id);
      toast.info('Odrzucono zaproszenie opiekuna');
    } catch (e) {
      toast.error(e?.message || 'Nie udało się odrzucić');
    }
  };

  // === akcje: referee invite
  const acceptRefereeInvite = async (n) => {
    try {
      const tid = n?.meta?.tournamentId;
      if (!tid) return openLink(n);

      await roleService.acceptRefereeInvite(tid);
      await markRead(n.id);
      removeFromList(n.id);
      toast.success('Dołączyłeś jako sędzia');
    } catch (e) {
      toast.error(e?.message || 'Nie udało się zaakceptować');
    }
  };

  const declineRefereeInvite = async (n) => {
    try {
      const tid = n?.meta?.tournamentId;
      if (!tid) return openLink(n);

      await roleService.declineRefereeInvite(tid);
      await markRead(n.id);
      removeFromList(n.id);
      toast.info('Odrzucono zaproszenie');
    } catch (e) {
      toast.error(e?.message || 'Nie udało się odrzucić');
    }
  };

  const InfoRow = ({ n, children }) => (
    <div key={n.id} className={`notif-item ${n.readAt ? 'read' : 'unread'}`}>
      <div className="notif-title">{n.title}</div>
      <div className="notif-body">{n.body}</div>
      <div className="notif-actions">
        {children}
        <button className="btn-secondary" onClick={() => markOne(n)}>
          Oznacz jako przeczytane
        </button>
        {n.link && (
          <button className="btn-link" onClick={() => openLink(n)}>
            Szczegóły
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="notif-bell" ref={ref}>
      <button
        className="icon-button"
        onClick={async () => {
          const willOpen = !open;
          setOpen(willOpen);
          if (willOpen) await refresh();
        }}
        aria-label="Powiadomienia"
      >
        <Bell size={24} />
        {unread > 0 && <span className="badge">{unread}</span>}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-head">Powiadomienia</div>

          {loading ? (
            <div className="muted">Ładowanie…</div>
          ) : items.length === 0 ? (
            <div className="muted">Brak nowych</div>
          ) : (
            items.map((n) => {
              if (n.type === 'player_invite') {
                return (
                  <InfoRow key={n.id} n={n}>
                    <button className="btn-primary" onClick={() => acceptPlayerInvite(n)}>
                      Akceptuj
                    </button>
                    <button className="btn-secondary" onClick={() => declinePlayerInvite(n)}>
                      Odrzuć
                    </button>
                  </InfoRow>
                );
              }

              if (n.type === 'guardian_invite') {
                return (
                  <InfoRow key={n.id} n={n}>
                    <button className="btn-primary" onClick={() => acceptGuardianInvite(n)}>
                      Akceptuj
                    </button>
                    <button className="btn-secondary" onClick={() => declineGuardianInvite(n)}>
                      Odrzuć
                    </button>
                  </InfoRow>
                );
              }

              if (n.type === 'referee_invite') {
                return (
                  <InfoRow key={n.id} n={n}>
                    <button className="btn-primary" onClick={() => acceptRefereeInvite(n)}>
                      Akceptuj
                    </button>
                    <button className="btn-secondary" onClick={() => declineRefereeInvite(n)}>
                      Odrzuć
                    </button>
                  </InfoRow>
                );
              }

              return <InfoRow key={n.id} n={n} />;
            })
          )}

          <div className="notif-foot">
            <button className="btn-link" onClick={markAll}>
              Oznacz wszystkie
            </button>
            <Link to="/notifications">Wszystkie</Link>
          </div>
        </div>
      )}
    </div>
  );
}
