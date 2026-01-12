// client/src/components/AssignRefereeModal.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import InvitePlayerModal from './InvitePlayerModal';
import * as roleService from '../services/tournamentUserRoleService';

export default function AssignRefereeModal({ isOpen, onClose, tournamentId, onChanged }) {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pickOpen, setPickOpen] = useState(false);

  const refereeRoles = useMemo(() => roles.filter(r => r.role === 'referee'), [roles]);
  const refereeIds = useMemo(() => new Set(refereeRoles.map(r => r.user.id)), [refereeRoles]);

  async function load() {
    try {
      setLoading(true);
      const r = await roleService.listRoles(tournamentId);
      setRoles(r || []);
    } catch (e) {
      toast.error(e.message || 'Błąd ładowania sędziów');
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isOpen) return;
    load();
  }, [isOpen, tournamentId]);

  // Zaproszenie
  const handleInviteReferee = async (u) => {
    try {
      await roleService.inviteReferee(tournamentId, u.id);
      toast.success(`Wysłano zaproszenie: ${u.name} ${u.surname}`);
      setPickOpen(false);
      onChanged?.(); // ewentualnie odśwież coś u rodzica
    } catch (e) {
      toast.error(e.message || 'Nie udało się wysłać zaproszenia');
    }
  };

  // Usunięcie aktywnego sędziego
  const handleRemoveReferee = async (userId) => {
    if (!window.confirm('Usunąć tego sędziego z turnieju?')) return;
    try {
      await roleService.removeRole(tournamentId, userId, 'referee');
      toast.success('Usunięto sędziego');
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(e.message || 'Nie udało się usunąć roli sędziego');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h2>Sędziowie</h2>

        {loading ? (
          <p>Ładowanie…</p>
        ) : (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 12 }}>
              <strong>Aktywni sędziowie</strong>
              <button className="btn btn-primary" onClick={() => setPickOpen(true)}>
                Zaproś sędziego
              </button>
            </div>

            {refereeRoles.length === 0 ? (
              <p className="muted" style={{ marginTop: 8 }}>Brak sędziów w tym turnieju.</p>
            ) : (
              <ul style={{ listStyle:'none', padding:0, margin:0 }}>
                {refereeRoles.map(r => (
                  <li
                    key={r.id}
                    style={{
                      display:'flex',
                      justifyContent:'space-between',
                      alignItems:'center',
                      padding:'8px 0',
                      borderBottom:'1px solid #eee'
                    }}
                  >
                    <span>
                      {r.user.name} {r.user.surname}{r.user.email ? ` (${r.user.email})` : ''}
                    </span>
                    <button className="btn btn-delete" onClick={() => handleRemoveReferee(r.user.id)}>
                      Usuń
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={onClose}>Zamknij</button>
            </div>
          </>
        )}

        <InvitePlayerModal
          isOpen={pickOpen}
          onClose={() => setPickOpen(false)}
          existingIds={refereeIds}
          title="Zaproś sędziego do turnieju"
          placeholder="Szukaj po nazwisku lub e-mailu…"
          onSelectUser={handleInviteReferee}
        />
      </div>
    </div>
  );
}
