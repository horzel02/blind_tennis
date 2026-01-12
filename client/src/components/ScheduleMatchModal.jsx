// src/components/ScheduleMatchModal.jsx
import React, { useMemo, useState } from 'react';
import * as scheduleApi from '../services/scheduleService';
import '../styles/scheduleModals.css';

export default function ScheduleMatchModal({ open, onClose, match }) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [durationMin, setDurationMin] = useState(45);
  const [courtNumber, setCourtNumber] = useState('');

  const disabled = !open || !match;

  const initial = useMemo(() => {
    if (!match?.matchTime) return null;
    const d = new Date(match.matchTime);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${mi}` };
  }, [match]);

  React.useEffect(() => {
    if (!open) return;
    if (initial) {
      setDate(initial.date);
      setTime(initial.time);
    } else {
      setDate('');
      setTime('09:00');
    }
    setDurationMin(match?.durationMin ?? 45);
    setCourtNumber(match?.courtNumber ?? '');
  }, [open, match, initial]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!date || !time) return;

    const iso = new Date(`${date}T${time}:00`);
    await scheduleApi.setMatchSchedule(match.id, {
      matchTime: iso.toISOString(),
      durationMin: Number(durationMin) || 45,
      courtNumber: courtNumber === '' ? null : String(courtNumber),
    });
    onClose(true);
  };

  const handleClear = async () => {
    await scheduleApi.clearMatchSchedule(match.id);
    onClose(true);
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={() => onClose(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Ustaw termin meczu</h3>
        <div className="modal-section">
          <div className="field">
            <label>Data</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="field">
            <label>Godzina</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={disabled}
              step={60}
            />
          </div>
        </div>

        <div className="modal-section">
          <div className="field">
            <label>Czas (min)</label>
            <input
              type="number"
              min={15}
              step={5}
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="field">
            <label>Kort</label>
            <input
              type="text"
              placeholder="np. 1 lub Centralny"
              value={courtNumber}
              onChange={(e) => setCourtNumber(e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={() => onClose(false)}>Anuluj</button>
          {match?.matchTime && (
            <button className="btn-danger" onClick={handleClear}>Wyczyść</button>
          )}
          <button className="btn-primary" onClick={handleSave} disabled={!date || !time}>
            Zapisz
          </button>
        </div>
      </div>
    </div>
  );
}
