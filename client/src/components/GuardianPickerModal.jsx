// client/src/components/GuardianPickerModal.jsx
import React, { useState } from 'react';
import { toast } from 'react-toastify';
import InvitePlayerModal from './InvitePlayerModal';
import { guardianApi } from '../services/guardianService';


export default function GuardianPickerModal({
  isOpen,
  onClose,
  tournamentId,
  playerId,
  onChanged,
  existingIds = new Set(),
}) {
  const [busy, setBusy] = useState(false);

  const handleSelectUser = async (user) => {
    if (!user?.id) return;
    setBusy(true);
    try {
      await guardianApi.invite({
        tournamentId,
        playerId,
        guardianUserId: user.id,
      });
      toast.success('Zaproszono opiekuna');
      onChanged?.();
      onClose?.();
    } catch (e) {
      toast.error(e?.message || 'Nie udało się zaprosić opiekuna');
    } finally {
      setBusy(false);
    }
  };

  return (
    <InvitePlayerModal
      isOpen={isOpen}
      onClose={busy ? () => {} : onClose}
      onSelectUser={handleSelectUser}
      existingIds={existingIds}
      title="Wybierz opiekuna"
      placeholder="Szukaj użytkownika (imię, nazwisko, e-mail)…"
    />
  );
}
