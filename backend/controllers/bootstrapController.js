const Counter = require('../models/Counter');
const Player = require('../models/Player');
const User = require('../models/User');

const ROLE_ENUM = ['Player', 'Moderator', 'Admin', 'Developer'];
const BOOTSTRAP_TOKEN = process.env.ADMIN_BOOTSTRAP_TOKEN;

async function getNextPlayerId() {
  const result = await Counter.findOneAndUpdate(
    { name: 'player' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return result.seq;
}

function normalizeRole(input) {
  if (!input) return 'Admin';
  const wanted = String(input).trim().toLowerCase();
  return ROLE_ENUM.find((r) => r.toLowerCase() === wanted) || 'Admin';
}

async function ensurePlayer(user, createIfMissing) {
  let player = await Player.findOne({ user: user._id });
  if (!player) {
    player = await Player.findOne({ user: user._id.toString() });
  }
  if (!player && createIfMissing) {
    const nextId = await getNextPlayerId();
    player = new Player({
      user: user._id,
      name: user.name || user.email.split('@')[0],
      id: nextId,
      gender: 'Male',
    });
    await player.save();
  }
  return player;
}

async function bootstrapRole(req, res) {
  try {
    if (!BOOTSTRAP_TOKEN) {
      return res.status(404).json({ error: 'Not found' });
    }
    const token = req.headers['x-admin-bootstrap-token'] || req.query.token;
    if (!token || token !== BOOTSTRAP_TOKEN) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const email = (req.body?.email || '').toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }
    const role = normalizeRole(req.body?.role);
    const createIfMissing = req.body?.createIfMissing !== false;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const player = await ensurePlayer(user, createIfMissing);
    if (!player) {
      return res.status(404).json({ error: 'Player not found for user and auto-create disabled' });
    }

    const needsFix = String(player.user) !== String(user._id);
    if (needsFix) {
      player.user = user._id;
    }
    player.playerRole = role;
    await player.save();

    return res.json({
      userId: user._id,
      playerId: player.id,
      playerRole: player.playerRole,
      fixedReference: needsFix,
    });
  } catch (err) {
    console.error('bootstrapRole error:', err);
    return res.status(500).json({ error: 'Failed to bootstrap role' });
  }
}

module.exports = { bootstrapRole };
