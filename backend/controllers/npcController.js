const Player = require('../models/Player')
const npcWorldService = require('../services/npcWorldService')

function handleError(res, e) {
  return res.status(e.status || 500).json({ error: e.message || 'Internal error' })
}

async function list(req, res) {
  try {
    return res.json(await npcWorldService.listNPCs(req.query || {}))
  } catch (e) {
    return handleError(res, e)
  }
}

async function detail(req, res) {
  try {
    return res.json({ npc: await npcWorldService.getNPCById(req.params.id) })
  } catch (e) {
    return handleError(res, e)
  }
}

async function interact(req, res) {
  try {
    const player = await Player.findOne({ user: req.authUserId }).select('_id name')
    if (!player) return res.status(404).json({ error: 'Player not found' })

    const { type, notes } = req.body || {}
    if (!type) return res.status(400).json({ error: 'type is required' })

    const result = await npcWorldService.interactWithNPC(
      req.params.id,
      player._id,
      player.name,
      type,
      notes
    )
    return res.json(result)
  } catch (e) {
    return handleError(res, e)
  }
}

async function memory(req, res) {
  try {
    return res.json(await npcWorldService.getNPCMemoryForPlayer(req.params.id, req.params.playerId))
  } catch (e) {
    return handleError(res, e)
  }
}

async function hospitalHelp(req, res) {
  try {
    const player = await Player.findOne({ user: req.authUserId }).select('_id name')
    if (!player) return res.status(404).json({ error: 'Player not found' })

    const hoursReduced = Number(req.body?.hoursReduced || 2)
    const result = await npcWorldService.accelerateRecovery(
      req.params.id,
      player._id,
      player.name,
      hoursReduced
    )
    return res.json(result)
  } catch (e) {
    return handleError(res, e)
  }
}

async function hospitalSabotage(req, res) {
  try {
    const player = await Player.findOne({ user: req.authUserId }).select('_id')
    if (!player) return res.status(404).json({ error: 'Player not found' })

    const result = await npcWorldService.sabotageRecovery(req.params.id, player._id)
    return res.json(result)
  } catch (e) {
    return handleError(res, e)
  }
}

async function prisonPayBail(req, res) {
  try {
    const player = await Player.findOne({ user: req.authUserId }).select('_id name')
    if (!player) return res.status(404).json({ error: 'Player not found' })

    const hoursReduced = Number(req.body?.hoursReduced || 4)
    const result = await npcWorldService.payBail(
      req.params.id,
      player._id,
      player.name,
      hoursReduced
    )
    return res.json(result)
  } catch (e) {
    return handleError(res, e)
  }
}

async function triggerEvent(req, res) {
  try {
    return res.json(await npcWorldService.handleWorldEvent(req.body || {}))
  } catch (e) {
    return handleError(res, e)
  }
}

async function feed(req, res) {
  try {
    const limit = Number(req.query?.limit || 50)
    return res.json(await npcWorldService.getCityFeed(req.params.cityId, limit))
  } catch (e) {
    return handleError(res, e)
  }
}

async function injure(req, res) {
  try {
    const damage = Number(req.body?.damage || 10)
    const cause = req.body?.cause || 'unknown'
    const cityId = req.body?.cityId || null
    return res.json(await npcWorldService.injureNPC(req.params.id, damage, cause, cityId))
  } catch (e) {
    return handleError(res, e)
  }
}

async function arrest(req, res) {
  try {
    const player = await Player.findOne({ user: req.authUserId }).select('_id name')
    const crime = req.body?.crime || 'crime desconhecido'
    const sentenceHours = Number(req.body?.sentenceHours || 4)
    const cityId = req.body?.cityId || null
    return res.json(
      await npcWorldService.arrestNPC(
        req.params.id,
        crime,
        sentenceHours,
        cityId,
        player?._id || null,
        player?.name || null
      )
    )
  } catch (e) {
    return handleError(res, e)
  }
}

module.exports = {
  list,
  detail,
  interact,
  memory,
  hospitalHelp,
  hospitalSabotage,
  prisonPayBail,
  triggerEvent,
  feed,
  injure,
  arrest,
}
