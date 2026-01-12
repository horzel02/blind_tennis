// server/services/matchService.js
import prisma from '../prismaClient.js';

/* ============================================================================ *
 *  HELPERY & STAŁE
 * ============================================================================ */

// ranking kluczy rund KO
const KEY_RANK = { F: 1, SF: 2, QF: 3, R16: 4, R32: 5, R64: 6, R128: 7 };
function keyToRank(key) { return key ? KEY_RANK[key] ?? null : null; }

function roundToKey(round) {
  if (!round) return null;
  const r = String(round).toLowerCase();
  if (r === 'finał' || r === 'final') return 'F';
  if (r.startsWith('półfina')) return 'SF';
  if (r.startsWith('ćwierćfina')) return 'QF';
  const m = r.match(/1\/(\d+)/);
  if (m) {
    const denom = parseInt(m[1], 10);
    if (denom === 8) return 'R16';
    if (denom === 16) return 'R32';
    if (denom === 32) return 'R64';
    if (denom === 64) return 'R128';
  }
  return null;
}
function roundToRank(round) { return keyToRank(roundToKey(round)); }


function canonicalRoundLabelByKey(key, idx) {
  if (key === 'F') return 'Finał';
  if (key === 'SF') return `Półfinał – Mecz ${idx}`;
  if (key === 'QF') return `Ćwierćfinał – Mecz ${idx}`;
  if (key === 'R16') return `1/8 finału – Mecz ${idx}`;
  if (key === 'R32') return `1/16 finału – Mecz ${idx}`;
  if (key === 'R64') return `1/32 finału – Mecz ${idx}`;
  if (key === 'R128') return `1/64 finału – Mecz ${idx}`;
  return `KO – Mecz ${idx}`;
}

// query dopasowujące różne zapisy danej rundy
function queryForKey(key) {
  if (key === 'F') return { round: { startsWith: 'Finał', mode: 'insensitive' } };
  if (key === 'SF') return { round: { contains: 'półfina', mode: 'insensitive' } };
  if (key === 'QF') return { round: { contains: 'ćwierćfina', mode: 'insensitive' } };
  if (key === 'R16') return { round: { contains: '1/8', mode: 'insensitive' } };
  if (key === 'R32') return { round: { contains: '1/16', mode: 'insensitive' } };
  if (key === 'R64') return { round: { contains: '1/32', mode: 'insensitive' } };
  if (key === 'R128') return { round: { contains: '1/64', mode: 'insensitive' } };
  return { round: { startsWith: 'Finał', mode: 'insensitive' } };
}

// roundOrder 
const ROUND_ORDER_MAP = { R128: 1, R64: 2, R32: 3, R16: 4, QF: 5, SF: 6, F: 7 };
function roundOrderForKey(key) { return ROUND_ORDER_MAP[key] ?? 99; }

function getRegModel() {
  if (prisma.tournamentRegistration?.findMany) return prisma.tournamentRegistration;
  if (prisma.tournamentregistration?.findMany) return prisma.tournamentregistration;
  throw new Error('Model TournamentRegistration nie znaleziony w Prisma Client.');
}
function getCategoryModel() {
  if (prisma.tournamentCategory?.findFirst) return prisma.tournamentCategory;
  if (prisma.tournamentcategory?.findFirst) return prisma.tournamentcategory;
  throw new Error('Model TournamentCategory nie znaleziony w Prisma Client.');
}

const KO_ROUNDS = ['1/64', '1/32', '1/16', '1/8', 'Ćwierćfinał', 'Półfinał', 'Finał'];
const isKnockoutRound = (r = '') => KO_ROUNDS.some(lbl => (r || '').startsWith(lbl));
const roundRank = (r = '') => KO_ROUNDS.findIndex(lbl => (r || '').startsWith(lbl));


function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}


function extractRoundIndex(round) {
  const m = /Mecz\s+(\d+)/i.exec(round || '');
  return m ? parseInt(m[1], 10) : 1;
}
function nextKeyOf(key) {
  if (key === 'R16') return 'QF';
  if (key === 'QF') return 'SF';
  if (key === 'SF') return 'F';
  return null;
}

async function readTournamentSettings(tId) {
  const t = await prisma.tournament.findUnique({
    where: { id: tId },
    select: {
      format: true, groupSize: true, qualifiersPerGroup: true,
      allowByes: true, koSeedingPolicy: true, avoidSameGroupInR1: true,
    },
  });
  return {
    format: t?.format || 'GROUPS_KO',
    groupSize: t?.groupSize ?? 4,
    qualifiersPerGroup: t?.qualifiersPerGroup ?? 2,
    allowByes: t?.allowByes ?? true,
    koSeedingPolicy: t?.koSeedingPolicy || 'RANDOM_CROSS',
    avoidSameGroupInR1: t?.avoidSameGroupInR1 ?? true,
  };
}


function smallestPow2GE(n) { let p = 1; while (p < n) p <<= 1; return p; }


function baseKeyForSize(size) {
  if (size >= 128) return 'R128';
  if (size >= 64) return 'R64';
  if (size >= 32) return 'R32';
  if (size >= 16) return 'R16';
  if (size === 8) return 'QF';
  if (size === 4) return 'SF';
  return 'F';
}
function chainFrom(baseKey) {
  const order = ['R128', 'R64', 'R32', 'R16', 'QF', 'SF', 'F'];
  const i = order.indexOf(baseKey);
  return i >= 0 ? order.slice(i) : ['F'];
}
function pairsCountForKey(key) {
  return key === 'R128' ? 64
    : key === 'R64' ? 32
      : key === 'R32' ? 16
        : key === 'R16' ? 8
          : key === 'QF' ? 4
            : key === 'SF' ? 2
              : 1;
}

// zapewnij placeholdery
async function ensureRoundPlaceholders(tId, roundKey, neededCount, categoryId) {
  const existing = await prisma.match.findMany({
    where: { tournamentId: tId, ...queryForKey(roundKey) },
    orderBy: { id: 'asc' },
    select: { id: true, round: true, player1Id: true, player2Id: true, locked: true, status: true }
  });

  const tx = [];

  for (let i = 0; i < Math.min(neededCount, existing.length); i++) {
    const desired = canonicalRoundLabelByKey(roundKey, roundKey === 'F' ? null : (i + 1));
    if (existing[i].round !== desired) {
      tx.push(prisma.match.update({
        where: { id: existing[i].id },
        data: { round: desired, roundOrder: roundOrderForKey(roundKey) }
      }));
    }
  }

  for (let i = existing.length + 1; i <= neededCount; i++) {
    tx.push(prisma.match.create({
      data: {
        tournamentId: tId,
        tournamentCategoryId: categoryId,
        round: canonicalRoundLabelByKey(roundKey, roundKey === 'F' ? null : i),
        status: 'scheduled',
        stage: 'knockout',
        roundOrder: roundOrderForKey(roundKey),
      }
    }));
  }

  if (tx.length) await prisma.$transaction(tx);

  return prisma.match.findMany({
    where: { tournamentId: tId, ...queryForKey(roundKey) },
    orderBy: [{ round: 'asc' }, { id: 'asc' }],
  });
}

// wipe all
async function wipeTournamentMatches(tId) {
  const existing = await prisma.match.findMany({
    where: { tournamentId: tId },
    select: { id: true },
  });
  const ids = existing.map(m => m.id);
  if (!ids.length) return 0;

  const txs = [];
  if (prisma.matchSet?.deleteMany) {
    txs.push(prisma.matchSet.deleteMany({ where: { matchId: { in: ids } } }));
  }
  if (prisma.matchLink?.deleteMany) {
    txs.push(
      prisma.matchLink.deleteMany({
        where: { OR: [{ fromId: { in: ids } }, { toId: { in: ids } }] },
      })
    );
  }
  txs.push(prisma.match.deleteMany({ where: { id: { in: ids } } }));

  await prisma.$transaction(txs);
  return ids.length;
}

// „Grupa X” → litera X
function parseGroupLetter(round) {
  const m = /^Grupa\s+([A-Z])$/i.exec(round || '');
  return m ? m[1].toUpperCase() : null;
}

// domknij mecz jako BYE (walkower) i przepchnij zwycięzcę dalej
export async function finishByeAndAdvance(tx, match) {

  const winnerId = match.player1Id || match.player2Id;
  if (!winnerId) return match; 

  // zamknij mecz
  const closed = await tx.match.update({
    where: { id: match.id },
    data: {
      status: 'finished',
      winnerId,
      resultType: 'WALKOVER',
      resultNote: 'BYE',
      updatedAt: new Date(),
    },
    include: { tournament: true }
  });

  // awans – 
  const key = (roundToKey(match.round) || '');
  const nextKey = nextKeyOf(key);
  if (!nextKey) return closed;

  // znajdź mój numer w rundzie i docelowy mecz
  const myIdx = extractRoundIndex(match.round); // 1..N
  const pairStart = myIdx % 2 === 1 ? myIdx : myIdx - 1;
  const pairOther = pairStart + 1;

  const from = await tx.match.findMany({
    where: { tournamentId: match.tournamentId, ...queryForKey(key) },
    orderBy: [{ round: 'asc' }, { id: 'asc' }],
    select: { id: true, round: true, winnerId: true }
  });

  const w1 = from[pairStart - 1]?.winnerId || null;
  const w2 = from[pairOther - 1]?.winnerId || null;

  if (w1 && w2) {
    const needed = nextKey === 'QF' ? 4 : nextKey === 'SF' ? 2 : 1;
    const to = await ensureRoundPlaceholders(
      match.tournamentId, nextKey, needed, match.tournamentCategoryId
    );
    const target = to[Math.ceil(myIdx / 2) - 1];
    if (target && !target.locked) {
      await tx.match.update({
        where: { id: target.id },
        data: { player1Id: w1, player2Id: w2, updatedAt: new Date() },
      });
    }
  }

  return closed;
}


/* ============================================================================ *
 *  LISTA / POJEDYNCZY
 * ============================================================================ */

export async function getMatchesByTournamentId(tournamentId, status) {
  const whereClause = { tournamentId: parseInt(tournamentId, 10) };
  const allowed = new Set(['scheduled', 'in_progress', 'finished', 'header']);
  if (status && allowed.has(status)) whereClause.status = status;

  return prisma.match.findMany({
    where: whereClause,
    include: {
      player1: { select: { id: true, name: true, surname: true } },
      player2: { select: { id: true, name: true, surname: true } },
      category: { select: { categoryName: true, gender: true } },
      referee: { select: { id: true, name: true, surname: true } },
      winner: { select: { id: true, name: true, surname: true } },
      matchSets: true,
    },
    orderBy: [{ round: 'asc' }, { id: 'asc' }],
  });
}

export async function getMatchById(matchId) {
  return prisma.match.findUnique({
    where: { id: parseInt(matchId, 10) },
    include: {
      player1: { select: { id: true, name: true, surname: true } },
      player2: { select: { id: true, name: true, surname: true } },
      winner: { select: { id: true, name: true, surname: true } },
      referee: { select: { id: true, name: true, surname: true } },
      category: true,
      tournament: true,
      matchSets: { orderBy: { setNumber: 'asc' } },
    },
  });
}

/* ============================================================================ *
 *  GENERATOR: GRUPY + BAZOWE KO (szkielet)
 * ============================================================================ */

export async function generateKnockoutSkeleton(tournamentId) {
  const tId = parseInt(tournamentId, 10);

  // ustawienia + zaakceptowani
  const t = await prisma.tournament.findUnique({
    where: { id: tId },
    select: { allowByes: true }
  });
  if (!t) throw new Error('Turniej nie istnieje');

  const Reg = getRegModel();
  const Category = getCategoryModel();

  const accepted = await Reg.findMany({
    where: { tournamentId: tId, status: 'accepted' },
    select: { userId: true }
  });
  const entrants = accepted.map(a => a.userId);
  if (entrants.length < 2) {
    throw new Error('Za mało uczestników do stworzenia drabinki KO (min. 2).');
  }

  const cat = await Category.findFirst({
    where: { tournamentId: tId },
    select: { id: true }
  });
  if (!cat) throw new Error('Brak kategorii w turnieju');

  // wyczyść dotychczasowe mecze
  await wipeTournamentMatches(tId);

  // rozmiar drabinki + bazowa runda
  const size = smallestPow2GE(entrants.length);
  if (size !== entrants.length && !t.allowByes) {
    throw new Error('Liczba uczestników nie jest potęgą 2 – włącz BYE w ustawieniach lub zmień limit.');
  }
  const baseKey = baseKeyForSize(size);

  const chain = chainFrom(baseKey);
  for (const key of chain) {
    const cnt = pairsCountForKey(key);
    await ensureRoundPlaceholders(tId, key, cnt, cat.id);
  }

  return { created: pairsCountForKey(baseKey), baseRound: canonicalRoundLabelByKey(baseKey, 1).split(' – ')[0] };
}


export async function generateGroupAndKnockoutMatches(tournamentId) {
  const tId = parseInt(tournamentId, 10);

  const Reg = getRegModel();
  const Category = getCategoryModel();
  const { format, groupSize, qualifiersPerGroup } = await readTournamentSettings(tId);

  // zaakceptowani
  const accepted = await Reg.findMany({
    where: { tournamentId: tId, status: 'accepted' },
    select: { userId: true },
  });
  const playerIds = accepted.map(p => p.userId);

  const category = await Category.findFirst({
    where: { tournamentId: tId },
    select: { id: true },
  });
  if (!category) throw new Error('Brak kategorii w tym turnieju. Utwórz najpierw kategorię.');

  // wyczyść WSZYSTKO
  await wipeTournamentMatches(tId);

  // KO_ONLY → tylko szkielet KO
  if (format === 'KO_ONLY') {
    const entrants = playerIds.length;
    if (entrants < 2) return { count: 0 };

    const bracketSize = smallestPow2GE(entrants);
    const baseKey = baseKeyForSize(bracketSize);

    await ensureRoundPlaceholders(tId, baseKey, bracketSize / 2, category.id);
    return { count: bracketSize / 2 };
  }

  // GROUPS_KO
  if (playerIds.length < groupSize || (playerIds.length % groupSize !== 0)) {
    throw new Error(`Aby utworzyć grupy, liczba graczy musi być wielokrotnością ${groupSize} (min. ${groupSize}).`);
  }

  // grupy
  playerIds.sort(() => Math.random() - 0.5);
  const numberOfGroups = playerIds.length / groupSize;
  const groupName = (idx) => `Grupa ${String.fromCharCode(65 + idx)}`;

  const data = [];

  // FAZA GRUPOWA
  for (let g = 0; g < numberOfGroups; g++) {
    const name = groupName(g);
    data.push({
      tournamentId: tId,
      tournamentCategoryId: category.id,
      player1Id: null,
      player2Id: null,
      round: name,
      status: 'header',
      stage: 'group',
    });

    const ids = playerIds.slice(g * groupSize, (g + 1) * groupSize);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        data.push({
          tournamentId: tId,
          tournamentCategoryId: category.id,
          player1Id: ids[i],
          player2Id: ids[j],
          round: name,
          status: 'scheduled',
          stage: 'group',
        });
      }
    }
  }

  // KO – bazowa runda na podstawie liczby awansujących
  const entrants = numberOfGroups * (qualifiersPerGroup || 2);
  const baseKey = entrants >= 64 ? 'R64'
    : entrants >= 32 ? 'R32'
      : entrants >= 16 ? 'R16'
        : entrants === 8 ? 'QF'
          : entrants === 4 ? 'SF'
            : 'F';
  const baseCount = pairsCountForKey(baseKey);

  for (let i = 1; i <= baseCount; i++) {
    data.push({
      tournamentId: tId,
      tournamentCategoryId: category.id,
      player1Id: null,
      player2Id: null,
      round: canonicalRoundLabelByKey(baseKey, baseKey === 'F' ? null : i),
      status: 'scheduled',
      stage: 'knockout',
      roundOrder: roundOrderForKey(baseKey),
    });
  }

  if (data.length) await prisma.match.createMany({ data });
  return { count: data.length };
}

/* ============================================================================ *
 *  TABELA GRUP
 * ============================================================================ */

export async function getGroupStandings(tournamentId) {
  const tId = parseInt(tournamentId, 10);

  const groupMatches = await prisma.match.findMany({
    where: { tournamentId: tId, stage: 'group', status: 'finished' },
    include: {
      matchSets: true,
      player1: { select: { id: true, name: true, surname: true } },
      player2: { select: { id: true, name: true, surname: true } },
    },
  });

  const scheduledGroupMatches = await prisma.match.findMany({
    where: { tournamentId: tId, stage: 'group', status: { in: ['scheduled', 'in_progress', 'finished', 'header'] } },
    select: { round: true, player1Id: true, player2Id: true },
  });

  const groups = new Map();
  const ensurePlayerRow = (letter, user) => {
    if (!groups.has(letter)) groups.set(letter, new Map());
    const mp = groups.get(letter);
    if (!mp.has(user.id)) {
      mp.set(user.id, {
        userId: user.id, name: user.name, surname: user.surname,
        played: 0, wins: 0, losses: 0,
        setsWon: 0, setsLost: 0,
        gamesWon: 0, gamesLost: 0,
        points: 0,
      });
    }
    return mp.get(user.id);
  };

  // preload zawodników
  for (const m of scheduledGroupMatches) {
    const letter = parseGroupLetter(m.round);
    if (!letter) continue;
    if (m.player1Id) {
      const u = await prisma.users.findUnique({ where: { id: m.player1Id }, select: { id: true, name: true, surname: true } });
      if (u) ensurePlayerRow(letter, u);
    }
    if (m.player2Id) {
      const u = await prisma.users.findUnique({ where: { id: m.player2Id }, select: { id: true, name: true, surname: true } });
      if (u) ensurePlayerRow(letter, u);
    }
  }

  // policz ze skończonych
  for (const m of groupMatches) {
    const letter = parseGroupLetter(m.round);
    if (!letter || !m.player1 || !m.player2) continue;

    const p1 = ensurePlayerRow(letter, m.player1);
    const p2 = ensurePlayerRow(letter, m.player2);

    let sets1 = 0, sets2 = 0, games1 = 0, games2 = 0;
    for (const s of m.matchSets) {
      games1 += s.player1Score || 0;
      games2 += s.player2Score || 0;
      if ((s.player1Score || 0) > (s.player2Score || 0)) sets1++;
      else if ((s.player2Score || 0) > (s.player1Score || 0)) sets2++;
    }

    p1.played++; p2.played++;
    p1.setsWon += sets1; p1.setsLost += sets2; p1.gamesWon += games1; p1.gamesLost += games2;
    p2.setsWon += sets2; p2.setsLost += sets1; p2.gamesWon += games2; p2.gamesLost += games1;

    if (m.winnerId === m.player1.id) { p1.wins++; p2.losses++; }
    else if (m.winnerId === m.player2.id) { p2.wins++; p1.losses++; }
    p1.points = p1.wins;
    p2.points = p2.wins;
  }

  const out = [];
  for (const [letter, mp] of groups) {
    const rows = Array.from(mp.values());
    rows.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const setDiffA = a.setsWon - a.setsLost;
      const setDiffB = b.setsWon - b.setsLost;
      if (setDiffB !== setDiffA) return setDiffB - setDiffA;
      const gameDiffA = a.gamesWon - a.gamesLost;
      const gameDiffB = b.gamesWon - b.gamesLost;
      if (gameDiffB !== gameDiffA) return gameDiffB - gameDiffA;
      return a.userId - b.userId;
    });

    // H2H przy ścisłym remisie 1v1
    for (let i = 0; i + 1 < rows.length; i++) {
      const a = rows[i], b = rows[i + 1];
      if (
        a.points === b.points &&
        (a.setsWon - a.setsLost) === (b.setsWon - b.setsLost) &&
        (a.gamesWon - a.gamesLost) === (b.gamesWon - b.gamesLost)
      ) {
        const h2h = groupMatches.find(m =>
          parseGroupLetter(m.round) === letter &&
          ((m.player1?.id === a.userId && m.player2?.id === b.userId) ||
            (m.player1?.id === b.userId && m.player2?.id === a.userId))
        );
        if (h2h && h2h.winnerId && h2h.winnerId === b.userId) {
          rows[i] = b; rows[i + 1] = a;
        }
      }
    }

    out.push({ group: `Grupa ${letter}`, standings: rows });
  }

  out.sort((g1, g2) => g1.group.localeCompare(g2.group));
  return out;
}

// kwalifikanci
async function computeQualifiersDynamic(tId) {
  const { qualifiersPerGroup = 2 } = await readTournamentSettings(tId);
  const tables = await getGroupStandings(tId);
  const byGroup = {};
  for (const g of tables) {
    const top = g.standings?.slice(0, qualifiersPerGroup) || [];
    byGroup[g.group] = top.map(x => x.userId).filter(Boolean);
  }
  const groups = Object.keys(byGroup).sort();
  const winners = groups.map(g => byGroup[g][0]).filter(Boolean);
  const runners = qualifiersPerGroup >= 2 ? groups.map(g => byGroup[g][1]).filter(Boolean) : [];
  const entrants = winners.length + runners.length;
  return { groups, winners, runners, entrants, qualifiersPerGroup };
}

/* ============================================================================ *
 *  SEED KO (z grup lub KO-only)
 * ============================================================================ */

export async function seedKnockout(tournamentId, opts = {}) {
  const {
    overwrite = false,
    skipLocked = true,
    fromRound = null, // kompat
  } = opts;

  // --- helpers (lokalne) ---
  function seedPositionsFor(size) {
    const maps = {
      2:  [1, 2],
      4:  [1, 4, 3, 2],
      8:  [1, 8, 5, 4, 3, 6, 7, 2],
      16: [1,16, 9, 8, 5,12,13, 4, 3,14,11, 6, 7,10,15, 2],
    };
    const arr = maps[size];
    if (!arr) throw new Error(`Brak mapy seedów dla size=${size}`);
    return arr.map(n => n - 1); // 0-index
  }

  const tId = parseInt(tournamentId, 10);
  const { format, koSeedingPolicy, avoidSameGroupInR1, allowByes } = await readTournamentSettings(tId);

  const Category = prisma.tournamentCategory || prisma.tournamentcategory;
  const cat = await Category.findFirst({ where: { tournamentId: tId }, select: { id: true } });
  if (!cat) throw new Error('Brak kategorii w turnieju');

  const includeFull = {
    player1: { select: { id: true, name: true, surname: true } },
    player2: { select: { id: true, name: true, surname: true } },
    referee: { select: { id: true, name: true, surname: true } },
    winner:  { select: { id: true, name: true, surname: true } },
    category: true,
    matchSets: { orderBy: { setNumber: 'asc' } },
  };

  const setPairIfNeeded = (match, p1, p2) => {
    if (!match) return null;
    if (skipLocked && match.locked) return null;
    const empty = !match.player1Id && !match.player2Id;
    if (!overwrite && !empty) return null;
    return prisma.match.update({
      where: { id: match.id },
      data: {
        player1Id: p1 ?? null,
        player2Id: p2 ?? null,
        updatedAt: new Date(),
        winnerId: null,
        resultType: 'NORMAL',
        resultNote: null,
        matchTime: null,
        courtNumber: null,
        durationMin: null,
      },
      include: includeFull,
    });
  };

  const changed = [];

  // ======================
  // === 1) KO_ONLY   ====
  // ======================
  if (format === 'KO_ONLY') {
    const Reg = getRegModel();
    const regs = await Reg.findMany({
      where: { tournamentId: tId, status: 'accepted' },
      select: { userId: true },
    });
    const entrantsIds = regs.map(r => r.userId);
    if (entrantsIds.length < 2) throw new Error('Za mało uczestników do KO');

    const bracketSize = smallestPow2GE(entrantsIds.length);
    const baseKey = baseKeyForSize(bracketSize);
    const baseMatches = await ensureRoundPlaceholders(tId, baseKey, bracketSize / 2, cat.id);

    // --- ROZSTAWIANIE WG SEEDÓW ---
    const slots = Array(bracketSize).fill(null);
    const positions = seedPositionsFor(bracketSize);
    const shuffled = shuffleInPlace([...entrantsIds]);

    // jeśli BYE dobij do rozmiaru drabinki
    while (shuffled.length < bracketSize) {
      if (!allowByes) throw new Error(`Brakuje ${bracketSize - shuffled.length} uczestników, a BYE są wyłączone.`);
      shuffled.push(null);
    }

    for (let i = 0; i < bracketSize; i++) {
      slots[positions[i]] = shuffled[i] || null;
    }

    // zbuduj pary (0–1, 2–3, ...)
    const pairs = [];
    for (let i = 0; i < bracketSize; i += 2) {
      pairs.push([slots[i], slots[i + 1]]);
    }

    // zapisz pary
    const tx = [];
    for (let i = 0; i < baseMatches.length; i++) {
      tx.push(setPairIfNeeded(baseMatches[i], pairs[i][0], pairs[i][1]));
    }
    const updates = await prisma.$transaction(tx.filter(Boolean));
    changed.push(...updates);

    // auto-finish BYE + kaskada
    if (allowByes) {
      for (let i = 0; i < baseMatches.length; i++) {
        const m = await prisma.match.findUnique({ where: { id: baseMatches[i].id } });
        const a = m.player1Id, b = m.player2Id;
        if ((a && !b) || (!a && b)) {
          await finishByeAndAdvance(prisma, m); // Twoja istniejąca funkcja (tx albo prisma)
        }
      }
    }

    // kaskady (bez zmian)
    async function cascade(fromKey, toKey, pairsIdx) {
      const from = await prisma.match.findMany({
        where: { tournamentId: tId, ...queryForKey(fromKey) },
        orderBy: [{ round: 'asc' }, { id: 'asc' }],
        select: { id: true, winnerId: true, locked: true, player1Id: true, player2Id: true }
      });
      const to = await ensureRoundPlaceholders(tId, toKey, toKey === 'QF' ? 4 : toKey === 'SF' ? 2 : 1, cat.id);

      const tx2 = [];
      for (let i = 0; i < pairsIdx.length; i++) {
        const [a, b] = pairsIdx[i];
        const w1 = from[a - 1]?.winnerId || null;
        const w2 = from[b - 1]?.winnerId || null;
        if (!w1 || !w2) continue;

        const target = to[i];
        if (!target) continue;
        if (skipLocked && target.locked) continue;
        const empty = !target.player1Id && !target.player2Id;
        if (!overwrite && !empty) continue;

        tx2.push(prisma.match.update({
          where: { id: target.id },
          data: { player1Id: w1, player2Id: w2, updatedAt: new Date() },
          include: includeFull,
        }));
      }
      const ups = await prisma.$transaction(tx2);
      changed.push(...ups);
    }

    if (baseKey === 'R16') {
      await cascade('R16', 'QF', [[1,2],[3,4],[5,6],[7,8]]);
      await cascade('QF', 'SF', [[1,2],[3,4]]);
      await cascade('SF', 'F',  [[1,2]]);
    } else if (baseKey === 'R32') {
      await cascade('R32','R16',[[1,2],[3,4],[5,6],[7,8],[9,10],[11,12],[13,14],[15,16]]);
      await cascade('R16','QF', [[1,2],[3,4],[5,6],[7,8]]);
      await cascade('QF','SF',  [[1,2],[3,4]]);
      await cascade('SF','F',   [[1,2]]);
    } else if (baseKey === 'QF') {
      await cascade('QF','SF',  [[1,2],[3,4]]);
      await cascade('SF','F',   [[1,2]]);
    } else if (baseKey === 'SF') {
      await cascade('SF','F',   [[1,2]]);
    }

    return { updated: changed.length, baseRound: canonicalRoundLabelByKey(baseKey, 1).split(' – ')[0] };
  }

  // =========================
  // === 2) GROUPS_KO     ===
  // =========================
  const groups = await getGroupStandings(tId);
  if (!groups?.length) throw new Error('Brak danych fazy grupowej');

  const { winners: firsts, runners: seconds, entrants, qualifiersPerGroup } = await computeQualifiersDynamic(tId);

  const bracketSize = smallestPow2GE(entrants);
  if (bracketSize !== entrants && !allowByes) {
    throw new Error(`Liczba awansujących (${entrants}) nie jest potęgą 2, a BYE są wyłączone w ustawieniach.`);
  }
  const baseKey = baseKeyForSize(bracketSize);
  const needed  = pairsCountForKey(baseKey);
  const baseMatches = await ensureRoundPlaceholders(tId, baseKey, needed, cat.id);

  // 2a) standardowa budowa par gdy brak BYE
  function randomCrossPairs() {
    const W = firsts.map((id, idx) => ({ id, g: idx })).filter(x => x.id);
    const R = seconds.map((id, idx) => ({ id, g: idx })).filter(x => x.id);
    shuffleInPlace(W);
    shuffleInPlace(R);

    const pairs = [];
    for (const w of W) {
      let pick = R.findIndex(r => !avoidSameGroupInR1 || r.g !== w.g);
      if (pick === -1) pick = 0;
      const r = R.splice(pick, 1)[0] || { id: null };
      pairs.push([w.id, r.id]);
    }
    return pairs;
  }
  function randomPairsSingleList(ids) {
    const X = shuffleInPlace(ids.filter(Boolean));
    const pairs = [];
    for (let i = 0; i < X.length; i += 2) {
      pairs.push([X[i] || null, X[i + 1] || null]);
    }
    return pairs;
  }

  let pairs;

  // 2b) jeśli mamy BYE  seedowanie do slotów
  if (bracketSize > entrants) {
    const idsOrdered = [...firsts.filter(Boolean), ...seconds.filter(Boolean)];
    const slots = Array(bracketSize).fill(null);
    const positions = seedPositionsFor(bracketSize);
    for (let i = 0; i < bracketSize; i++) {
      slots[positions[i]] = idsOrdered[i] || null;
    }
    pairs = [];
    for (let i = 0; i < bracketSize; i += 2) {
      pairs.push([slots[i], slots[i + 1]]);
    }
  } else {
    // brak BYE 
    if (koSeedingPolicy === 'STRUCTURED' && qualifiersPerGroup >= 2) {
      if (baseKey === 'R16' || baseKey === 'QF') {
        const [A1,B1,C1,D1,E1,F1,G1,H1] = firsts;
        const [A2,B2,C2,D2,E2,F2,G2,H2] = seconds;
        pairs = baseKey === 'R16'
          ? [[A1,H2],[E1,D2],[C1,F2],[G1,B2],[B1,G2],[F1,C2],[D1,E2],[H1,A2]]
          : [[A1,H2],[B1,G2],[C1,F2],[D1,E2]];
      } else if (baseKey === 'SF') {
        const [A1,B1] = firsts; const [A2,B2] = seconds;
        pairs = [[A1,B2],[B1,A2]];
      } else { // F
        pairs = [[firsts[0] || null, seconds[0] || null]];
      }
    } else {
      pairs = qualifiersPerGroup >= 2 ? randomCrossPairs() : randomPairsSingleList(firsts);
    }
  }

  // zapis par
  const tx = [];
  for (let i = 0; i < needed; i++) {
    const [p1, p2] = pairs[i] || [null, null];
    tx.push(setPairIfNeeded(baseMatches[i], p1, p2));
  }
  const updates = await prisma.$transaction(tx.filter(Boolean));
  changed.push(...updates);

  if (allowByes) {
    await prisma.$transaction(async (txi) => {
      const fullBase = await txi.match.findMany({
        where: { tournamentId: tId, ...queryForKey(baseKey) },
        orderBy: [{ round: 'asc' }, { id: 'asc' }],
        select: { id: true, round: true, tournamentId: true, tournamentCategoryId: true, player1Id: true, player2Id: true, status: true }
      });
      for (const m of fullBase) {
        const a = m.player1Id, b = m.player2Id;
        if ((a && !b) || (!a && b)) {
          await finishByeAndAdvance(txi, m);
        }
      }
    });
  }

  async function cascade(fromKey, toKey, pairsIdx) {
    const from = await prisma.match.findMany({
      where: { tournamentId: tId, ...queryForKey(fromKey) },
      orderBy: [{ round: 'asc' }, { id: 'asc' }],
      select: { id: true, winnerId: true }
    });
    const to = await ensureRoundPlaceholders(tId, toKey, toKey === 'QF' ? 4 : toKey === 'SF' ? 2 : 1, cat.id);

    const tx2 = [];
    for (let i = 0; i < pairsIdx.length; i++) {
      const [a, b] = pairsIdx[i];
      const w1 = from[a - 1]?.winnerId || null;
      const w2 = from[b - 1]?.winnerId || null;
      if (!w1 || !w2) continue;

      const target = to[i];
      if (!target) continue;
      if (skipLocked && target.locked) continue;
      const empty = !target.player1Id && !target.player2Id;
      if (!overwrite && !empty) continue;

      tx2.push(prisma.match.update({
        where: { id: target.id },
        data: { player1Id: w1, player2Id: w2, updatedAt: new Date() },
        include: includeFull,
      }));
    }
    const ups = await prisma.$transaction(tx2);
    changed.push(...ups);
  }

  if (baseKey === 'R16') {
    await cascade('R16', 'QF', [[1,2],[3,4],[5,6],[7,8]]);
    await cascade('QF', 'SF', [[1,2],[3,4]]);
    await cascade('SF', 'F',  [[1,2]]);
  } else if (baseKey === 'R32') {
    await cascade('R32','R16',[[1,2],[3,4],[5,6],[7,8],[9,10],[11,12],[13,14],[15,16]]);
    await cascade('R16','QF', [[1,2],[3,4],[5,6],[7,8]]);
    await cascade('QF','SF',  [[1,2],[3,4]]);
    await cascade('SF','F',   [[1,2]]);
  } else if (baseKey === 'QF') {
    await cascade('QF','SF',  [[1,2],[3,4]]);
    await cascade('SF','F',   [[1,2]]);
  } else if (baseKey === 'SF') {
    await cascade('SF','F',   [[1,2]]);
  }

  return { updated: changed.length, baseRound: canonicalRoundLabelByKey(baseKey, 1).split(' – ')[0] };
}

/* ============================================================================ *
 *  RESET KO OD RUNDY
 * ============================================================================ */

export async function resetKnockoutFromRound(tournamentId, fromLabel) {
  const tId = parseInt(tournamentId, 10);

  // sprawdź format – dla KO_ONLY będziemy fizycznie usuwać mecze
  const { format } = await readTournamentSettings(tId);

  const base = normalizeRoundLabel(fromLabel);
  if (!base) throw new Error('Nieznana runda: ' + JSON.stringify(fromLabel));

  const key = roundToKey(base);
  const threshold = keyToRank(key);
  if (!threshold) throw new Error('Nieznany etap (fromRound): ' + base);

  // bierzemy tylko rundy KO od wskazanej do finału
  const all = await prisma.match.findMany({
    where: { tournamentId: tId },
    select: { id: true, round: true, status: true }
  });

  const toAffect = all.filter(m => {
    const rk = roundToRank(m.round);
    return rk !== null && rk <= threshold;
  });

  if (!toAffect.length) return { cleared: 0, from: fromLabel };

  const ids = toAffect.map(m => m.id);

  if (format === 'KO_ONLY') {
    const tx = [];
    if (prisma.matchSet?.deleteMany) {
      tx.push(prisma.matchSet.deleteMany({ where: { matchId: { in: ids } } }));
    }
    if (prisma.matchLink?.deleteMany) {
      tx.push(
        prisma.matchLink.deleteMany({
          where: { OR: [{ fromId: { in: ids } }, { toId: { in: ids } }] },
        })
      );
    }
    tx.push(prisma.match.deleteMany({ where: { id: { in: ids } } }));
    await prisma.$transaction(tx);

    return { cleared: ids.length, deleted: ids.length, mode: 'KO_ONLY', from: fromLabel };
  }

  await prisma.$transaction([
    prisma.matchSet.deleteMany({ where: { matchId: { in: ids } } }),
    prisma.match.updateMany({
      where: { id: { in: ids } },
      data: {
        player1Id: null,
        player2Id: null,
        winnerId: null,
        status: 'scheduled',
        matchTime: null,
        courtNumber: null,
        durationMin: null,
        updatedAt: new Date()
      }
    })
  ]);

  return { cleared: ids.length, mode: 'GROUPS_KO', from: fromLabel };
}

/* ============================================================================ *
 *  WYNIK / SĘDZIA / LOCK
 * ============================================================================ */

export async function updateMatchScore(matchId, { status, winnerId, matchSets }) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const match = await tx.match.findUnique({
        where: { id: parseInt(matchId, 10) },
        select: {
          id: true, tournamentId: true, tournamentCategoryId: true,
          round: true, status: true,
        }
      });
      if (!match) throw new Error('Match not found');

      // nadpisanie setów
      await tx.matchSet.deleteMany({ where: { matchId: match.id } });
      if (Array.isArray(matchSets) && matchSets.length) {
        await tx.matchSet.createMany({
          data: matchSets.map((set, i) => ({
            matchId: match.id,
            setNumber: i + 1,
            player1Score: set.player1Score,
            player2Score: set.player2Score,
          })),
        });
      }

      // update meczu (status + zwycięzca)
      const updated = await tx.match.update({
        where: { id: match.id },
        data: { status, winnerId, updatedAt: new Date() },
        include: {
          matchSets: true,
          player1: { select: { id: true, name: true, surname: true } },
          player2: { select: { id: true, name: true, surname: true } },
          winner: { select: { id: true, name: true, surname: true } },
        },
      });

      // --- awans do kolejnej rundy ---
      const key = (roundToKey(match.round) || '');
      const nextKey = nextKeyOf(key);
      if (nextKey) {
        const myIdx = extractRoundIndex(match.round); // 1..N
        const pairStart = myIdx % 2 === 1 ? myIdx : myIdx - 1;
        const pairOther = pairStart + 1;

        const from = await tx.match.findMany({
          where: { tournamentId: match.tournamentId, ...queryForKey(key) },
          orderBy: [{ round: 'asc' }, { id: 'asc' }],
          select: { id: true, round: true, winnerId: true }
        });

        const w1 = from[pairStart - 1]?.winnerId || null;
        const w2 = from[pairOther - 1]?.winnerId || null;

        if (w1 && w2) {
          const needed = nextKey === 'QF' ? 4 : nextKey === 'SF' ? 2 : 1;
          const to = await ensureRoundPlaceholders(
            match.tournamentId, nextKey, needed, match.tournamentCategoryId
          );

          const target = to[Math.ceil(myIdx / 2) - 1];
          if (target && !target.locked) {
            await tx.match.update({
              where: { id: target.id },
              data: { player1Id: w1, player2Id: w2, updatedAt: new Date() },
            });
          }
        }
      }
      try {
        const keyNow = (roundToKey(match.round) || '');
        if (keyNow === 'SF') {
          const inSameTour = {
            tournamentId: match.tournamentId,
            ...(match.tournamentCategoryId ? { tournamentCategoryId: match.tournamentCategoryId } : {}),
          };

          const sfsAll = await tx.match.findMany({
            where: inSameTour,
            select: { id: true, round: true, player1Id: true, player2Id: true, winnerId: true, status: true }
          });
          const sfList = sfsAll.filter(m => (roundToKey(m.round) || '') === 'SF');

          if (sfList.length >= 2 && sfList.every(m => m.winnerId)) {
            const losers = sfList
              .map(sf => (sf.winnerId === sf.player1Id ? sf.player2Id : sf.player1Id))
              .filter(Boolean);

            if (losers.length === 2) {
              let bronze = await tx.match.findFirst({
                where: {
                  ...inSameTour,
                  OR: [{ round: 'Mecz o 3. miejsce' }, { round: '3rd place' }],
                },
                select: { id: true, player1Id: true, player2Id: true, status: true }
              });

              if (!bronze) {
                await tx.match.create({
                  data: {
                    ...inSameTour,
                    round: 'Mecz o 3. miejsce',
                    player1Id: losers[0],
                    player2Id: losers[1],
                    status: 'scheduled',
                  }
                });
              } else {
                await tx.match.update({
                  where: { id: bronze.id },
                  data: {
                    player1Id: losers[0],
                    player2Id: losers[1],
                    status: 'scheduled',
                    winnerId: null,
                    resultType: 'NORMAL',
                    resultNote: null,
                    matchTime: null,
                    courtNumber: null,
                    durationMin: null,
                    updatedAt: new Date(),
                  }
                });
              }
            }
          }
        }
      } catch (e) {
        console.warn('BRONZE build warning:', e?.message || e);
      }


      return updated;
    });

    return result;
  } catch (error) {
    console.error('Error updating match score:', error);
    throw error;
  }
}


export async function setMatchReferee(matchId, refereeId) {
  const id = parseInt(matchId, 10);
  const refId = refereeId !== null && refereeId !== undefined ? parseInt(refereeId, 10) : null;

  if (refId) {
    const exists = await prisma.users.findUnique({ where: { id: refId }, select: { id: true } });
    if (!exists) throw new Error('Użytkownik (sędzia) nie istnieje');
  }

  return prisma.match.update({
    where: { id },
    data: { refereeId: refId, updatedAt: new Date() },
    include: {
      player1: { select: { id: true, name: true, surname: true } },
      player2: { select: { id: true, name: true, surname: true } },
      referee: { select: { id: true, name: true, surname: true } },
      winner: { select: { id: true, name: true, surname: true } },
      category: true,
      matchSets: { orderBy: { setNumber: 'asc' } },
    },
  });
}

export async function setLocked(matchId, locked) {
  const id = parseInt(matchId, 10);
  const m = await prisma.match.findUnique({ where: { id } });
  if (!m) throw new Error('Mecz nie istnieje');

  return prisma.match.update({
    where: { id },
    data: { locked: !!locked, updatedAt: new Date() },
    include: {
      player1: { select: { id: true, name: true, surname: true } },
      player2: { select: { id: true, name: true, surname: true } },
      referee: { select: { id: true, name: true, surname: true } },
      winner: { select: { id: true, name: true, surname: true } },
      category: true,
      matchSets: { orderBy: { setNumber: 'asc' } },
    },
  });
}

/* ============================================================================ *
 *  DOPUSZCZENI DO MECZU / RĘCZNE PAROWANIE
 * ============================================================================ */

export async function getEligiblePlayersForMatch(matchId) {
  const id = parseInt(matchId, 10);
  const m = await prisma.match.findUnique({
    where: { id },
    select: { id: true, tournamentId: true, round: true },
  });
  if (!m) throw new Error('Mecz nie istnieje');

  const tId = m.tournamentId;
  const r = m.round || '';

  // Grupy  wszyscy zaakceptowani
  if (!isKnockoutRound(r)) {
    const Reg = getRegModel();
    const regs = await Reg.findMany({
      where: { tournamentId: tId, status: 'accepted' },
      include: { user: { select: { id: true, name: true, surname: true, email: true } } },
    });
    return regs.map(r => r.user);
  }

  // === KO ===

  // 1) Jeśli to nie pierwsza runda – zwycięzcy poprzedniej
  const myIdx = roundRank(r);
  const prevIdx = myIdx + 1;
  const prevLbl = KO_ROUNDS[prevIdx];

  if (prevLbl) {
    const prev = await prisma.match.findMany({
      where: { tournamentId: tId, round: { startsWith: prevLbl }, status: 'finished' },
      select: { winnerId: true },
    });
    const ids = [...new Set(prev.map(x => x.winnerId).filter(Boolean))];
    if (ids.length) {
      return prisma.users.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, surname: true, email: true },
      });
    }
  }

  // 2) Pierwsza runda KO → TOP K z grup (winners + runners)
  const { qualifiersPerGroup } = await readTournamentSettings(tId);
  const { winners, runners } = await computeQualifiersDynamic(tId);
  const qualifiers = qualifiersPerGroup >= 2 ? [...winners, ...runners] : [...winners];

  if (qualifiers.length) {
    const users = await prisma.users.findMany({
      where: { id: { in: qualifiers } },
      select: { id: true, name: true, surname: true, email: true },
    });
    const map = new Map(users.map(u => [u.id, u]));
    const ordered = qualifiers.map(i => map.get(i)).filter(Boolean);
    if (ordered.length) return ordered;
  }

  // 3) Fallback dla pustej drabinki: zaakceptowani uczestnicy 
  const sameRound = await prisma.match.findMany({
    where: { tournamentId: tId, round: { startsWith: r } },
    select: { player1Id: true, player2Id: true },
  });
  const used = new Set(
    sameRound.flatMap(mm => [mm.player1Id, mm.player2Id]).filter(Boolean)
  );

  const Reg = getRegModel();
  const regs = await Reg.findMany({
    where: { tournamentId: tId, status: 'accepted' },
    include: { user: { select: { id: true, name: true, surname: true, email: true } } },
  });

  return regs
    .map(r => r.user)
    .filter(u => u && !used.has(u.id));
}

function baseRoundName(label = '') {
  const s = String(label).toLowerCase();
  if (s.includes('1/64')) return '1/64 finału';
  if (s.includes('1/32')) return '1/32 finału';
  if (s.includes('1/16')) return '1/16 finału';
  if (s.includes('1/8')) return '1/8 finału';
  if (s.includes('ćwierćfina')) return 'Ćwierćfinał';
  if (s.includes('półfina')) return 'Półfinał';
  if (s.includes('finał')) return 'Finał';
  return null;
}


export async function setPairing(matchId, { player1Id, player2Id }) {
  const id = Number(matchId);
  const match = await prisma.match.findUnique({
    where: { id },
    include: { player1: true, player2: true },
  });
  if (!match) throw new Error('Mecz nie istnieje');

  const nextP1 = (player1Id === undefined) ? match.player1Id : player1Id;
  const nextP2 = (player2Id === undefined) ? match.player2Id : player2Id;

  const eligible = await getEligiblePlayersForMatch(id);
  const eligibleIds = new Set(eligible.map(u => u.id));

  const isAllowedHere = (pid) =>
    pid == null ||
    eligibleIds.has(pid) ||
    pid === match.player1Id ||
    pid === match.player2Id;

  if (!isAllowedHere(nextP1) || !isAllowedHere(nextP2)) {
    throw new Error('Zawodnik nie jest dopuszczony do tej rundy');
  }

  const base = baseRoundName(match.round || '') || '';
  if (nextP1 || nextP2) {
    const conflict = await prisma.match.findFirst({
      where: {
        tournamentId: match.tournamentId,
        id: { not: id },
        round: { startsWith: base },
        OR: [
          nextP1 ? { OR: [{ player1Id: nextP1 }, { player2Id: nextP1 }] } : undefined,
          nextP2 ? { OR: [{ player1Id: nextP2 }, { player2Id: nextP2 }] } : undefined,
        ].filter(Boolean),
      },
      select: { id: true },
    });
    if (conflict) {
      throw new Error('Ten zawodnik jest już w innym meczu tej rundy');
    }
  }

  const updated = await prisma.match.update({
    where: { id },
    data: {
      player1Id: nextP1 ?? null,
      player2Id: nextP2 ?? null,
    },
    include: {
      player1: true, player2: true, referee: true, category: true,
      matchSets: true, winner: true
    },
  });


  return updated;
}

/* ============================================================================ *
 *  NORMALIZACJA ETYKIET RUND (API)
 * ============================================================================ */

export function normalizeRoundLabel(input) {
  let s = input;
  if (typeof s === 'object' && s !== null) {
    s = s.from ?? s.label ?? s.value ?? s.round ?? '';
  }
  s = String(s || '').trim().toLowerCase();

  if (!s) return null;

  if (s === 'f' || s === 'final' || s.startsWith('finał')) return 'Finał';
  if (s === 'sf' || s.includes('1/2') || s.startsWith('pół')) return 'Półfinał';
  if (s === 'qf' || s.includes('1/4') || s.startsWith('ćwierć')) return 'Ćwierćfinał';
  if (s === 'r16' || /^1\/8\b/.test(s)) return '1/8 finału';
  if (s === 'r32' || /^1\/16\b/.test(s)) return '1/16 finału';
  if (s === 'r64' || /^1\/32\b/.test(s)) return '1/32 finału';
  if (s === 'r128' || /^1\/64\b/.test(s)) return '1/64 finału';

  return null;
}

/* ============================================================================ *
 *  GENERATOR: KO ONLY (pełna drabinka + pary R1)
 * ============================================================================ */

export async function generateKnockoutOnly(tournamentId) {
  const tId = parseInt(tournamentId, 10);

  // 1) ustawienia + zaakceptowani
  const t = await prisma.tournament.findUnique({
    where: { id: tId },
    select: { allowByes: true }
  });
  if (!t) throw new Error('Turniej nie istnieje');

  const Reg = getRegModel();
  const Category = getCategoryModel();

  const accepted = await Reg.findMany({
    where: { tournamentId: tId, status: 'accepted' },
    select: { userId: true }
  });
  const entrants = accepted.map(a => a.userId);
  if (entrants.length < 2) {
    throw new Error('Za mało uczestników do stworzenia drabinki KO (min. 2).');
  }

  const cat = await Category.findFirst({
    where: { tournamentId: tId },
    select: { id: true }
  });
  if (!cat) throw new Error('Brak kategorii w turnieju');

  // 2) wyczyść dotychczasowe mecze
  await wipeTournamentMatches(tId);

  // 3) rozmiar drabinki + bazowa runda
  const size = smallestPow2GE(entrants.length);
  if (size !== entrants.length && !t.allowByes) {
    throw new Error('Liczba uczestników nie jest potęgą 2 – włącz BYE w ustawieniach lub zmień limit.');
  }
  const baseKey = baseKeyForSize(size);

  // 4) placeholdery wszystkich potrzebnych rund (od bazowej do finału)
  const chain = chainFrom(baseKey);
  let createdBase = null;
  for (const key of chain) {
    const cnt = pairsCountForKey(key);
    const out = await ensureRoundPlaceholders(tId, key, cnt, cat.id);
    if (!createdBase && key === baseKey) createdBase = out;
  }

  // 5) rozstaw losowo pierwszą rundę (dopaduj BYE = null)
  const pool = shuffleInPlace([...entrants]);
  while (pool.length < size) pool.push(null);

  const includeFull = {
    player1: { select: { id: true, name: true, surname: true } },
    player2: { select: { id: true, name: true, surname: true } },
    referee: { select: { id: true, name: true, surname: true } },
    winner: { select: { id: true, name: true, surname: true } },
    category: true,
    matchSets: { orderBy: { setNumber: 'asc' } },
  };

  const baseCount = pairsCountForKey(baseKey);
  const tx = [];
  for (let i = 0; i < baseCount; i++) {
    const p1 = pool[2 * i] ?? null;
    const p2 = pool[2 * i + 1] ?? null;
    tx.push(prisma.match.update({
      where: { id: createdBase[i].id },
      data: { player1Id: p1, player2Id: p2, status: 'scheduled', updatedAt: new Date() },
      include: includeFull
    }));
  }
  const seeded = await prisma.$transaction(tx);

  return { created: seeded.length, baseRound: canonicalRoundLabelByKey(baseKey, 1).split(' – ')[0] };
}
