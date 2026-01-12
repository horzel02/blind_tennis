// server/services/authService.js
import bcrypt from 'bcrypt';
import prisma from '../prismaClient.js';

const PASSWORD_RULE =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_RULE_MSG =
  'Hasło musi mieć min. 8 znaków, zawierać małą i dużą literę, cyfrę oraz znak specjalny.';

export function validatePasswordComplexity(password) {
  if (!PASSWORD_RULE.test(password || '')) {
    const err = new Error(PASSWORD_RULE_MSG);
    err.code = 'WEAK_PASSWORD';
    throw err;
  }
}

function normalizePreferredCategory(preferredCategory) {
  const pc = String(preferredCategory || '').toUpperCase();
  const allowed = ['B1', 'B2', 'B3', 'B4', 'OPEN'];
  return allowed.includes(pc) ? pc : null;
}

function normalizeGender(gender) {
  const g = String(gender || '').toLowerCase();
  return ['male', 'female'].includes(g) ? g : null;
}

export async function registerUser({ name, surname, email, password, gender, preferredCategory }) {
  validatePasswordComplexity(password);

  const hash = await bcrypt.hash(password, 10);

  const safeGender = normalizeGender(gender);
  const safePrefCat = normalizePreferredCategory(preferredCategory);

  const user = await prisma.users.create({
    data: {
      name,
      surname,
      email,
      password_hash: hash,
      gender: safeGender,
      preferredCategory: safePrefCat,
    }
  });

  const role = await prisma.roles.findFirst({
    where: { role_name: 'user', active: true }
  });

  if (role) {
    await prisma.user_roles.create({
      data: { user_id: user.id, role_id: role.id }
    });
  }

  return user;
}

export async function changePasswordForUser({ userId, currentPassword, newPassword }) {
  if (!currentPassword || !newPassword) {
    const err = new Error('Brak wymaganych danych');
    err.code = 'MISSING_FIELDS';
    throw err;
  }

  const user = await prisma.users.findUnique({
    where: { id: userId }
  });

  if (!user) {
    const err = new Error('Użytkownik nie istnieje');
    err.code = 'USER_NOT_FOUND';
    throw err;
  }

  const match = await bcrypt.compare(currentPassword, user.password_hash);
  if (!match) {
    const err = new Error('Aktualne hasło jest nieprawidłowe');
    err.code = 'BAD_CURRENT_PASSWORD';
    throw err;
  }

  validatePasswordComplexity(newPassword);

  const hash = await bcrypt.hash(newPassword, 10);

  await prisma.users.update({
    where: { id: userId },
    data: {
      password_hash: hash,
      modification_date: new Date()
    }
  });

  return { ok: true };
}

export async function updateUserPreferences({ userId, preferredCategory }) {
  const safePrefCat = normalizePreferredCategory(preferredCategory);

  const updated = await prisma.users.update({
    where: { id: userId },
    data: {
      preferredCategory: safePrefCat,
      modification_date: new Date()
    },
    select: {
      id: true,
      name: true,
      surname: true,
      email: true,
      gender: true,
      preferredCategory: true,
      active: true
    }
  });

  return updated;
}
