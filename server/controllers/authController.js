// server/controllers/authController.js
import * as authService from '../services/authService.js';

export async function register(req, res) {
  try {
    const { name, surname, email, password } = req.body;
    if (!name || !surname || !email || !password) {
      return res.status(400).json({ error: 'Brakuje wymaganych pól' });
    }
    await authService.registerUser(req.body);
    res.status(201).json({ message: 'Zarejestrowano pomyślnie' });
  } catch (err) {
    console.error(err);
    if (err.code === 'WEAK_PASSWORD') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Błąd przy rejestracji' });
  }
}

export function login(req, res) {
  const { id, name, surname, email, roles, gender, preferredCategory } = req.user;
  res.json({ id, name, surname, email, roles, gender, preferredCategory });
}

export function logout(req, res, next) {
  req.logout(err => {
    if (err) return next(err);
    res.json({ message: 'Wylogowano' });
  });
}

export function profile(req, res) {
  const { id, name, surname, email, roles, gender, preferredCategory } = req.user;
  res.json({ id, name, surname, email, roles, gender, preferredCategory });
}

export async function changePassword(req, res) {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body || {};
    await authService.changePasswordForUser({ userId, currentPassword, newPassword });
    return res.json({ ok: true, message: 'Hasło zostało zmienione.' });
  } catch (err) {
    console.error('changePassword error:', err);
    if (['WEAK_PASSWORD', 'BAD_CURRENT_PASSWORD', 'MISSING_FIELDS'].includes(err.code)) {
      return res.status(400).json({ error: err.message });
    }
    if (err.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Błąd przy zmianie hasła.' });
  }
}

export async function updatePreferences(req, res) {
  try {
    const userId = req.user.id;
    const { preferredCategory } = req.body || {};
    const updated = await authService.updateUserPreferences({ userId, preferredCategory });
    return res.json(updated);
  } catch (err) {
    console.error('updatePreferences error:', err);
    return res.status(500).json({ error: 'Błąd przy aktualizacji preferencji.' });
  }
}
