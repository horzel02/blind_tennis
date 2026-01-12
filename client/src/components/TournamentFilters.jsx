// client/src/components/TournamentFilters.jsx
import React from 'react';
import '../styles/tournamentFilters.css';
import { genderLabelPL } from '../utils/tournamentMeta';

export default function TournamentFilters({
  filters,
  setFilters,
  categories,   // np. ['B1','B2','B3','B4']
  genders,      // KANONICZNE: ['M','W','Coed']
  isMobileOffCanvas
}) {
  const handleCheckboxChange = (e) => {
    const { name, value, checked } = e.target;
    const prevValues = filters[name] || [];
    if (checked) {
      setFilters(prev => ({
        ...prev,
        [name]: Array.from(new Set([...prevValues, value]))
      }));
    } else {
      setFilters(prev => ({
        ...prev,
        [name]: prevValues.filter(v => v !== value)
      }));
    }
  };

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  return (
    <aside className={`filters-panel ${isMobileOffCanvas ? 'mobile-mode-filters' : ''}`} aria-label="Filtry turniejów">
      {/* Kategoria */}
      <fieldset className="filter-group">
        <legend>Kategoria</legend>
        {categories.map(cat => (
          <label key={cat} className="filter-item">
            <input
              type="checkbox"
              name="category"
              value={cat}
              checked={filters.category.includes(cat)}
              onChange={handleCheckboxChange}
            />
            {cat}
          </label>
        ))}
      </fieldset>

      <fieldset className="filter-group">
        <legend>Formuła</legend>
        {['open', 'towarzyski', 'mistrzowski'].map(key => (
          <label key={key} className="filter-item">
            <input
              type="checkbox"
              name="formula"
              value={key}
              checked={filters.formula?.includes(key)}
              onChange={handleCheckboxChange}
            />
            {key === 'open' ? 'Open' : key === 'towarzyski' ? 'Towarzyski' : 'Mistrzowski'}
          </label>
        ))}
      </fieldset>

      {/* Płeć */}
      <fieldset className="filter-group">
        <legend>Płeć</legend>
        {genders.map(g => (
          <label key={g} className="filter-item">
            <input
              type="checkbox"
              name="gender"
              value={g}
              checked={filters.gender.includes(g)}
              onChange={handleCheckboxChange}
            />
            {genderLabelPL(g)}
          </label>
        ))}
      </fieldset>

      {/* Miasto */}
      <fieldset className="filter-group">
        <legend>Miasto</legend>
        <label className="filter-item">
          <input
            type="text"
            name="city"
            placeholder="np. Kraków"
            value={filters.city}
            onChange={handleFieldChange}
            aria-label="Filtruj po mieście"
          />
        </label>
      </fieldset>

      {/* Data od/do */}
      <fieldset className="filter-group">
        <legend>Data od/do</legend>
        <div className="date-range">
          <div className="filter-item">
            <label htmlFor="dateFrom">
              <span className="date-label">Od:</span>
              <input
                type="date"
                id="dateFrom"
                name="dateFrom"
                value={filters.dateFrom}
                onChange={handleFieldChange}
              />
            </label>
          </div>
          <div className="filter-item">
            <label htmlFor="dateTo">
              <span className="date-label">Do:</span>
              <input
                type="date"
                id="dateTo"
                name="dateTo"
                value={filters.dateTo}
                onChange={handleFieldChange}
              />
            </label>
          </div>
        </div>
      </fieldset>

      {/* Status zgłoszeń */}
      <fieldset className="filter-group">
        <legend>Status zgłoszeń</legend>
        <label className="filter-item">
          <input
            type="checkbox"
            name="status"
            value="open"
            checked={filters.status.includes('open')}
            onChange={handleCheckboxChange}
          />
          Otwarte
        </label>
        <label className="filter-item">
          <input
            type="checkbox"
            name="status"
            value="closed"
            checked={filters.status.includes('closed')}
            onChange={handleCheckboxChange}
          />
          Zamknięte
        </label>
      </fieldset>
    </aside>
  );
}
