// client/src/components/TournamentList.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { getAllTournaments } from '../services/tournamentService';
import { useAuth } from '../contexts/AuthContext';
import TournamentFilters from './TournamentFilters';
import TournamentCard from './TournamentCard';
import '../styles/tournamentList.css';
import Breadcrumbs from './Breadcrumbs';
import {
  extractFilterOptions,
  passesFilters,
} from '../utils/tournamentMeta';

function normalizeStr(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export default function TournamentList({
  title = 'Turnieje',
  showCreateButton = true,
  initialTournaments = null
}) {
  const { user } = useAuth();
  const isOrganizer = user?.roles?.includes('organizer');

  // 1) dane
  const [allTournaments, setAllTournaments] = useState(initialTournaments ?? []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 2) UI/filtry/sort
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('dateDesc');
  const [filters, setFilters] = useState({
    category: [],
    gender: [],
    city: '',
    dateFrom: '',
    dateTo: '',
    status: [],
    formula: [],
  });

  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // 3) paginacja
  const ITEMS_PER_PAGE = 8;
  const [page, setPage] = useState(1);

  // 4) fetch
  useEffect(() => {
    if (initialTournaments !== null) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getAllTournaments()
      .then(data => { setAllTournaments(data); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [initialTournaments]);

  // 5) opcje do filtrów wyciągnięte z danych
  const { categories, genders, formula } = useMemo(
    () => extractFilterOptions(allTournaments),
    [allTournaments]
  );

  // 6) filtrowanie + wyszukiwarka + sort
  const filtered = useMemo(() => {
    let arr = [...allTournaments];

    // wyszukaj po nazwie
    if (searchQuery.trim()) {
      const qNorm = normalizeStr(searchQuery.trim());
      arr = arr.filter(t => normalizeStr(t.name).includes(qNorm));
    }

    // filtry domenowe (płeć/kategoria/miasto/status/dat)
    arr = arr.filter((t) => passesFilters(t, filters));

    // sort
    arr.sort((a, b) => {
      switch (sortOption) {
        case 'dateAsc':  return new Date(a.start_date) - new Date(b.start_date);
        case 'dateDesc': return new Date(b.start_date) - new Date(a.start_date);
        case 'nameAsc':  return a.name.localeCompare(b.name);
        case 'nameDesc': return b.name.localeCompare(a.name);
        default: return 0;
      }
    });

    return arr;
  }, [allTournaments, searchQuery, sortOption, filters]);

  // 7) paginacja
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const startIdx = (page - 1) * ITEMS_PER_PAGE;
  const visibleItems = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  useEffect(() => { setPage(1); }, [filtered.length]);

  // 8) UI loading/error
  if (loading) return <p aria-live="polite">Ładowanie turniejów…</p>;
  if (error) return <p className="error">Błąd: {error}</p>;

  const breadcrumbItems = [{ label: 'Home', href: '/' }, { label: 'Turnieje' }];

  const handleResetFilters = () => {
    setSearchQuery('');
    setSortOption('dateDesc');
    setFilters({
      category: [],
      gender: [],
      city: '',
      dateFrom: '',
      dateTo: '',
      status: [],
      formula: [],
    });
    setShowMobileFilters(false);
  };

  return (
    <div className="tournaments-page container">
      <Breadcrumbs items={breadcrumbItems} />

      {/* controls */}
      <div className="controls-bar">
        <h1>{title}</h1>

        <input
          type="text"
          placeholder="🔍 Szukaj po nazwie…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          aria-label="Szukaj turnieju po nazwie"
        />

        <select
          value={sortOption}
          onChange={e => setSortOption(e.target.value)}
          aria-label="Sortuj turnieje"
        >
          <option value="dateDesc">Data (od najnowszych)</option>
          <option value="dateAsc">Data (od najstarszych)</option>
          <option value="nameAsc">Nazwa (A → Z)</option>
          <option value="nameDesc">Nazwa (Z → A)</option>
        </select>

        <button
          className="btn-filter-toggle"
          onClick={() => setShowMobileFilters(true)}
          aria-label="Otwórz filtry"
        >
          <i className="fas fa-filter"></i> Filtruj
        </button>

        <button
          type="button"
          className="btn-clear"
          onClick={handleResetFilters}
          aria-label="Resetuj wszystkie filtry"
        >
          Resetuj filtry
        </button>

        {showCreateButton && isOrganizer && (
          <button
            className="btn-secondary"
            onClick={() => window.location.assign('/tournaments/new')}
            style={{ marginLeft: 'auto' }}
          >
            Utwórz turniej
          </button>
        )}
      </div>

      {/* filters + grid */}
      <div className="content-with-filters">
        <aside className="filters filters-panel">
          <TournamentFilters
            filters={filters}
            setFilters={setFilters}
            categories={categories}
            genders={genders}
            isMobileOffCanvas={false}
            formula={formula}
          />
        </aside>

        <div className="tournament-grid">
          {filtered.length === 0 ? (
            <div className="tlwc-no-results">
              <p>Brak turniejów spełniających kryteria.</p>
            </div>
          ) : (
            visibleItems.map(t => (
              <TournamentCard key={t.id} tournament={t} isOrganizer={t.isOrganizer} />
            ))
          )}
        </div>
      </div>

      {/* paginacja */}
      {filtered.length > 0 && totalPages > 1 && (
        <div className="pagination" aria-label="Paginacja turniejów">
          <button onClick={() => setPage(1)} disabled={page === 1} aria-label="Pierwsza strona">⏮</button>
          <button onClick={() => setPage(p => Math.max(p - 1, 1))} disabled={page === 1} aria-label="Poprzednia strona">‹</button>
          <span>Strona {page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(p + 1, totalPages))} disabled={page === totalPages} aria-label="Następna strona">›</button>
          <button onClick={() => setPage(totalPages)} disabled={page === totalPages} aria-label="Ostatnia strona">⏭</button>
        </div>
      )}

      {/* modal filtrów (mobile) */}
      {showMobileFilters && (
        <div className="filters-modal-backdrop" onClick={() => setShowMobileFilters(false)}>
          <div className="filters-modal-content mobile-off-canvas-panel" onClick={e => e.stopPropagation()}>
            <button className="filters-modal-close-btn" onClick={() => setShowMobileFilters(false)}>&times;</button>
            <h2>Filtry</h2>
            <div className="filters-panel">
              <TournamentFilters
                filters={filters}
                setFilters={setFilters}
                categories={categories}
                genders={genders}
                isMobileOffCanvas={true}
                formula={formula}
              />
            </div>
            <div className="modal-actions">
              <button className="btn-primary" onClick={() => setShowMobileFilters(false)}>Zastosuj filtry</button>
              <button className="btn-secondary" onClick={handleResetFilters}>Wyczyść</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
