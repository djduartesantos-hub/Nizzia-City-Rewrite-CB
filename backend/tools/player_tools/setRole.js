#!/usr/bin/env node
/*
 * Utility to grant/revoke roles for players, ensuring the `user` reference
 * uses a proper ObjectId (fixes cases where it was stored as a plain string).
 *
 * Usage:
 *   node backend/tools/player_tools/setRole.js --email user@example.com --role Admin
 *   node backend/tools/player_tools/setRole.js --email user@example.com --role Developer --create-if-missing
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../../config/db');
const User = require('../../models/User');
const Player = require('../../models/Player');
const Counter = require('../../models/Counter');

const ROLE_ENUM = ['Player', 'Moderator', 'Admin', 'Developer'];

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
    args[key] = value;
    if (value !== true) i += 1;
  }
  return args;
}

async function getNextPlayerId() {
  const result = await Counter.findOneAndUpdate(
    { name: 'player' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return result.seq;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const email = (args.email || '').toLowerCase();
  const roleInput = args.role ? String(args.role).trim() : '';
  const role = ROLE_ENUM.find((r) => r.toLowerCase() === roleInput.toLowerCase());
  const createIfMissing = Boolean(args['create-if-missing']);

  if (!email || !role) {
    console.error('Usage: node backend/tools/player_tools/setRole.js --email user@example.com --role Admin [--create-if-missing]');
    process.exit(1);
  }

  await connectDB();

  const user = await User.findOne({ email });
  if (!user) {
    console.error(`User not found with email ${email}`);
    process.exit(1);
  }

  let player = await Player.findOne({
    $or: [{ user: user._id }, { user: user._id.toString() }],
  });

  if (!player) {
    if (!createIfMissing) {
      console.error('Player not found for this user. Re-run with --create-if-missing to scaffold a default player.');
      process.exit(1);
    }
    const nextId = await getNextPlayerId();
    player = new Player({
      user: user._id,
      name: user.name || email.split('@')[0],
      id: nextId,
      gender: 'Male',
    });
    await player.save();
    console.log(`Created player ${player.name} (id ${player.id}) for ${email}`);
  }

  const needsFix = String(player.user) !== String(user._id);
  if (needsFix) {
    player.user = user._id;
    console.log('Fixed player.user reference to match user ObjectId.');
  }

  player.playerRole = role;
  await player.save();

  console.log(`Player ${player.name} (${player.id}) role set to ${role}.`);
  await mongoose.connection.close();
}

main().catch((err) => {
  console.error(err);
  mongoose.connection.close().finally(() => process.exit(1));
});
