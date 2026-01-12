import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import * as tournamentService from '../services/tournamentService';
import TournamentForm from '../components/TournamentForm';

const toISO = (d) => (d ? new Date(d).toISOString() : null);
const numOrNull = (v) => (v === '' || v == null ? null : Number(v));
const bool = (v) => !!v;
const isEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export default function TournamentFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [initialData, setInitialData] = useState(null);
  const [initialSnapshot, setInitialSnapshot] = useState(null);

  const [loading, setLoading] = useState(isEdit);
  const [inlineError, setInlineError] = useState('');
  const [inlineOk, setInlineOk] = useState('');

  // blokady pól na podstawie istniejących meczów
  const [fieldLocks, setFieldLocks] = useState({
    hasGroups: false,
    hasKO: false,
  });

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!isEdit) {
        setLoading(false);
        return;
      }

      try {
        const t = await tournamentService.getTournamentById(id);

        if (t.organizer_id !== user.id) {
          alert('Nie masz uprawnień do edycji tego turnieju');
          navigate(-1);
          return;
        }

        const firstCategory = t.categories && t.categories.length > 0 ? t.categories[0] : {};
        const init = {
          name: t.name,
          description: t.description || '',
          street: t.street,
          postalCode: t.postalCode,
          city: t.city,
          country: t.country,
          start_date: t.start_date?.split('T')[0] || '',
          end_date: t.end_date?.split('T')[0] || '',
          registration_deadline: t.registration_deadline ? t.registration_deadline.split('T')[0] : '',
          applicationsOpen: t.applicationsOpen,
          formula: t.formula ?? 'towarzyski',
          type: t.type || 'open',
          category: firstCategory.categoryName || '',
          gender: firstCategory.gender || '',
          participant_limit: t.participant_limit?.toString() || '',
          format: t.format || (t.isGroupPhase ? 'GROUPS_KO' : 'KO_ONLY'),
          groupSize: t.groupSize ?? 4,
          qualifiersPerGroup: t.qualifiersPerGroup ?? 2,
          allowByes: t.allowByes ?? true,
          koSeedingPolicy: t.koSeedingPolicy || 'RANDOM_CROSS',
          avoidSameGroupInR1: t.avoidSameGroupInR1 ?? true,
          isGroupPhase: t.isGroupPhase,
          setsToWin: t.setsToWin,
          gamesPerSet: t.gamesPerSet,
          tieBreakType: t.tieBreakType,
        };

        if (!alive) return;
        setInitialData(init);

        setInitialSnapshot({
          name: init.name,
          description: init.description,
          start_date: toISO(init.start_date),
          end_date: toISO(init.end_date),
          registration_deadline: toISO(init.registration_deadline),
          street: init.street,
          postalCode: init.postalCode,
          city: init.city,
          country: init.country,
          participant_limit: numOrNull(init.participant_limit),
          applicationsOpen: bool(init.applicationsOpen),
          formula: init.formula,
          type: init.type,
          format: init.format,
          groupSize: init.format === 'GROUPS_KO' ? numOrNull(init.groupSize) : null,
          qualifiersPerGroup: init.format === 'GROUPS_KO' ? numOrNull(init.qualifiersPerGroup) : null,
          allowByes: bool(init.allowByes),
          koSeedingPolicy: init.koSeedingPolicy,
          avoidSameGroupInR1: bool(init.avoidSameGroupInR1),
          isGroupPhase: init.format === 'GROUPS_KO',
          setsToWin: init.setsToWin,
          gamesPerSet: init.gamesPerSet,
          tieBreakType: init.tieBreakType,
          categories: init.category && init.gender ? [{ category: init.category, gender: init.gender }] : [],
        });

        // 1) Preferowana ścieżka – licznik meczów
        try {
          const s = await tournamentService.getTournamentSettings(id);
          if (!alive) return;
          const hasKO = (s?.koMatchesCount ?? 0) > 0;
          const hasGroups = (s?.groupMatchesCount ?? 0) > 0;
          setFieldLocks({ hasKO, hasGroups });
        } catch {
          // 2) Fallback: jeśli turniej ma KO w ogóle (np. wygenerowane wcześniej), zablokuj BYE na wszelki
          if (init.format) {
            setFieldLocks((prev) => ({ ...prev }));
          }
        }
      } catch (err) {
        alert('Błąd ładowania turnieju: ' + (err?.message || 'Nieznany błąd'));
        navigate(-1);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [id, isEdit, user.id, navigate]);

  const buildFullPayload = (fv) => ({
    name: fv.name,
    description: fv.description,
    start_date: toISO(fv.start_date),
    end_date: toISO(fv.end_date),
    registration_deadline: toISO(fv.registration_deadline),
    street: fv.street,
    postalCode: fv.postalCode,
    city: fv.city,
    country: fv.country,
    participant_limit: numOrNull(fv.participant_limit),
    applicationsOpen: bool(fv.applicationsOpen),
    formula: fv.formula,
    type: fv.type,
    format: fv.format,
    groupSize: fv.format === 'GROUPS_KO' ? numOrNull(fv.groupSize) : null,
    qualifiersPerGroup: fv.format === 'GROUPS_KO' ? numOrNull(fv.qualifiersPerGroup) : null,
    allowByes: bool(fv.allowByes),
    koSeedingPolicy: fv.koSeedingPolicy,
    avoidSameGroupInR1: bool(fv.avoidSameGroupInR1),
    isGroupPhase: fv.format === 'GROUPS_KO',
    setsToWin: fv.setsToWin,
    gamesPerSet: fv.gamesPerSet,
    tieBreakType: fv.tieBreakType,
    categories: fv.category && fv.gender ? [{ category: fv.category, gender: fv.gender }] : [],
  });

  const buildDiff = (full, snap, locks) => {
    if (!snap) return full;
    const diff = {};
    const structural = ['format', 'participant_limit', 'groupSize', 'qualifiersPerGroup', 'isGroupPhase'];
    const keys = [
      'name', 'description', 'start_date', 'end_date', 'registration_deadline',
      'street', 'postalCode', 'city', 'country',
      'participant_limit', 'applicationsOpen', 'formula', 'type',
      'format', 'groupSize', 'qualifiersPerGroup', 'allowByes', 'koSeedingPolicy', 'avoidSameGroupInR1',
      'isGroupPhase',
      'setsToWin', 'gamesPerSet', 'tieBreakType',
      'categories'
    ];
    for (const k of keys) {
      if ((locks?.hasGroups || locks?.hasKO) && structural.includes(k)) continue;
      if (locks?.hasKO && k === 'allowByes') continue;
      if (!isEqual(full[k], snap[k])) diff[k] = full[k];
    }
    return diff;
  };

  const handleSubmit = async (formValues) => {
    setInlineError('');
    setInlineOk('');
    setLoading(true);

    try {
      if (isEdit) {
        const full = buildFullPayload(formValues);
        const payload = buildDiff(full, initialSnapshot, fieldLocks);

        // dodatkowy bezpiecznik: jeśli próbujesz zmienić strukturę mimo braku flag — stop
        const triedStructure =
          ('format' in payload) ||
          ('participant_limit' in payload) ||
          ('groupSize' in payload) ||
          ('qualifiersPerGroup' in payload) ||
          ('isGroupPhase' in payload) ||
          ('allowByes' in payload && fieldLocks.hasKO);

        if (triedStructure && (fieldLocks.hasKO || fieldLocks.hasGroups)) {
          setInlineError('Nie można zmieniać kluczowych parametrów (format, limit, awanse, BYE) po wygenerowaniu meczów. Najpierw zresetuj mecze.');
          setLoading(false);
          return;
        }

        if (Object.keys(payload).length === 0) {
          setInlineOk('Brak zmian do zapisania.');
          setLoading(false);
          return;
        }

        await tournamentService.updateTournament(id, payload);
        setInlineOk('Zapisano zmiany.');
        setInitialSnapshot((prev) => ({ ...prev, ...payload }));

        // odśwież blokady
        try {
          const s = await tournamentService.getTournamentSettings(id);
          const hasKO = (s?.koMatchesCount ?? 0) > 0;
          const hasGroups = (s?.groupMatchesCount ?? 0) > 0;
          setFieldLocks({ hasKO, hasGroups });
        } catch { }
      } else {
        const created = await tournamentService.createTournament({
          ...buildFullPayload(formValues),
          organizer_id: user.id,
        });
        navigate(`/tournaments/${created.id}/details`);
      }
    } catch (err) {
      const msg = err?.message || 'Nie udało się zapisać zmian.';
      setInlineError(msg);

      // Fallback: jeśli BE pluje o BYE/KO, ustaw twardą blokadę na froncie na przyszłość
      const m = String(msg).toLowerCase();
      if (m.includes('bye') || m.includes('ko') || m.includes('drabink')) {
        setFieldLocks((prev) => ({ ...prev, hasKO: true }));
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <p>Ładowanie danych…</p>;

  return (
    <section className="container">
      {inlineError && (
        <div className="alert alert-danger" role="alert" style={{ marginBottom: 12 }}>
          {inlineError}
        </div>
      )}
      {inlineOk && (
        <div className="alert alert-success" role="alert" style={{ marginBottom: 12 }}>
          {inlineOk}
        </div>
      )}

      <TournamentForm
        key={id || 'new'}
        initialData={initialData}
        onSubmit={handleSubmit}
        title={isEdit ? 'Edytuj turniej' : 'Nowy turniej'}
        submitText={isEdit ? 'Zapisz zmiany' : 'Utwórz turniej'}
        fieldLocks={fieldLocks}
      />
    </section>
  );
}
