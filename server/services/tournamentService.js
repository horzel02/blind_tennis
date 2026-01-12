// server/services/tournamentService.js
import prisma from '../prismaClient.js';
export { generateGroupAndKnockoutMatches, generateKnockoutSkeleton, seedKnockout, resetKnockoutFromRound } from './matchService.js';

function parseDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    throw new Error(`Nieprawidłowa data: ${dateStr}`);
  }
  return d;
}

function toInt(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function toBool(v, def = undefined) {
  if (v === undefined) return def;
  if (v === null) return null;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return ['true', '1', 'yes', 'on'].includes(v.toLowerCase());
  if (typeof v === 'number') return v !== 0;
  return def;
}


function normalizeFormat(format, isGroupPhase) {
  if (format === 'GROUPS_KO' || format === 'KO_ONLY') return format;
  if (typeof isGroupPhase === 'boolean') return isGroupPhase ? 'GROUPS_KO' : 'KO_ONLY';
  return 'GROUPS_KO';
}

function validateSettings({ format, groupSize, qualifiersPerGroup, participant_limit, allowByes }) {
  if (format === 'GROUPS_KO') {
    if (![3, 4].includes(groupSize ?? 0)) {
      throw new Error('groupSize musi być 3 albo 4 (dla formatu Grupy+KO).');
    }
    if (![1, 2].includes(qualifiersPerGroup ?? 0)) {
      throw new Error('qualifiersPerGroup musi być 1 albo 2 (dla formatu Grupy+KO).');
    }
    if (participant_limit != null) {
      if (participant_limit <= 0) throw new Error('Limit miejsc musi być dodatni.');
      if (groupSize && (participant_limit % groupSize !== 0)) {
        throw new Error('Limit miejsc musi dzielić się przez rozmiar grup (participant_limit % groupSize === 0).');
      }
    }
  }
}

function isKORoundLabel(round = '') {
  return /(1\/(64|32|16|8)\s*finału|ćwierćfinał|półfinał|finał)/i.test(round || '');
}

async function getMatchStatsForTournament(tournamentId) {
  const tId = Number(tournamentId);
  const matches = await prisma.match.findMany({
    where: { tournamentId: tId },
    select: { id: true, round: true }
  });
  const total = matches.length;
  let groupCount = 0;
  let koCount = 0;
  for (const m of matches) {
    if (isKORoundLabel(m.round)) koCount++;
    else groupCount++;
  }
  return { total, groupCount, koCount };
}

function normGender(g) {
  const s = String(g ?? '').trim().toLowerCase();
  if (!s) return null;
  if (['m', 'male', 'man', 'men', 'mężczyzna', 'mężczyźni', 'mezczyzna', 'mezczyzni', 'm.'].includes(s)) return 'male';
  if (['w', 'female', 'woman', 'women', 'kobieta', 'kobiety', 'k', 'f', 'k.'].includes(s)) return 'female';
  if (['coed', 'mixed', 'mix', 'open'].includes(s)) return 'coed';
  return null;
}

async function requiredGenderForTournament(tid) {
  const Cat = prisma.tournamentCategory || prisma.tournamentcategory;
  const cats = await Cat.findMany({
    where: { tournamentId: Number(tid) },
    select: { gender: true },
  });

  const set = new Set(cats.map(c => normGender(c.gender)).filter(Boolean));
  if (set.has('coed')) return null;

  const onlySexes = [...set].filter(x => x === 'male' || x === 'female');
  const uniq = new Set(onlySexes);
  return (uniq.size === 1) ? [...uniq][0] : null;
}

const ALLOWED_FORMULA = ['towarzyski', 'mistrzowski'];
function normalizeFormula(v) {
  const x = String(v ?? '').toLowerCase().trim();
  return ALLOWED_FORMULA.includes(x) ? x : 'towarzyski';
}

const ALLOWED_TYPES = ['open', 'invite'];
function normalizeType(v) {
  const x = String(v ?? '').toLowerCase().trim();
  return ALLOWED_TYPES.includes(x) ? x : 'open';
}

/* ========================================================================== */
/*                               CRUD turnieju                                */
/* ========================================================================== */

export function createTournament({
  name,
  description,
  street,
  postalCode,
  city,
  country,
  start_date,
  end_date,
  registration_deadline,
  participant_limit,
  applicationsOpen,
  formula,

  type,

  format,
  groupSize,
  qualifiersPerGroup,
  allowByes,
  koSeedingPolicy,
  avoidSameGroupInR1,


  isGroupPhase,
  setsToWin,
  gamesPerSet,
  tieBreakType,
  organizer_id,
  categories,
}) {
  const fmt = normalizeFormat(format, isGroupPhase);
  const limit = toInt(participant_limit);

  const gs = groupSize != null ? toInt(groupSize) : null; 
  const qpg = qualifiersPerGroup != null ? toInt(qualifiersPerGroup) : null;

  const byes = toBool(allowByes, true);
  const avoid = toBool(avoidSameGroupInR1, true);

  validateSettings({
    format: fmt,
    groupSize: gs,
    qualifiersPerGroup: qpg,
    participant_limit: limit,
    allowByes: byes,
  });

  const categoriesToCreate = (categories || []).map(cat => ({
    categoryName: cat.category,
    gender: cat.gender,
  }));

  return prisma.tournament.create({
    data: {
      name,
      description,
      street,
      postalCode,
      city,
      country,
      start_date: parseDate(start_date),
      end_date: parseDate(end_date),
      registration_deadline: registration_deadline ? parseDate(registration_deadline) : null,

      participant_limit: limit,
      applicationsOpen: toBool(applicationsOpen, true),
      formula: normalizeFormula(formula),
      type: normalizeType(type),

      format: fmt,
      ...(gs !== null && gs !== undefined ? { groupSize: gs } : {}),
      ...(qpg !== null && qpg !== undefined ? { qualifiersPerGroup: qpg } : {}),
      allowByes: byes,
      koSeedingPolicy: koSeedingPolicy || 'RANDOM_CROSS',
      avoidSameGroupInR1: avoid,

      organizer_id,
      isGroupPhase: fmt === 'GROUPS_KO',
      setsToWin: toInt(setsToWin) ?? 2,
      gamesPerSet: toInt(gamesPerSet) ?? 4,
      tieBreakType: tieBreakType || 'super',

      categories: { create: categoriesToCreate },
      tournamentUserRoles: { create: { userId: organizer_id, role: 'organizer' } },
    },
    include: { categories: true },
  });
}


export function updateTournament(
  id,
  {
    name,
    description,
    street,
    postalCode,
    city,
    country,
    start_date,
    end_date,
    registration_deadline,
    participant_limit,
    applicationsOpen,
    formula,
    type,

    format,
    groupSize,
    qualifiersPerGroup,
    allowByes,
    koSeedingPolicy,
    avoidSameGroupInR1,

    isGroupPhase,
    setsToWin,
    gamesPerSet,
    tieBreakType,
    categories,
  }
) {
  return prisma.tournament.findUnique({
    where: { id: Number(id) },
    select: {
      format: true,
      groupSize: true,
      qualifiersPerGroup: true,
      participant_limit: true,
      allowByes: true,
      isGroupPhase: true,
    },
  }).then(async current => {
    if (!current) throw new Error('Turniej nie istnieje');

    // policz stan meczów
    const stats = await getMatchStatsForTournament(id);

    // >>> Blokady:
    // 1) format – nie zmieniamy, gdy są jakiekolwiek mecze
    if (format !== undefined) {
      const targetFmt = normalizeFormat(format, isGroupPhase);
      const currentFmt = normalizeFormat(current.format, current.isGroupPhase);
      if (targetFmt !== currentFmt && stats.total > 0) {
        throw new Error('Nie można zmieniać formatu, gdy turniej ma już wygenerowane mecze.');
      }
    }

    // 2) groupSize / qualifiersPerGroup – nie zmieniamy, gdy istnieją mecze grupowe
    if (stats.groupCount > 0) {
      if (groupSize !== undefined) {
        throw new Error('Nie można zmienić rozmiaru grup, gdy istnieją mecze grupowe. Najpierw usuń mecze grupowe.');
      }
      if (qualifiersPerGroup !== undefined) {
        throw new Error('Nie można zmienić liczby awansujących z grup, gdy istnieją mecze grupowe. Najpierw usuń mecze grupowe.');
      }
    }

    // 3) allowByes / koSeedingPolicy – opcjonalna blokada, gdy istnieją mecze KO
    if (stats.koCount > 0) {
      if (allowByes !== undefined) {
        throw new Error('Nie można zmienić ustawienia BYE po wygenerowaniu meczów KO. Najpierw zresetuj KO.');
      }
      if (koSeedingPolicy !== undefined) {
        throw new Error('Nie można zmienić polityki rozstawiania po wygenerowaniu meczów KO. Najpierw zresetuj KO.');
      }
    }

    const fmt = (format !== undefined)
      ? normalizeFormat(format, isGroupPhase)
      : normalizeFormat(current.format, current.isGroupPhase);

    const gsRaw = (groupSize !== undefined) ? toInt(groupSize) : (current.groupSize ?? null);
    const qpgRaw = (qualifiersPerGroup !== undefined) ? toInt(qualifiersPerGroup) : (current.qualifiersPerGroup ?? null);
    const limit = (participant_limit !== undefined) ? toInt(participant_limit) : (toInt(current.participant_limit) ?? null);
    const byes = (allowByes !== undefined) ? toBool(allowByes) : (current.allowByes ?? true);

    validateSettings({
      format: fmt,
      ...(gsRaw !== undefined && gsRaw !== null ? { groupSize: gsRaw } : {}),
      ...(qpgRaw !== undefined && qpgRaw !== null ? { qualifiersPerGroup: qpgRaw } : {}),
      participant_limit: limit,
      ...(byes !== undefined ? { allowByes: byes } : {}),
    });

    const data = {
      name,
      description,
      street,
      postalCode,
      city,
      country,
      start_date: start_date !== undefined ? parseDate(start_date) : undefined,
      end_date: end_date !== undefined ? parseDate(end_date) : undefined,
      registration_deadline: registration_deadline !== undefined
        ? (registration_deadline ? parseDate(registration_deadline) : null)
        : undefined,
      applicationsOpen: applicationsOpen !== undefined ? toBool(applicationsOpen) : undefined,
      participant_limit: participant_limit !== undefined ? limit : undefined,
      ...(formula !== undefined ? { formula: normalizeFormula(formula) } : {}),
      ...(type !== undefined ? { type: normalizeType(type) } : {}),
      ...(format !== undefined ? { format: fmt, isGroupPhase: fmt === 'GROUPS_KO' } : {}),
      ...(groupSize !== undefined && gsRaw !== null ? { groupSize: gsRaw } : {}),
      ...(qualifiersPerGroup !== undefined && qpgRaw !== null ? { qualifiersPerGroup: qpgRaw } : {}),
      ...(allowByes !== undefined ? { allowByes: byes } : {}),
      ...(koSeedingPolicy !== undefined ? { koSeedingPolicy } : {}),
      ...(avoidSameGroupInR1 !== undefined ? { avoidSameGroupInR1: toBool(avoidSameGroupInR1) } : {}),
      setsToWin: setsToWin !== undefined ? toInt(setsToWin) : undefined,
      gamesPerSet: gamesPerSet !== undefined ? toInt(gamesPerSet) : undefined,
      tieBreakType: tieBreakType !== undefined ? tieBreakType : undefined,
      ...(categories ? {
        categories: {
          deleteMany: {},
          create: categories.map(cat => ({
            categoryName: cat.category,
            gender: cat.gender,
          })),
        }
      } : {}),
      updated_at: new Date(),
    };

    return prisma.tournament.update({
      where: { id: Number(id) },
      data,
      include: { categories: true },
    });
  });
}



export function findAllTournaments() {
  return prisma.tournament.findMany({
    orderBy: { start_date: 'desc' },
    include: { categories: true }
  });
}

export function findTournamentById(id) {
  return prisma.tournament.findUnique({
    where: { id: Number(id) },
    include: { categories: true }
  });
}

export async function deleteTournament(id) {
  const tId = Number(id);

  // zbierz ID meczów żeby skasować sety/linki
  const matchIds = (await prisma.match.findMany({
    where: { tournamentId: tId }, select: { id: true }
  })).map(m => m.id);

  const tx = [];

  if (matchIds.length) {
    if (prisma.matchSet?.deleteMany) {
      tx.push(prisma.matchSet.deleteMany({ where: { matchId: { in: matchIds } } }));
    }
    if (prisma.matchLink?.deleteMany) {
      tx.push(prisma.matchLink.deleteMany({
        where: { OR: [{ fromId: { in: matchIds } }, { toId: { in: matchIds } }] }
      }));
    }
  }

  tx.push(prisma.match.deleteMany({ where: { tournamentId: tId } }));

  // role organizator/sędzia
  const Role = prisma.tournamentUserRole || prisma.tournamentuserrole;
  if (Role?.deleteMany) tx.push(Role.deleteMany({ where: { tournamentId: tId } }));

  // rejestracje
  const Reg = prisma.tournamentRegistration || prisma.tournamentregistration;
  if (Reg?.deleteMany) tx.push(Reg.deleteMany({ where: { tournamentId: tId } }));

  // kategorie
  const Cat = prisma.tournamentCategory || prisma.tournamentcategory;
  if (Cat?.deleteMany) tx.push(Cat.deleteMany({ where: { tournamentId: tId } }));

  // na końcu sam turniej
  tx.push(prisma.tournament.delete({ where: { id: tId } }));

  await prisma.$transaction(tx);
  return { deleted: true };
}

export function findTournamentsByOrganizer(userId) {
  return prisma.tournament.findMany({
    where: {
      OR: [
        { organizer_id: Number(userId) },
        { tournamentUserRoles: { some: { userId: Number(userId), role: 'organizer' } } }
      ]
    },
    include: { categories: true, tournamentUserRoles: true },
    orderBy: { start_date: 'desc' }
  });
}

/* ========================================================================== */
/*                         Ustawienia turnieju (Settings)                     */
/* ========================================================================== */

export async function getTournamentSettings(tournamentId) {
  const id = Number(tournamentId);
  const t = await prisma.tournament.findUnique({
    where: { id },
    select: {
      id: true,
      format: true,
      groupSize: true,
      qualifiersPerGroup: true,
      allowByes: true,
      koSeedingPolicy: true,
      avoidSameGroupInR1: true,
      participant_limit: true,
      applicationsOpen: true,
      isGroupPhase: true,
    },
  });
  if (!t) throw new Error('Turniej nie istnieje');
  return t;
}

export async function updateTournamentSettings(tournamentId, payload) {
  const id = Number(tournamentId);

  const allowedFormat = new Set(['GROUPS_KO', 'KO_ONLY']);
  const allowedPolicy = new Set(['RANDOM_CROSS', 'STRUCTURED']);

  const data = {};
  if (payload.format != null) {
    if (!allowedFormat.has(payload.format)) throw new Error('Nieprawidłowy format');
    data.format = payload.format;
    data.isGroupPhase = payload.format === 'GROUPS_KO';
  }
  if (payload.groupSize != null) {
    const gs = Number(payload.groupSize);
    if (![3, 4].includes(gs)) throw new Error('groupSize musi być 3 lub 4');
    data.groupSize = gs;
  }
  if (payload.qualifiersPerGroup != null) {
    const q = Number(payload.qualifiersPerGroup);
    if (![1, 2].includes(q)) throw new Error('qualifiersPerGroup musi być 1 lub 2');
    data.qualifiersPerGroup = q;
  }
  if (payload.allowByes != null) data.allowByes = !!payload.allowByes;

  if (payload.koSeedingPolicy != null) {
    if (!allowedPolicy.has(payload.koSeedingPolicy)) throw new Error('Nieprawidłowa polityka rozstawiania');
    data.koSeedingPolicy = payload.koSeedingPolicy;
  }
  if (payload.avoidSameGroupInR1 != null) data.avoidSameGroupInR1 = !!payload.avoidSameGroupInR1;

  if (payload.participant_limit !== undefined) {
    data.participant_limit = payload.participant_limit === null ? null : Number(payload.participant_limit);
  }
  if (payload.applicationsOpen !== undefined) {
    data.applicationsOpen = !!payload.applicationsOpen;
  }

  const updated = await prisma.tournament.update({
    where: { id },
    data: { ...data, updated_at: new Date() },
    select: {
      id: true,
      format: true,
      groupSize: true,
      qualifiersPerGroup: true,
      allowByes: true,
      koSeedingPolicy: true,
      avoidSameGroupInR1: true,
      participant_limit: true,
      applicationsOpen: true,
    },
  });

  return updated;
}

/* ========================================================================== */
/*                    Rejestracje + blokada na limicie miejsc                 */
/* ========================================================================== */

async function getTournamentBasic(tournamentId) {
  const t = await prisma.tournament.findUnique({
    where: { id: Number(tournamentId) },
    select: {
      id: true,
      participant_limit: true,
      applicationsOpen: true,
      registration_deadline: true,
    },
  });
  if (!t) throw new Error('Turniej nie istnieje');
  return t;
}

async function countAccepted(tournamentId) {
  const n = await prisma.tournamentregistration.count({
    where: { tournamentId: Number(tournamentId), status: 'accepted' },
  });
  return n;
}

async function assertRegistrationOpenAndCapacity(tid) {
  const t = await prisma.tournament.findUnique({
    where: { id: Number(tid) },
    select: {
      applicationsOpen: true,
      registration_deadline: true,
      participant_limit: true,
      type: true,
    },
  });
  if (!t) throw new Error('Turniej nie istnieje');
  if (t.type === 'invite') {
    throw new Error('Zgłoszenia tylko na zaproszenie');
  }

  // zamknięte zgłoszenia
  if (!t.applicationsOpen) {
    throw new Error('Zgłoszenia zamknięte');
  }

  // deadline do końca dnia
  if (t.registration_deadline) {
    const end = new Date(t.registration_deadline);
    end.setHours(23, 59, 59, 999);
    if (new Date() > end) {
      throw new Error('Termin rejestracji minął');
    }
  }

  // opcjonalnie limit miejsc – liczymy tylko zaakceptowanych
  if (t.participant_limit && Number.isFinite(t.participant_limit)) {
    const taken = await prisma.tournamentregistration.count({
      where: { tournamentId: Number(tid), status: 'accepted' },
    });
    if (taken >= t.participant_limit) {
      throw new Error('Brak miejsc (limit uczestników osiągnięty)');
    }
  }
}

export async function registerForTournament(tournamentId, userId) {
  const tid = Number(tournamentId);
  const uid = Number(userId);

  await assertRegistrationOpenAndCapacity(tid);

  // duplikat
  const exists = await prisma.tournamentregistration.findFirst({
    where: { tournamentId: tid, userId: uid },
  });
  if (exists) throw new Error('Już zgłosiłeś się do tego turnieju');

  // turniej + kategorie (próba #1: z relacji turnieju)
  const tour = await prisma.tournament.findUnique({
    where: { id: tid },
    include: { categories: { select: { gender: true } } },
  });
  if (!tour) throw new Error('Turniej nie istnieje');

  // user
  const user = await prisma.users.findUnique({
    where: { id: uid },
    select: { id: true, gender: true },
  });
  if (!user) throw new Error('Użytkownik nie istnieje');

  // normalizacja
  const norm = (g) => {
    const s = String(g ?? '').trim().toLowerCase();
    if (!s) return null;
    if (['m', 'male', 'man', 'men', 'mężczyzna', 'mężczyźni', 'mezczyzna', 'mezczyzni', 'm.'].includes(s)) return 'male';
    if (['w', 'female', 'woman', 'women', 'kobieta', 'kobiety', 'k', 'f', 'k.'].includes(s)) return 'female';
    if (['coed', 'mixed', 'mix', 'open'].includes(s)) return 'coed';
    return null;
  };

  // policz z tego, co przyszło z include
  let catGenders = Array.isArray(tour.categories) ? tour.categories.map(c => norm(c.gender)).filter(Boolean) : [];

  // Fallback (#2): jeśli z jakiegoś powodu relacja nie zwróciła kategorii, pobierz wprost
  if (catGenders.length === 0) {
    const Cat = prisma.tournamentCategory || prisma.tournamentcategory;
    const cats = await Cat.findMany({
      where: { tournamentId: tid },
      select: { gender: true },
    });
    catGenders = cats.map(c => norm(c.gender)).filter(Boolean);
  }

  const set = new Set(catGenders);
  const hasCoed = set.has('coed');
  const onlySexes = [...set].filter(x => x === 'male' || x === 'female');
  const uniqSex = new Set(onlySexes);
  const required = hasCoed ? null : (uniqSex.size === 1 ? [...uniqSex][0] : null); // 'male'|'female'|null
  const requiredLabel = required === 'male' ? 'mężczyzn' : 'kobiet';

  const ug = norm(user.gender);

  // BRAMKA
  if (required) {
    if (!ug || ug === 'coed') {
      const err = new Error(`Ten turniej jest wyłącznie dla ${requiredLabel}. Uzupełnij płeć w profilu.`);
      err.code = 'GENDER_REQUIRED';
      throw err;
    }
    if (ug !== required) {
      const err = new Error(`Ten turniej jest wyłącznie dla ${requiredLabel}.`);
      err.code = 'GENDER_MISMATCH';
      throw err;
    }
  }

  // create + snapshot (ZNORMALIZOWANY)
  return prisma.tournamentregistration.create({
    data: {
      tournamentId: tid,
      userId: uid,
      status: 'pending',
      gender: ug || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

export async function updateRegistrationStatus(registrationId, status) {
  const reg = await prisma.tournamentregistration.findUnique({
    where: { id: Number(registrationId) },
    select: { id: true, tournamentId: true, status: true },
  });
  if (!reg) throw new Error('Zgłoszenie nie istnieje');

  // przy akceptacji pilnuj limitu
  if (status === 'accepted') {
    await assertRegistrationOpenAndCapacity(reg.tournamentId);
  }

  const updated = await prisma.tournamentregistration.update({
    where: { id: reg.id },
    data: { status, updated_at: new Date() },
  });

  // po akceptacji – jeśli właśnie domknęliśmy limit, zamknij zapisy
  if (status === 'accepted') {
    const t = await getTournamentBasic(reg.tournamentId);
    if (t.participant_limit != null) {
      const accepted = await countAccepted(reg.tournamentId);
      if (accepted >= t.participant_limit && t.applicationsOpen) {
        await prisma.tournament.update({
          where: { id: t.id },
          data: { applicationsOpen: false, updated_at: new Date() },
        });
      }
    }
  }

  return updated;
}

export async function resetGroupPhase(tournamentId, { alsoKO = false } = {}) {
  const tId = Number(tournamentId);
  if (!Number.isFinite(tId)) throw new Error('Nieprawidłowe ID turnieju');

  const all = await prisma.match.findMany({
    where: { tournamentId: tId },
    select: { id: true, round: true }
  });

  const groupIds = all.filter(m => !isKORoundLabel(m.round)).map(m => m.id);
  const koIds = alsoKO ? all.filter(m => isKORoundLabel(m.round)).map(m => m.id) : [];
  const ids = [...groupIds, ...koIds];

  if (ids.length === 0) return { cleared: 0, groups: 0, ko: 0 };

  const tx = [];
  if (prisma.matchSet?.deleteMany) {
    tx.push(prisma.matchSet.deleteMany({ where: { matchId: { in: ids } } }));
  }
  if (prisma.matchLink?.deleteMany) {
    tx.push(prisma.matchLink.deleteMany({
      where: { OR: [{ fromId: { in: ids } }, { toId: { in: ids } }] }
    }));
  }
  tx.push(prisma.match.deleteMany({ where: { id: { in: ids } } }));

  await prisma.$transaction(tx);
  return { cleared: ids.length, groups: groupIds.length, ko: koIds.length };
}


