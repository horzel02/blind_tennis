// server/routes/users.js
import express from 'express';
import prisma from '../prismaClient.js';
import { ensureAuth } from '../middlewares/auth.js';

const router = express.Router();

// GET /api/users?search=foo
router.get('/', ensureAuth, async (req, res) => {
    try {
        const raw = String(req.query.search || '').trim();
        const terms = raw.split(/\s+/).filter(Boolean);

        const users = await prisma.users.findMany({
            where: {
                AND: terms.map(term => ({
                    OR: [
                        { name: { contains: term } },
                        { surname: { contains: term } },
                        { email: { contains: term } }
                    ]
                }))
            },
            take: 10,
            select: { id: true, name: true, surname: true, email: true }
        });
        res.json(users);
    } catch (err) {
        console.error('Błąd w /api/users:', err);
        res.status(500).json({ error: 'Serwer error przy wyszukiwaniu użytkowników' });
    }
});

export default router;
