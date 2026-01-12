// client/src/components/AutoScheduleModal.jsx
import React, { useEffect, useState } from 'react';
import * as scheduleApi from '../services/scheduleService';
import '../styles/scheduleModals.css';

export default function AutoScheduleModal({ open, onClose, tournamentId }) {
  const [startDay, setStartDay] = useState('');
  const [dayStart, setDayStart] = useState('09:00');
  const [dayEnd, setDayEnd] = useState('20:00');
  const [courts, setCourts] = useState(2);
  const [referees, setReferees] = useState(2);
  const [durationMin, setDurationMin] = useState(45);
  const [includeGroups, setIncludeGroups] = useState(true);
  const [includeKO, setIncludeKO] = useState(true);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [placeBronzeBeforeFinal, setPlaceBronzeBeforeFinal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [out, setOut] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open) {
      setOut(null); setErr('');
    }
  }, [open]);

  const run = async () => {
    setLoading(true);
    setErr('');
    try {
      const res = await scheduleApi.autoScheduleTournament(tournamentId, {
        startDay, dayStart, dayEnd,
        courts: Number(courts) || 1,
        referees: Number(referees) || 1,
        durationMin: Number(durationMin) || 45,
        includeGroups,
        includeKO,
        overwriteExisting,
        placeBronzeBeforeFinal,
      });
      setOut(res);
    } catch (e) {
      setErr(e.message || 'Błąd auto-planu');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={() => onClose(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Auto-plan turnieju</h3>

        <div className="modal-section">
          <div className="field">
            <label>Dzień startowy</label>
            <input type="date" value={startDay} onChange={(e) => setStartDay(e.target.value)} />
          </div>
          <div className="field">
            <label>Od</label>
            <input type="time" value={dayStart} step={60} onChange={(e) => setDayStart(e.target.value)} />
          </div>
          <div className="field">
            <label>Do</label>
            <input type="time" value={dayEnd} step={60} onChange={(e) => setDayEnd(e.target.value)} />
          </div>
        </div>

        <div className="modal-section">
          <div className="field">
            <label>Korty</label>
            <input type="number" min={1} value={courts} onChange={(e) => setCourts(e.target.value)} />
          </div>
          <div className="field">
            <label>Sędziowie</label>
            <input type="number" min={1} value={referees} onChange={(e) => setReferees(e.target.value)} />
          </div>
          <div className="field">
            <label>Czas meczu (min)</label>
            <input type="number" min={15} step={5} value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
          </div>
        </div>

        <div className="modal-section">
          <label className="checkbox-line">
            <input type="checkbox" checked={includeGroups} onChange={(e) => setIncludeGroups(e.target.checked)} />
            <span>Planuj fazę grupową</span>
          </label>
          <label className="checkbox-line">
            <input type="checkbox" checked={includeKO} onChange={(e) => setIncludeKO(e.target.checked)} />
            <span>Planuj fazę KO</span>
          </label>
          <label className="checkbox-line">
            <input type="checkbox" checked={overwriteExisting} onChange={(e) => setOverwriteExisting(e.target.checked)} />
            <span>Nadpisz istniejące terminy</span>
          </label>
          <label className="checkbox-line">
            <input type="checkbox" checked={placeBronzeBeforeFinal} onChange={(e) => setPlaceBronzeBeforeFinal(e.target.checked)} />
            <span>Mecz o 3. miejsce przed finałem</span>
          </label>
        </div>

        {err && <div className="error">{err}</div>}
        {out && (
          <div className="panel">
            <div><b>Zaplanowano:</b> {out.scheduled}</div>
            <div>Dni użyte: {out.daysUsed}</div>
            <div>Slot: {out.slotMinutes} min</div>
            <div>Korty: {out.courts}</div>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn-secondary" onClick={() => onClose(Boolean(out))}>Zamknij</button>
          <button className="btn-primary" onClick={run} disabled={!startDay || loading}>
            {loading ? 'Planowanie…' : 'Uruchom auto-plan'}
          </button>
        </div>
      </div>
    </div>
  );
}
