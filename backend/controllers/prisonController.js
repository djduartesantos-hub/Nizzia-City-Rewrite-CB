const Player = require('../models/Player')
const PrisonEvent = require('../models/PrisonEvent')

async function ensureAuthPlayer(req) {
  const userId = req.authUserId
  if (!userId) throw new Error('Unauthorized')
  const player = await Player.findOne({ user: userId })
  if (!player) throw new Error('Player not found')
  return player
}

function calcBailCost(player) {
  const seconds = Math.max(60, Number(player.jailTime) || 0)
  const severity = Math.max(1, Math.ceil(seconds / 300))
  return severity * 25000
}

function mapPrisoner(doc, historyMap) {
  const userId = String(doc.user)
  return {
    userId,
    name: doc.name,
    id: doc.id,
    level: doc.level,
    remainingSeconds: Math.max(0, Number(doc.jailTime) || 0),
    crime: doc.lastCrime?.type || 'Crime não classificado',
    arrestedAt: doc.lastCrime?.ts || null,
    arrestedBy: doc.lastCrime?.actor || null,
    gang: doc.affiliation?.gang || null,
    bailCost: calcBailCost(doc),
    security: doc.securityTier || 'Médio',
    history: historyMap[userId] || [],
  }
}

async function listPrisoners(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(50, Math.max(5, Number(req.query.limit) || 20))
    const sort = String(req.query.sort || 'time_desc')
    const search = String(req.query.q || '').trim()
    const filter = { jailed: true }
    if (search) {
      const regex = new RegExp(search, 'i')
      filter.$or = [{ name: regex }, { id: Number(search) || -1 }]
    }

    const sortMap = {
      time_desc: { jailTime: -1 },
      time_asc: { jailTime: 1 },
      severity_desc: { level: -1 },
      severity_asc: { level: 1 },
    }
    const sortStage = sortMap[sort] || sortMap.time_desc

    const total = await Player.countDocuments(filter)
    const docs = await Player.find(filter)
      .sort(sortStage)
      .skip((page - 1) * limit)
      .limit(limit)
      .select('user name id jailTime level lastCrime affiliation securityTier')

    const userIds = docs.map((d) => String(d.user))
    const historyMap = {}
    if (userIds.length) {
      const events = await PrisonEvent.find({ targetUserId: { $in: userIds } })
        .sort({ ts: -1 })
        .limit(100)
        .lean()
      for (const evt of events) {
        const key = evt.targetUserId
        historyMap[key] = historyMap[key] || []
        if (historyMap[key].length < 5) {
          historyMap[key].push({ id: String(evt._id), ts: evt.ts, text: evt.summary })
        }
      }
    }

    const prisoners = docs.map((doc) => mapPrisoner(doc, historyMap))

    const avgAgg = await Player.aggregate([
      { $match: filter },
      { $group: { _id: null, avgSeconds: { $avg: '$jailTime' } } },
    ])
    const lastBreakout = await PrisonEvent.findOne({ type: 'breakout', success: true })
      .sort({ ts: -1 })
      .select('ts')
      .lean()

    return res.json({
      prisoners,
      stats: {
        total,
        avgSeconds: Math.round(avgAgg[0]?.avgSeconds || 0),
        lastBreakout: lastBreakout?.ts || null,
      },
      hasMore: page * limit < total,
    })
  } catch (err) {
    if (err.message === 'Unauthorized') return res.status(401).json({ error: 'Unauthorized' })
    console.error('PRISON listPrisoners error:', err)
    return res.status(500).json({ error: 'Failed to load prisoners' })
  }
}

async function attemptBreakout(req, res) {
  try {
    const helper = await ensureAuthPlayer(req)
    if (helper.jailed) return res.status(400).json({ error: 'Não podes libertar alguém estando preso.' })
    const { targetUserId } = req.body
    if (!targetUserId) return res.status(400).json({ error: 'targetUserId is required' })
    if (String(helper.user) === String(targetUserId)) return res.status(400).json({ error: 'Não podes libertar-te assim.' })
    const prisoner = await Player.findOne({ user: targetUserId })
    if (!prisoner || !prisoner.jailed) return res.status(404).json({ error: 'Jogador não está preso' })

    const baseChance = 0.35 + Math.min(0.4, (helper.level || 1) * 0.01)
    const roll = Math.random()
    const success = roll <= baseChance

    if (success) {
      prisoner.jailed = false
      prisoner.jailTime = 0
    } else {
      prisoner.jailTime = Math.min(86400, Number(prisoner.jailTime || 0) + 120)
    }
    await prisoner.save()

    const summary = success
      ? `${helper.name} libertou ${prisoner.name} numa fuga ousada.`
      : `${helper.name} falhou ao libertar ${prisoner.name}. Guardas reforçaram a segurança.`

    await PrisonEvent.create({
      type: 'breakout',
      actorUserId: String(helper.user),
      actorName: helper.name,
      targetUserId: String(prisoner.user),
      targetName: prisoner.name,
      success,
      summary,
      meta: { chance: baseChance, roll },
    })

    return res.json({
      success,
      chance: baseChance,
      message: success ? 'Fuga bem-sucedida!' : 'Tentativa falhou. Vigilância aumentada.',
      remainingSeconds: prisoner.jailTime,
    })
  } catch (err) {
    if (err.message === 'Unauthorized') return res.status(401).json({ error: 'Unauthorized' })
    if (err.message === 'Player not found') return res.status(404).json({ error: err.message })
    console.error('PRISON attemptBreakout error:', err)
    return res.status(500).json({ error: 'Não foi possível processar a fuga' })
  }
}

async function payBail(req, res) {
  try {
    const payer = await ensureAuthPlayer(req)
    const { targetUserId } = req.body
    if (!targetUserId) return res.status(400).json({ error: 'targetUserId is required' })
    const prisoner = await Player.findOne({ user: targetUserId })
    if (!prisoner || !prisoner.jailed) return res.status(404).json({ error: 'Jogador não está preso' })
    const cost = calcBailCost(prisoner)
    if (Number(payer.money || 0) < cost) return res.status(400).json({ error: 'Saldo insuficiente para pagar a fiança' })

    payer.money = Number(payer.money || 0) - cost
    prisoner.jailed = false
    prisoner.jailTime = 0

    await Promise.all([payer.save(), prisoner.save()])

    await PrisonEvent.create({
      type: 'bail',
      actorUserId: String(payer.user),
      actorName: payer.name,
      targetUserId: String(prisoner.user),
      targetName: prisoner.name,
      success: true,
      summary: `${payer.name} pagou $${cost.toLocaleString()} para libertar ${prisoner.name}.`,
      meta: { cost },
    })

    return res.json({ message: 'Fiança paga com sucesso', cost })
  } catch (err) {
    if (err.message === 'Unauthorized') return res.status(401).json({ error: 'Unauthorized' })
    if (err.message === 'Player not found') return res.status(404).json({ error: err.message })
    console.error('PRISON payBail error:', err)
    return res.status(500).json({ error: 'Falha ao pagar fiança' })
  }
}

async function listPrisonEvents(req, res) {
  try {
    const limit = Math.min(50, Math.max(5, Number(req.query.limit) || 10))
    const events = await PrisonEvent.find({})
      .sort({ ts: -1 })
      .limit(limit)
      .lean()
    return res.json({ events })
  } catch (err) {
    console.error('PRISON listPrisonEvents error:', err)
    return res.status(500).json({ error: 'Failed to load events' })
  }
}

module.exports = {
  listPrisoners,
  attemptBreakout,
  payBail,
  listPrisonEvents,
}
