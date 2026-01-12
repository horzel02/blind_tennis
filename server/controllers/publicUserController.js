// server/controllers/publicUserController.js
import * as publicUserService from '../services/publicUserService.js';

export async function getPublicProfile(req, res) {
  try {
    const uid = Number(req.params.id);
    if (!Number.isFinite(uid)) return res.status(400).json({ error: 'Invalid user id' });

    const data = await publicUserService.getPublicProfile(uid);
    if (!data) return res.status(404).json({ error: 'User not found' });

    return res.json(data);
  } catch (e) {
    console.error('getPublicProfile error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
}
