// server/controllers/matchScheduleController.js
import prisma from '../prismaClient.js';

/** helper: czy user jest organizatorem tego turnieju (twórca albo zaproszony organizer) */
async function assertMatchOrganizer(req, matchId) {
    const uid = req.user.id;
    const m = await prisma.match.findUnique({
        where: { id: Number(matchId) },
        select: { id: true, tournamentId: true, tournament: { select: { organizer_id: true } } }
    });
    if (!m) {
        const err = new Error('Mecz nie istnieje'); err.status = 404; throw err;
    }
    if (m.tournament.organizer_id === uid) return m.tournamentId;

    const role = await prisma.tournamentuserrole.findFirst({
        where: { tournamentId: m.tournamentId, userId: uid, role: 'organizer' }
    });
    if (!role) {
        const err = new Error('Brak uprawnień (organizator)'); err.status = 403; throw err;
    }
    return m.tournamentId;
}

/** Ustaw termin/court/duration dla pojedynczego meczu */
export async function setMatchSchedule(req, res) {
    try {
        const matchId = Number(req.params.matchId);
        const tournamentId = await assertMatchOrganizer(req, matchId);

        // akceptujemy: { scheduledAt, court, durationMin } (PLAN)
        // oraz legacy: { matchTime, courtNumber, durationMin }
        const body = req.body || {};
        const scheduledAt = body.scheduledAt || body.matchTime;
        const court = body.court ?? body.courtNumber ?? null;
        const durationMin = Number(body.durationMin ?? 45) || 45;

        if (!scheduledAt) return res.status(400).json({ error: 'Brak scheduledAt/matchTime' });

        // zapisujemy bez sekund (zaokrąglij do minut)
        const dtRaw = new Date(scheduledAt);
        if (Number.isNaN(dtRaw.getTime())) return res.status(400).json({ error: 'Nieprawidłowa data/czas' });
        const dt = new Date(dtRaw); dt.setSeconds(0, 0);

        const updated = await prisma.match.update({
            where: { id: matchId },
            data: {
                // DB w Twoim schemacie: matchTime (DateTime?), courtNumber (String?), durationMin (Int?)
                matchTime: dt,
                courtNumber: (court == null || court === '') ? null : String(court),
                durationMin,
                updatedAt: new Date(),
            },
            include: {
                player1: true, player2: true, winner: true,
                matchSets: { orderBy: { setNumber: 'asc' } },
                referee: true, tournament: true
            }
        });

        const io = req.app.get('socketio') || req.app.get('io');
        if (io) {
            io.to(`match-${matchId}`).emit('match-updated', updated);
            io.to(`tournament-${tournamentId}`).emit('match-updated', updated);
        }

        return res.json(updated);
    } catch (e) {
        console.error('[setMatchSchedule]', e);
        res.status(e.status || 500).json({ error: e.message || 'Błąd ustawiania terminu meczu' });
    }
}


/** Wyczyść termin/court/duration dla pojedynczego meczu */
export async function clearMatchSchedule(req, res) {
    try {
        const matchId = Number(req.params.matchId);
        const tournamentId = await assertMatchOrganizer(req, matchId);

        const updated = await prisma.match.update({
            where: { id: matchId },
            data: { matchTime: null, courtNumber: null, durationMin: null, updatedAt: new Date() },
            include: {
                player1: true, player2: true, winner: true,
                matchSets: { orderBy: { setNumber: 'asc' } },
                referee: true, tournament: true
            }
        });

        const io = req.app.get('socketio') || req.app.get('io');
        if (io) {
            io.to(`match-${matchId}`).emit('match-updated', updated);
            io.to(`tournament-${tournamentId}`).emit('match-updated', updated);
        }

        return res.json(updated);
    } catch (e) {
        console.error('[clearMatchSchedule]', e);
        res.status(e.status || 500).json({ error: e.message || 'Błąd czyszczenia terminu meczu' });
    }
}

export async function autoScheduleTournament(req, res) {
    try {
        const tournamentId = Number(req.params.id);

        const tour = await prisma.tournament.findUnique({
            where: { id: tournamentId },
            select: { id: true, organizer_id: true }
        });
        if (!tour) return res.status(404).json({ error: 'Turniej nie istnieje' });
        if (tour.organizer_id !== req.user.id) {
            const role = await prisma.tournamentuserrole.findFirst({
                where: { tournamentId, userId: req.user.id, role: 'organizer' }
            });
            if (!role) return res.status(403).json({ error: 'Brak uprawnień (organizator)' });
        }

        const {
            startDay,
            dayStart = '09:00',
            dayEnd = '20:00',
            courts = 2,
            referees = 99,
            durationMin = 45,
            includeGroups = true,
            includeKO = true,
            onlyKO = false,
            placeBronzeBeforeFinal = false,
            overwriteExisting = false
        } = req.body || {};

        if (!startDay) return res.status(400).json({ error: 'Podaj startDay (YYYY-MM-DD)' });

        // helpers
        const toTime = (hhmm) => {
            const [h, m] = String(hhmm).split(':').map(Number);
            return { h: h || 0, m: m || 0 };
        };
        const { h: sH, m: sM } = toTime(dayStart);
        const { h: eH, m: eM } = toTime(dayEnd);
        const courtsN = Math.max(1, Number(courts) || 1);
        const refsN = Math.max(1, Number(referees) || 1);
        const cap = Math.min(courtsN, refsN);
        const slotMin = Math.max(15, Number(durationMin) || 45);

        const day0 = new Date(`${startDay}T00:00:00.000Z`);
        const mkDT = (dayOffset, H, M) => {
            const d = new Date(day0);
            d.setUTCDate(d.getUTCDate() + dayOffset);
            d.setUTCHours(H, M, 0, 0);
            return d;
        };

        // pobierz mecze, z możliwością pominięcia tych z już ustawionym terminem
        let matches = await prisma.match.findMany({
            where: {
                tournamentId,
                OR: [
                    { winnerId: null },
                    { status: { in: ['scheduled', 'in_progress', 'pending'] } }
                ]
            },
            include: { player1: true, player2: true }
        });

        // po findMany:
        if (!overwriteExisting) {
            matches = matches.filter(m => !m.matchTime);
        }


        // wywal zakończone i BYE (jeden zawodnik null)
        matches = matches.filter(m => !m.winnerId && m.player1Id && m.player2Id);
        if (!overwriteExisting) {
            matches = matches.filter(m => !m.matchTime);
        }

        // klasyfikacja meczów
        const isGroup = (m) =>
            /grupa/i.test(m.round || '') || (m.stage === 'GROUP');
        const isKO = (m) => {
            const r = (m.round || '').toLowerCase();
            return /(1\/(8|16|32|64)|ćwierćfinał|półfinał|finał)/i.test(r) || /3\.?\s*miejsce|mecz o 3/i.test(r) || (m.stage === 'KO');
        };

        // KO ranking: im niższy, tym wcześniej planujemy
        const koRank = (label = '') => {
            const r = (label || '').toLowerCase();
            if (r.includes('1/64')) return 0;
            if (r.includes('1/32')) return 1;
            if (r.includes('1/16')) return 2;
            if (r.includes('1/8')) return 3;
            if (r.includes('ćwierćfina')) return 4;
            if (r.includes('półfina')) return 5;
            if (/3\.?\s*miejsce|mecz o 3/.test(r)) return placeBronzeBeforeFinal ? 6 : 7;
            if (r.includes('finał')) return placeBronzeBeforeFinal ? 7 : 6;
            return 99;
        };

        // buduj kolejkę
        const queue = [];

        if (!onlyKO && includeGroups) {
            // grupy „falami”
            const groups = new Map();
            for (const m of matches) {
                if (isGroup(m)) {
                    const g = /grupa\s*([a-z])/i.exec(m.round || '');
                    const key = g ? g[1].toUpperCase() : 'X';
                    if (!groups.has(key)) groups.set(key, []);
                    groups.get(key).push(m);
                }
            }
            const keys = Array.from(groups.keys()).sort();
            // rozkład falowy
            let added = true;
            while (added) {
                added = false;
                for (const k of keys) {
                    const arr = groups.get(k);
                    if (arr && arr.length) {
                        queue.push(arr.shift());
                        added = true;
                    }
                }
            }
        }

        if (includeKO) {
            const koList = matches.filter(isKO).sort((a, b) => koRank(a.round) - koRank(b.round));
            queue.push(...koList);
        }

        if (queue.length === 0) {
            return res.json({ scheduled: 0, note: 'Brak meczów do zaplanowania (filtry/stan)' });
        }

        // sloty
        const daySlots = [];
        let dayIdx = 0;
        const pushDay = () => {
            let cur = mkDT(dayIdx, sH, sM);
            const end = mkDT(dayIdx, eH, eM);
            while (cur < end) {
                daySlots.push({ day: dayIdx, time: new Date(cur), lanes: Array(cap).fill(null) });
                cur = new Date(cur.getTime() + slotMin * 60 * 1000);
            }
        };
        pushDay();

        const placed = [];
        let slotPtr = 0;

        for (const m of queue) {
            while (slotPtr < daySlots.length && daySlots[slotPtr].lanes.every(x => x !== null)) {
                slotPtr++;
            }
            if (slotPtr >= daySlots.length) {
                dayIdx++;
                pushDay();
            }
            const s = daySlots[slotPtr];
            const lane = s.lanes.findIndex(x => x === null);
            s.lanes[lane] = { matchId: m.id, courtNumber: String(lane + 1) };
            placed.push({ matchId: m.id, matchTime: s.time, courtNumber: String(lane + 1) });
        }

        // zapis
        if (placed.length) {
            await prisma.$transaction(
                placed.map(p => prisma.match.update({
                    where: { id: p.matchId },
                    data: {
                        matchTime: p.matchTime,
                        courtNumber: p.courtNumber,
                        durationMin: slotMin,
                        updatedAt: new Date()
                    }
                }))
            );
        }

        // live
        const io = req.app.get('socketio') || req.app.get('io');
        if (io) {
            io.to(`tournament-${tournamentId}`).emit('matches-invalidate', { tournamentId });
        }

        return res.json({
            scheduled: placed.length,
            daysUsed: dayIdx + 1,
            slotMinutes: slotMin,
            courts: courtsN,
            referees: refsN,
            capacity: cap
        });
    } catch (e) {
        console.error('[autoScheduleTournament]', e);
        res.status(e.status || 500).json({ error: e.message || 'Błąd auto-rozpiski' });
    }
}
