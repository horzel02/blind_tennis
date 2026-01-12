// client/src/pages/AccountSettingsPage.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { validatePasswordComplexity, PASSWORD_RULE_MESSAGE } from '../services/authService';
import '../styles/accountSettings.css';

export default function AccountSettingsPage() {
  const { user, loading, changePassword, updatePreferences } = useAuth();

  const [preferredCategory, setPreferredCategory] = useState('');
  const [savingPref, setSavingPref] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [changingPass, setChangingPass] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (user?.preferredCategory) {
      setPreferredCategory(user.preferredCategory);
    } else {
      setPreferredCategory('');
    }
  }, [user]);

  if (loading) return <div className="container"><p>Ładowanie…</p></div>;
  if (!user) return <div className="container"><p>Musisz być zalogowany.</p></div>;

  const handleSavePreferences = async (e) => {
    e.preventDefault();
    try {
      setSavingPref(true);
      await updatePreferences({ preferredCategory: preferredCategory || null });
    } finally {
      setSavingPref(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');

    if (!currentPassword || !newPassword || !newPassword2) return;

    if (newPassword !== newPassword2) {
      setPasswordError('Nowe hasła nie są takie same');
      return;
    }

    if (!validatePasswordComplexity(newPassword)) {
      setPasswordError(PASSWORD_RULE_MESSAGE);
      return;
    }

    try {
      setChangingPass(true);
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setNewPassword2('');
    } catch (err) {
      setPasswordError(err.message || 'Nie udało się zmienić hasła');
    } finally {
      setChangingPass(false);
    }
  };

  const initials = `${(user.name || '')[0] || ''}${(user.surname || '')[0] || ''}`.toUpperCase();
  const displayName = `${user.name} ${user.surname}`;

  return (
    <section className="container account-settings-page">
      <header className="account-settings-header">
        <div className="account-settings-avatar" aria-label={`Avatar ${displayName}`}>
          {initials}
        </div>
        <div className="account-settings-title-block">
          <h1>Moje konto</h1>
          <p className="account-settings-subtitle">
            Zarządzaj swoim profilem, preferencjami i hasłem.
          </p>
          <div className="account-settings-meta">
            <span>{displayName}</span>
            <span className="sep">•</span>
            <span>{user.email}</span>
            {user.preferredCategory && (
              <>
                <span className="sep">•</span>
                <span>Preferowana kategoria: <strong>{user.preferredCategory}</strong></span>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="account-settings-grid">
        <div className="card">
          <div className="card-header">Preferowana kategoria</div>
          <div className="card-body">
            <p className="account-settings-help">
              Ta informacja jest używana na liście zgłoszeń oraz w Twoim profilu publicznym.
            </p>
            <form onSubmit={handleSavePreferences} className="account-form">
              <div className="form-group">
                <label htmlFor="preferredCategory" className="account-label">
                  Kategoria
                </label>
                <select
                  id="preferredCategory"
                  value={preferredCategory}
                  onChange={(e) => setPreferredCategory(e.target.value)}
                  className="input"
                >
                  <option value="">Brak / nie określono</option>
                  <option value="B1">B1</option>
                  <option value="B2">B2</option>
                  <option value="B3">B3</option>
                  <option value="OPEN">OPEN</option>
                </select>
              </div>

              <div className="account-actions">
                <button type="submit" className="btn-primary" disabled={savingPref}>
                  {savingPref ? 'Zapisywanie…' : 'Zapisz preferencje'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="card">
          <div className="card-header">Zmień hasło</div>
          <div className="card-body">
            <p className="account-settings-help">
              Hasło możesz zmienić tylko po podaniu aktualnego. Nie resetujemy go automatycznie.
              <br />
              <span style={{ fontSize: '0.9rem' }}>{PASSWORD_RULE_MESSAGE}</span>
            </p>
            <form onSubmit={handleChangePassword} className="account-form">
              <div className="form-group">
                <label htmlFor="currentPassword" className="account-label">
                  Aktualne hasło
                </label>
                <input
                  id="currentPassword"
                  type="password"
                  className="input"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>

              <div className="form-group">
                <label htmlFor="newPassword" className="account-label">
                  Nowe hasło
                </label>
                <input
                  id="newPassword"
                  type="password"
                  className="input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              <div className="form-group">
                <label htmlFor="newPassword2" className="account-label">
                  Powtórz nowe hasło
                </label>
                <input
                  id="newPassword2"
                  type="password"
                  className="input"
                  value={newPassword2}
                  onChange={(e) => setNewPassword2(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              {passwordError && (
                <div
                  style={{
                    marginTop: '0.5rem',
                    color: '#b91c1c',
                    fontSize: '0.9rem',
                  }}
                >
                  {passwordError}
                </div>
              )}

              <div className="account-actions">
                <button type="submit" className="btn-primary" disabled={changingPass}>
                  {changingPass ? 'Zmiana hasła…' : 'Zmień hasło'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
