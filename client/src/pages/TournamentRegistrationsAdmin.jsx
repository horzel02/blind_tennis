// client/src/pages/TournamentRegistrationsAdmin.jsx

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import * as registrationService from '../services/registrationService';
import * as tournamentService from '../services/tournamentService';
import '../styles/tournamentRegistrationsAdmin.css';
import '../styles/globals.css';
import Breadcrumbs from '../components/Breadcrumbs';
import { ChevronDown, ChevronUp, CheckCircle, XCircle, Trash2 } from 'lucide-react';

export default function TournamentRegistrationsAdmin() {
  const { id } = useParams();
  const { user } = useAuth();

  // ─── STANY PODSTAWOWE
  const [regs, setRegs] = useState([]);
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ─── FILTRY GLOBALNE I DATE RANGE
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // ─── SORTOWANIE PO KOLUMNACH
  const [sortField, setSortField] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('desc');

  // ─── PAGINACJA
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 20;

  // ─── STANY DLA RESPONSYWNOŚCI
  const [expandedRows, setExpandedRows] = useState({});
  const [isMobile, setIsMobile] = useState(false);

  // Efekt do wykrywania szerokości ekranu
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);

    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // Funkcja do przełączania rozwinięcia karty/wiersza
  const toggleRowExpansion = (registrationId) => {
    setExpandedRows(prev => ({
      ...prev,
      [registrationId]: !prev[registrationId],
    }));
  };

  // FILTR + SORT + RANGE DATE
  const filteredAndSorted = useMemo(() => {
    let arr = [...regs];

    // 1) Filtr po statusie
    if (statusFilter !== 'all') {
      arr = arr.filter(r => r.status === statusFilter);
    }
    // 2) Filtr po globalnym wyszukiwaniu
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      arr = arr.filter(r => {
        const fullName = `${r.user.name} ${r.user.surname}`.toLowerCase();
        const email = r.user.email.toLowerCase();
        return fullName.includes(q) || email.includes(q);
      });
    }
    // 3) Filtr po zakresie dat (createdAt)
    if (dateFrom) {
      const fromTs = new Date(dateFrom).setHours(0, 0, 0, 0);
      arr = arr.filter(r => new Date(r.createdAt).getTime() >= fromTs);
    }
    if (dateTo) {
      const toTs = new Date(dateTo).setHours(23, 59, 59, 999);
      arr = arr.filter(r => new Date(r.createdAt).getTime() <= toTs);
    }

    // 4) Sortowanie po wybranym sortField
    arr.sort((a, b) => {
      let aValue, bValue;
      switch (sortField) {
        case 'name':
          aValue = `${a.user.name} ${a.user.surname}`.toLowerCase();
          bValue = `${b.user.name} ${b.user.surname}`.toLowerCase();
          break;
        case 'email':
          aValue = a.user.email.toLowerCase();
          bValue = b.user.email.toLowerCase();
          break;
        case 'status':
          aValue = a.status.toLowerCase();
          bValue = b.status.toLowerCase();
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case 'updatedAt':
          aValue = new Date(a.updatedAt).getTime();
          bValue = new Date(b.updatedAt).getTime();
          break;
        default:
          aValue = '';
          bValue = '';
      }
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return arr;
  },
    [regs, statusFilter, searchTerm, dateFrom, dateTo, sortField, sortDirection]
  );

  // obliczanie liczby stron
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredAndSorted.length / perPage));
  }, [filteredAndSorted]);

  // ─── BULK ACTIONS
  const [selectedIds, setSelectedIds] = useState([]);

  // POBIERANIE DANYCH (zgłoszenia + turniej)
  useEffect(() => {
    setLoading(true);
    setError(null);

    // 1) Pobierz zgłoszenia
    registrationService
      .getRegistrationsByTournament(id)
      .then(data => {
        setRegs(data);
        // 2) Pobierz dane turnieju
        return tournamentService.getTournamentById(id);
      })
      .then(t => setTournament(t))
      .catch(err => {
        console.error(err);
        setError(err.message || 'Błąd podczas pobierania danych');
      })
      .finally(() => setLoading(false));
  }, [id]);

  // ───ZMIANA STATUSU
  const handleStatusChange = (regId, newStatus) => {
    registrationService
      .updateRegistrationStatus(regId, { status: newStatus })
      .then(() => registrationService.getRegistrationsByTournament(id))
      .then(data => {
        setRegs(data);
        setSelectedIds(prev => prev.filter(x => x !== regId));
      })
      .catch(err => {
        console.error(err);
        setError(err.message || 'Błąd podczas zmiany statusu');
      });
  };

  const handleCancelInvite = async (regId) => {
    if (!window.confirm('Na pewno anulować to zaproszenie?')) return;
    try {
      await registrationService.deleteRegistration(regId);
      const data = await registrationService.getRegistrationsByTournament(id);
      setRegs(data);
      setSelectedIds(prev => prev.filter(x => x !== regId));
    } catch (err) {
      console.error(err);
      setError(err.message || 'Błąd przy anulowaniu zaproszenia');
    }
  };

  // ─── BULK CHANGES
  // 1) Zmiana checkbox: pojedynczy toggler
  const toggleSelect = (regId) => {
    setSelectedIds(prev => {
      if (prev.includes(regId)) {
        return prev.filter(x => x !== regId);
      } else {
        return [...prev, regId];
      }
    });
  };
  // 2) Zaznacz wszystkie / odznacz wszystkie
  const toggleSelectAllOnCurrentPage = () => {
    const currentIdsOnPage = paginatedData.map(r => r.id);
    const allSelected = currentIdsOnPage.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(x => !currentIdsOnPage.includes(x)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...currentIdsOnPage])));
    }
  };

  // 3) Masowa zmiana statusu
  const bulkChangeStatus = (newStatus) => {
    if (selectedIds.length === 0) return;
    Promise.all(
      selectedIds.map(regId =>
        registrationService.updateRegistrationStatus(regId, { status: newStatus })
      )
    )
      .then(() => registrationService.getRegistrationsByTournament(id))
      .then(data => {
        setRegs(data);
        setSelectedIds([]);
      })
      .catch(err => {
        console.error(err);
        setError(err.message || 'Błąd podczas masowej zmiany statusu');
      });
  };

  // 4) Eksport wybranych do CSV
  const bulkExportSelected = () => {
    if (selectedIds.length === 0) return;

    const selectedRows = regs.filter(r => selectedIds.includes(r.id));
    const headers = ['Zawodnik', 'Email', 'Status', 'Data zgłoszenia', 'Data modyfikacji'];
    const rows = selectedRows.map(r => [
      `${r.user.name} ${r.user.surname}`,
      r.user.email,
      r.status,
      new Date(r.createdAt).toLocaleString('pl-PL'),
      new Date(r.updatedAt).toLocaleString('pl-PL')
    ]);

    let csvContent = headers.join(',') + '\n';
    for (let row of rows) {
      const escapedRow = row.map(cell => {
        let str = String(cell);
        if (str.includes(',') || str.includes('"')) {
          str = `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
      csvContent += escapedRow.join(',') + '\n';
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `zgloszenia_wybrane_turniej_${id}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ───SUMMARY – liczby w czasie rzeczywistym
  const summaryCounts = useMemo(() => {
    const total = regs.length;
    const pending = regs.filter(r => r.status === 'pending').length;
    const accepted = regs.filter(r => r.status === 'accepted').length;
    const rejected = regs.filter(r => r.status === 'rejected').length;
    const invited = regs.filter(r => r.status === 'invited').length;
    return { total, pending, accepted, rejected, invited };
  }, [regs]);

  // ─── PODZIAŁ NA POSZCZEGÓLNE STRONY
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    const end = start + perPage;
    return filteredAndSorted.slice(start, end);
  }, [filteredAndSorted, currentPage, perPage]);

  // ───przełącz na konkretną stronę
  const goToPage = (pageNum) => {
    if (pageNum < 1 || pageNum > totalPages) return;
    setCurrentPage(pageNum);
    setSelectedIds([]);
  };

  // ─── zamiana sortField/sortDirection
  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const genderChip = (g) => {
    const s = String(g || '').toLowerCase();
    if (['male', 'm', 'mezczyzna', 'mężczyzna'].includes(s)) {
      return <span className="chip chip--male"><span className="dot" />Mężczyzna</span>;
    }
    if (['female', 'f', 'kobieta'].includes(s)) {
      return <span className="chip chip--female"><span className="dot" />Kobieta</span>;
    }
    return <span className="chip chip--sm chip--outline">—</span>;
  };

  const categoryChip = (cat) => {
    const c = (cat || '').toUpperCase();
    return c
      ? <span className="chip" data-cat={c}><span className="dot" />{c}</span>
      : <span className="chip chip--sm chip--outline">brak</span>;
  }

  // ─── OBSŁUGA ŁADOWANIA/BŁĘDÓW
  if (loading) return <p>Ładowanie zgłoszeń…</p>;
  if (error) return <p className="error">Błąd: {error}</p>;

  // Breadcrumbs
  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'Turnieje', href: '/tournaments' },
    { label: tournament?.name ?? 'Ładowanie nazwy turnieju...', href: `/tournaments/${id}/details` },
    { label: 'Zarządzanie zgłoszeniami' }
  ];

  // ─── RENDER
  return (
    <div style={{ padding: '0 1rem', marginBottom: '2rem' }}>

      <Breadcrumbs items={breadcrumbItems} />
      <h1 style={{ marginBottom: '1.5rem' }}>
        Zgłoszenia do turnieju «{tournament?.name ?? `#${id}`}»
      </h1>

      {/* ────── Podsumowanie  */}
      <div className="reg-summary" style={{
        display: 'flex',
        gap: '1.5rem',
        alignItems: 'center',
        marginBottom: '1rem'
      }}>
        <strong>Łącznie:</strong>
        <span>💼 {summaryCounts.total}</span>
        <span style={{ color: 'orange' }}>⏳ {summaryCounts.pending} oczekujących</span>
        <span style={{ color: 'green' }}>✅ {summaryCounts.accepted} zaakc.</span>
        <span style={{ color: 'red' }}>❌ {summaryCounts.rejected} odrzuconych</span>
        <span style={{ color: 'blue' }}>✉️ {summaryCounts.invited} zaproszonych</span>
      </div>

      {/* ──────  Bulk-actions bar */}
      {selectedIds.length > 0 && (
        <div className="bulk-actions-bar" style={{
          marginBottom: '1rem',
          display: 'flex',
          gap: '0.5rem'
        }}>
          <button
            onClick={() => bulkChangeStatus('accepted')}
            className="btn-secondary"
          >
            Zaakceptuj zaznaczone
          </button>
          <button
            onClick={() => bulkChangeStatus('rejected')}
            className="btn-secondary"
          >
            Odrzuć zaznaczone
          </button>
          <button
            onClick={bulkExportSelected}
            className="btn-secondary"
          >
            Eksportuj zaznaczone
          </button>
        </div>
      )}

      {/* ────── Panel globalnych filtrów + data range + eksport CSV */}
      <div className="reg-admin-header" style={{
        display: 'grid',
        gridTemplateColumns: '1fr 250px 200px 200px 120px',
        columnGap: '0.75rem',
        alignItems: 'center',
        marginBottom: '1rem'
      }}>
        {/* 1) Globalny input do wyszukiwania (imię/nazwisko/email) */}
        <input
          type="text"
          placeholder="🔍 Szukaj po nazwisku lub e-mailu…"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="reg-admin-search"
        />

        {/* 2) Filtr statusu */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="reg-admin-select"
        >
          <option value="all">Wszystkie statusy</option>
          <option value="pending">Oczekujące</option>
          <option value="accepted">Zaakceptowane</option>
          <option value="rejected">Odrzucone</option>
          <option value="invited">Zaproszeni</option>
        </select>

        {/* 3) Data od */}
        <input
          type="date"
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          className="reg-admin-date"
        />
        {/* 4) Data do */}
        <input
          type="date"
          value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          className="reg-admin-date"
        />

        {/* 5) Przycisk eksportu do CSV */}
        <button onClick={() => {
          // Eksport wszystkich widocznych (po filtrach)
          const headers = ['Zawodnik', 'Email', 'Status', 'Data zgłoszenia', 'Data modyfikacji'];
          const rows = filteredAndSorted.map(r => [
            `${r.user.name} ${r.user.surname}`,
            r.user.email,
            r.status,
            new Date(r.createdAt).toLocaleString('pl-PL'),
            new Date(r.updatedAt).toLocaleString('pl-PL')
          ]);

          let csvContent = headers.join(',') + '\n';
          for (let row of rows) {
            const escapedRow = row.map(cell => {
              let str = String(cell);
              if (str.includes(',') || str.includes('"')) {
                str = `"${str.replace(/"/g, '""')}"`;
              }
              return str;
            });
            csvContent += escapedRow.join(',') + '\n';
          }
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement('a');
          link.setAttribute('href', URL.createObjectURL(blob));
          link.setAttribute('download', `zgloszenia_filtr_turniej_${id}.csv`);
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }}
          className="btn-secondary"
        >
          Eksportuj
        </button>
      </div>

      {/* ────── TABELA ZGŁOSZEŃ (desktop) */}
      {filteredAndSorted.length === 0 ? (
        <p>Brak zgłoszeń spełniających kryteria.</p>
      ) : (
        <>
          {!isMobile && (
            <div className="table-responsive">
              <table className="registrations-table">
                <thead>
                  <tr>
                    {/* CHECKBOX */}
                    <th style={{ width: '40px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        onChange={toggleSelectAllOnCurrentPage}
                        checked={paginatedData.every(r => selectedIds.includes(r.id))}
                      />
                    </th>

                    <th onClick={() => toggleSort('name')} style={{ cursor: 'pointer' }}>
                      Zawodnik
                      {sortField === 'name' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                    </th>
                    <th onClick={() => toggleSort('email')} style={{ cursor: 'pointer' }}>
                      Email
                      {sortField === 'email' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                    </th>
                    <th>Opiekun</th>
                    <th onClick={() => toggleSort('status')} style={{ cursor: 'pointer' }}>
                      Status
                      {sortField === 'status' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                    </th>
                    <th onClick={() => toggleSort('createdAt')} style={{ cursor: 'pointer' }}>
                      Data zgłoszenia
                      {sortField === 'createdAt' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                    </th>
                    <th onClick={() => toggleSort('updatedAt')} style={{ cursor: 'pointer' }}>
                      Data modyfikacji
                      {sortField === 'updatedAt' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                    </th>
                    <th>Płeć</th>
                    <th>Preferowana kat.</th>
                    <th className="actions-col">Akcje</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedData.map(reg => {
                    // Szukamy zaakceptowanego opiekuna (backend może już filtrować po turnieju)
                    const acceptedGuardian = reg.user?.guardiansAsPlayer?.find(g => g?.status === 'accepted')?.guardian;
                    const guardianLabel = acceptedGuardian
                      ? `${acceptedGuardian.name} ${acceptedGuardian.surname}`
                      : '—';

                    return (
                      <tr key={reg.id}>
                        {/* 1) Checkbox zaznaczający wiersz */}
                        <td data-label="Zaznacz" style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(reg.id)}
                            onChange={() => toggleSelect(reg.id)}
                          />
                        </td>

                        {/* 2) Zawodnik: link do profilu */}
                        <td data-label="Zawodnik">
                          {reg.user ? (
                            <Link to={`/u/${reg.user.id}`} className="reg-username-link" title="Zobacz profil">
                              {reg.user.name} {reg.user.surname}
                            </Link>
                          ) : '—'}
                        </td>

                        {/* 3) Email */}
                        <td data-label="Email">{reg.user.email}</td>

                        {/* 3a) Opiekun */}
                        <td data-label="Opiekun">{guardianLabel}</td>

                        {/* 4) Status */}
                        <td data-label="Status" className={
                          reg.status === 'pending' ? 'reg-admin-status-pending'
                            : reg.status === 'invited' ? 'reg-admin-status-invited'
                              : reg.status === 'accepted' ? 'reg-admin-status-approved'
                                : 'reg-admin-status-rejected'
                        }>
                          {reg.status === 'pending'
                            ? 'Oczekujące'
                            : reg.status === 'invited'
                              ? 'Zaproszony'
                              : reg.status === 'accepted'
                                ? 'Zaakceptowane'
                                : 'Odrzucone'}
                        </td>

                        {/* 5) Data zgłoszenia */}
                        <td data-label="Data zgłoszenia" className="reg-date-cell">
                          {new Date(reg.createdAt).toLocaleString('pl-PL', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit', second: '2-digit'
                          })}
                        </td>

                        {/* 6) Data modyfikacji */}
                        <td data-label="Data modyfikacji" className="reg-date-cell">
                          {new Date(reg.updatedAt).toLocaleString('pl-PL', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit', second: '2-digit'
                          })}
                        </td>

                        {/* 7) Płeć z profilu użytkownika */}
                        <td data-label="Płeć">{genderChip(reg.user?.gender)}</td>

                        {/* 8) Preferowana kategoria (z profilu) */}
                        <td data-label="Preferowana kat.">{categoryChip(reg.user?.preferredCategory)}</td>

                        {/* 9) Akcje: pojedyncze (accept/reject/cancel/restore) */}
                        <td data-label="Akcje" className="actions-cell actions-col">
                          {reg.status === 'pending' ? (
                            <>
                              <button
                                onClick={() => handleStatusChange(reg.id, 'accepted')}
                                className="btn-icon btn-approve"
                              >
                                Akceptuj
                              </button>
                              <button
                                onClick={() => handleStatusChange(reg.id, 'rejected')}
                                className="btn-icon btn-reject"
                              >
                                Odrzuć
                              </button>
                            </>
                          ) : reg.status === 'invited' ? (
                            <>
                              <span style={{ marginRight: 8, fontStyle: 'italic' }}>
                                Czeka na akceptację zawodnika
                              </span>
                              <button
                                onClick={() => handleCancelInvite(reg.id)}
                                className="btn-icon btn-delete"
                              >
                                Anuluj zaproszenie
                              </button>
                            </>
                          ) : reg.status === 'accepted' ? (
                            <>
                              <span className="reg-admin-status-approved">✓ Zaakceptowane</span>
                              <button
                                onClick={() => handleStatusChange(reg.id, 'pending')}
                                className="btn-icon btn-delete"
                              >
                                Anuluj
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="reg-admin-status-rejected">✕ Odrzucone</span>
                              <button
                                onClick={() => handleStatusChange(reg.id, 'pending')}
                                className="btn-icon btn-approve"
                              >
                                Przywróć
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Widok kart dla urządzeń mobilnych */}
          {isMobile && (
            <div className="registrations-cards-list">
              {paginatedData.map((reg) => {
                const acceptedGuardian = reg.user?.guardiansAsPlayer?.find(g => g?.status === 'accepted')?.guardian;
                const guardianLabel = acceptedGuardian
                  ? `${acceptedGuardian.name} ${acceptedGuardian.surname}`
                  : '—';

                return (
                  <div key={reg.id} className="registration-card">
                    <div className="card-header" onClick={() => toggleRowExpansion(reg.id)}>
                      <div className="card-title">
                        <input
                          type="checkbox"
                          className="card-checkbox"
                          checked={selectedIds.includes(reg.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSelect(reg.id);
                          }}
                        />
                        <h4>{reg.user.name} {reg.user.surname}</h4>
                      </div>
                      <span className={
                        reg.status === 'pending' ? 'reg-admin-status-pending'
                          : reg.status === 'invited' ? 'reg-admin-status-invited'
                            : reg.status === 'accepted' ? 'reg-admin-status-accepted'
                              : 'reg-admin-status-rejected'
                      }>
                        {reg.status === 'pending'
                          ? 'Oczekujące'
                          : reg.status === 'invited'
                            ? 'Zaproszony'
                            : reg.status === 'accepted'
                              ? 'Zaakceptowane'
                              : 'Odrzucone'}
                      </span>
                      {expandedRows[reg.id] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>

                    {expandedRows[reg.id] && (
                      <div className="card-details">
                        <p><strong>Email:</strong> {reg.user.email}</p>
                        <p><strong>Opiekun:</strong> {guardianLabel}</p>
                        <p>
                          <strong>Data zgłoszenia:</strong> {new Date(reg.createdAt).toLocaleString('pl-PL', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit', second: '2-digit'
                          })}
                        </p>
                        <p>
                          <strong>Data modyfikacji:</strong> {new Date(reg.updatedAt).toLocaleString('pl-PL', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit', second: '2-digit'
                          })}
                        </p>
                        <div className="card-actions-mobile">
                          {reg.status === 'pending' ? (
                            <>
                              <button
                                onClick={() => handleStatusChange(reg.id, 'accepted')}
                                className="btn-icon btn-approve"
                              >
                                <CheckCircle size={18} /> Zatwierdź
                              </button>
                              <button
                                onClick={() => handleStatusChange(reg.id, 'rejected')}
                                className="btn-icon btn-reject"
                              >
                                <XCircle size={18} /> Odrzuć
                              </button>
                            </>
                          ) : reg.status === 'invited' ? (
                            <>
                              <span style={{ marginRight: 8, fontStyle: 'italic' }}>
                                Czeka na akceptację zawodnika
                              </span>
                              <button
                                onClick={() => handleCancelInvite(reg.id)}
                                className="btn-icon btn-delete"
                              >
                                <Trash2 size={18} /> Anuluj zaproszenie
                              </button>
                            </>
                          ) : reg.status === 'accepted' ? (
                            <>
                              <span className="reg-action-status-indicator">✓ Zaakceptowane</span>
                              <button
                                onClick={() => handleStatusChange(reg.id, 'pending')}
                                className="btn-icon btn-delete"
                              >
                                <Trash2 size={18} /> Anuluj
                              </button>
                            </>
                          ) : ( // reg.status === 'rejected'
                            <>
                              <span className="reg-action-status-indicator">✕ Odrzucone</span>
                              <button
                                onClick={() => handleStatusChange(reg.id, 'pending')}
                                className="btn-icon btn-approve"
                              >
                                <CheckCircle size={18} /> Przywróć
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ────── PAGINACJA  */}
      {filteredAndSorted.length > 0 && totalPages > 1 && (
        <div className="pagination" aria-label="Paginacja zgłoszeń">
          <button
            onClick={() => goToPage(1)}
            disabled={currentPage === 1}
            aria-label="Pierwsza strona"
          >
            ⏮
          </button>
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            aria-label="Poprzednia strona"
          >
            ‹
          </button>
          <span>
            Strona {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            aria-label="Następna strona"
          >
            ›
          </button>
          <button
            onClick={() => goToPage(totalPages)}
            disabled={currentPage === totalPages}
            aria-label="Ostatnia strona"
          >
            ⏭
          </button>
        </div>
      )}
    </div>
  );
}
