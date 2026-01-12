// server/auth.js
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import prisma from './prismaClient.js';

// LocalStrategy po email i password
passport.use(new LocalStrategy({ usernameField: 'email' },
  async (email, password, done) => {
    try {
      // Znajdź użytkownika za pomocą Prismy
      const user = await prisma.users.findFirst({
        where: {
          email: email,
          active: true
        }
      });

      if (!user) {
        return done(null, false, { message: 'Nieprawidłowy email lub użytkownik nieaktywny.' });
      }

      // Porównaj hasło
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        return done(null, false, { message: 'Nieprawidłowe hasło.' });
      }

      const userRoles = await prisma.user_roles.findMany({
        where: {
          user_id: user.id,
          roles: {
            active: true
          }
        },
        select: {
          roles: {
            select: {
              role_name: true
            }
          }
        }
      });

      user.roles = userRoles.map(ur => ur.roles.role_name);
      return done(null, user);
    } catch (err) {
      console.error("Błąd w LocalStrategy:", err);
      return done(err);
    }
  }));

// Serializacja użytkownika (zapisywanie ID użytkownika w sesji)
passport.serializeUser((user, done) => {
  //console.log('DEBUG: ENTERING serializeUser');
  //console.log('DEBUG: User ID passed to serializeUser:', user.id); // Sprawdzamy, jakie ID użytkownika jest przekazywane
  done(null, user.id);
  //console.log('DEBUG: EXITING serializeUser');
});

// Deserializacja użytkownika (odzyskiwanie obiektu użytkownika z ID z sesji)
passport.deserializeUser(async (id, done) => {
  //console.log('DEBUG: ENTERING deserializeUser');
  //console.log('DEBUG: ID passed to deserializeUser:', id); // Sprawdzamy, jakie ID jest odczytywane z sesji
  try {
    const user = await prisma.users.findUnique({
      where: {
        id: id,
        active: true
      },
      select: {
        id: true,
        name: true,
        surname: true,
        email: true
      }
    });

    if (!user) {
      console.log('DEBUG: User not found in deserializeUser for ID:', id);
      return done(null, false);
    }

    // Pobierz role użytkownika (ponownie)
    const userRoles = await prisma.user_roles.findMany({
      where: {
        user_id: user.id,
        roles: {
          active: true
        }
      },
      select: {
        roles: {
          select: {
            role_name: true
          }
        }
      }
    });

    user.roles = userRoles.map(ur => ur.roles.role_name);
    //console.log('DEBUG: User found and deserialized:', user.id, user.email);
    done(null, user);
  } catch (err) {
    console.error("Błąd w deserializeUser:", err);
    done(err);
  }
  //console.log('DEBUG: EXITING deserializeUser');
});