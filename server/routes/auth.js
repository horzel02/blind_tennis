// server/routes/auth.js
import { Router } from 'express';
import passport from 'passport';
import { register, logout, changePassword, updatePreferences } from '../controllers/authController.js';
import { ensureAuth } from '../middlewares/auth.js';
import prisma from '../prismaClient.js';

const router = Router();

async function getAppRoles(prismaClient, userId) {
  const rows = await prismaClient.user_roles.findMany({
    where: { user_id: userId },
    include: { roles: { select: { role_name: true } } },
  });
  return rows
    .map(r => r.roles?.role_name?.toLowerCase())
    .filter(Boolean);
}

function pickPrimaryRole(appRoles) {
  if (!appRoles || appRoles.length === 0) return 'user';
  if (appRoles.includes('admin')) return 'admin';
  if (appRoles.includes('moderator')) return 'moderator';
  return 'user';
}

router.post('/register', register);

function deriveGlobalRole(userRoles) {
  if (!Array.isArray(userRoles) || userRoles.length === 0) return 'user';
  const set = new Set(userRoles.map(r => (r.role || '').toLowerCase()));
  if (set.has('admin')) return 'admin';
  if (set.has('moderator')) return 'moderator';
  return 'user';
}

router.post('/login', (req, res, next) => {
  passport.authenticate('local', { session: true }, async (err, user, info) => {
    if (err) {
      console.error("Błąd serwera podczas uwierzytelniania:", err);
      return res.status(500).json({ success: false, message: 'Wystąpił błąd serwera podczas logowania.' });
    }
    if (!user) {
      console.log("Nieudane logowanie:", info?.message);
      return res.status(401).json({ success: false, message: info?.message || 'Niepoprawny e-mail lub hasło.' });
    }

    try {
      const u = await prisma.users.findUnique({
        where: { id: user.id },
        select: { id: true, active: true },
      });
      if (!u) return res.status(401).json({ success: false, message: 'Nieautoryzowany' });
      if (u.active === false) {
        return res.status(403).json({ success: false, message: 'Konto dezaktywowane' });
      }
    } catch (e) {
      console.error("Błąd przy sprawdzaniu active:", e);
      return res.status(500).json({ success: false, message: 'Błąd serwera.' });
    }

    req.logIn(user, async (loginErr) => {
      if (loginErr) {
        console.error("Błąd podczas req.login:", loginErr);
        return res.status(500).json({ success: false, message: 'Wystąpił błąd serwera podczas tworzenia sesji.' });
      }

      try {
        const userFull = await prisma.users.findUnique({
          where: { id: user.id },
          include: {
            user_roles: true,
            tournamentUserRoles: true,
          },
        });

        if (!userFull) {
          return res.status(404).json({ success: false, message: 'Użytkownik nie znaleziony.' });
        }

        const appRoles = await getAppRoles(prisma, user.id);

        const simplifiedUser = {
          id: userFull.id,
          name: userFull.name,
          surname: userFull.surname,
          email: userFull.email,
          active: userFull.active !== false,
          roles: userFull.tournamentUserRoles.map(r => r.role),
          appRoles,
          role: pickPrimaryRole(appRoles)
        };

        console.log('Pomyślnie zalogowano użytkownika:', simplifiedUser.email);
        return res.status(200).json({ success: true, user: simplifiedUser });
      } catch (dbErr) {
        console.error("Błąd pobierania danych użytkownika po logowaniu:", dbErr);
        return res.status(500).json({ success: false, message: 'Nie udało się pobrać danych użytkownika.' });
      }
    });
  })(req, res, next);
});

router.post('/logout', logout);

router.get('/profile', ensureAuth, async (req, res) => {
  try {
    const userFull = await prisma.users.findUnique({
      where: { id: req.user.id },
      include: {
        user_roles: true,
        tournamentUserRoles: true,
      },
    });
    if (!userFull) return res.status(404).json({ message: 'Użytkownik nie znaleziony.' });

    const appRoles = await getAppRoles(prisma, req.user.id);

    const simplifiedUser = {
      id: userFull.id,
      name: userFull.name,
      surname: userFull.surname,
      email: userFull.email,
      active: userFull.active !== false,
      roles: userFull.tournamentUserRoles.map(r => r.role),
      appRoles,
      role: pickPrimaryRole(appRoles),
      gender: userFull.gender,
      preferredCategory: userFull.preferredCategory,
    };

    res.json(simplifiedUser);
  } catch (error) {
    console.error("Błąd podczas pobierania profilu użytkownika:", error);
    res.status(500).json({ message: 'Błąd podczas pobierania profilu użytkownika.' });
  }
});

router.post('/change-password', ensureAuth, changePassword);
router.patch('/preferences', ensureAuth, updatePreferences);

export default router;
