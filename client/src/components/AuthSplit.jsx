// client/src/components/AuthSplit.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/auth-split.css';
import { toast } from 'react-toastify';
import illustration from '../assets/tennis-illustration.svg';
import Breadcrumbs from '../components/Breadcrumbs';
import { validatePasswordComplexity, PASSWORD_RULE_MESSAGE } from '../services/authService';

export default function AuthSplit({ mode = 'login' }) {
  const isLogin = mode === 'login';
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(
    isLogin
      ? { email: '', password: '' }
      : { name: '', surname: '', email: '', password: '', gender: '', preferredCategory: '' }
  );

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isLogin) {
        await login({ email: form.email, password: form.password });
        toast.success('Zalogowano pomyślnie!');
        window.location.replace('/');
      } else {
        if (!validatePasswordComplexity(form.password)) {
          toast.error(PASSWORD_RULE_MESSAGE);
          return;
        }
        await register(form);
        toast.success('Rejestracja zakończona sukcesem!');
        navigate('/login');
      }
    } catch (err) {
      console.error('Błąd logowania/rejestracji:', err);
      toast.error(err.message || 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.');
    }
  };

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: isLogin ? 'Logowanie' : 'Rejestracja' },
  ];

  return (
    <div className="auth-page-wrapper">
      <Breadcrumbs items={breadcrumbItems} />

      <div className="auth-split-container">
        <div className="panel panel--form">
          <h2 className="auth-title">{isLogin ? 'Logowanie' : 'Rejestracja'}</h2>

          <form onSubmit={handleSubmit}>
            {!isLogin && (
              <>
                <div className="form-group">
                  <label htmlFor="name">Imię</label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={handleChange}
                    required
                    className="auth-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="surname">Nazwisko</label>
                  <input
                    id="surname"
                    name="surname"
                    type="text"
                    value={form.surname}
                    onChange={handleChange}
                    required
                    className="auth-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="gender">Płeć</label>
                  <select
                    id="gender"
                    name="gender"
                    value={form.gender}
                    onChange={handleChange}
                    className="auth-input"
                  >
                    <option value="">— wybierz —</option>
                    <option value="male">Mężczyzna</option>
                    <option value="female">Kobieta</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="preferredCategory">Preferowana kategoria</label>
                  <select
                    id="preferredCategory"
                    name="preferredCategory"
                    value={form.preferredCategory}
                    onChange={handleChange}
                    className="auth-input"
                  >
                    <option value="">— brak / ustalę później —</option>
                    <option value="B1">B1</option>
                    <option value="B2">B2</option>
                    <option value="B3">B3</option>
                    <option value="B4">B4</option>
                  </select>
                </div>
              </>
            )}

            <div className="form-group">
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                required
                className="auth-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Hasło</label>
              <input
                id="password"
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                required
                className="auth-input"
              />
              {!isLogin && (
                <p className="field-hint">
                  {PASSWORD_RULE_MESSAGE}
                </p>
              )}
            </div>

            <button type="submit" className="auth-button btn-primary">
              {isLogin ? 'Zaloguj się' : 'Zarejestruj się'}
            </button>
          </form>
        </div>

        <div className="panel panel--aside">
          <div className="aside-illustration-wrapper">
            <img src={illustration} alt="" aria-hidden="true" className="aside-illustration" />
          </div>
          <div className="aside-text">
            <h3>{isLogin ? 'Witaj ponownie!' : 'Dołącz do nas!'}</h3>
            <p>
              {isLogin
                ? 'Zaloguj się lub przejdź do rejestracji jeśli nie masz jeszcze konta.'
                : 'Zarejestruj konto lub przejdź do logowania jeśli już je masz'}
            </p>
            <Link to={isLogin ? '/register' : '/login'} className="aside-button">
              {isLogin ? 'Zarejestruj się' : 'Zaloguj się'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
