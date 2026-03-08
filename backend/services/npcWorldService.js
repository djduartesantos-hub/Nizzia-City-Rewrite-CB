const NPC = require('../models/NPC')
const NPCEvent = require('../models/NPCEvent')
const Player = require('../models/Player')
const {
  randomRange,
  randomFrom,
  weightedRandom,
  createSeededRandom,
  generateNPCName,
  getSentimentForInteraction,
  getSentimentLabel,
  getCurrentScheduleSlot,
  formatTime,
} = require('../utils/npcHelpers')

function err(message, status = 400) {
  return Object.assign(new Error(message), { status })
}

function nowDate() {
  return new Date()
}

function parseZoneId(locationId) {
  if (!locationId || typeof locationId !== 'string') return null
  const parts = locationId.split('_')
  if (parts.length < 2) return null
  return parts.slice(1).join('_') || null
}

async function logNPCEvent(payload) {
  return NPCEvent.create({
    type: payload.type,
    npcId: payload.npcId,
    npcName: payload.npcName,
    cityId: payload.cityId,
    zoneId: payload.zoneId || parseZoneId(payload.locationId),
    description: payload.description,
    publiclyVisible: payload.publiclyVisible !== false,
    involvedPlayers: payload.involvedPlayers || [],
    metadata: payload.metadata || {},
    timestamp: payload.timestamp || nowDate(),
  })
}

function getSeverity(health) {
  const hp = Number(health) || 0
  if (hp <= 0 || hp <= 20) return 'critical'
  if (hp <= 60) return 'moderate'
  return 'light'
}

function shouldSuspendRoutine(npc) {
  const suspendConditions = ['injured', 'arrested', 'dead', 'hiding']
  return suspendConditions.includes(npc?.status?.condition)
}

async function updateNPCActivity(npcId, action, location, publiclyVisible = true) {
  const now = nowDate()
  await NPC.updateOne(
    { _id: npcId },
    {
      'activity.lastAction': action,
      'activity.lastActionAt': now,
      'meta.updatedAt': now,
      $push: {
        'activity.actionLog': {
          action,
          location,
          timestamp: now,
          publiclyVisible,
        },
      },
    }
  )
}

async function processNPCRoutines() {
  const now = nowDate()
  const currentTime = formatTime(now)

  const npcs = await NPC.find({
    'routine.enabled': true,
    'routine.suspended': false,
    tier: { $in: ['2', '3'] },
    'status.alive': true,
  }).select('name tier routine status meta activity')

  for (const npc of npcs) {
    const slot = getCurrentScheduleSlot(npc.routine?.schedule || [], currentTime)
    if (!slot) continue
    if (npc.status.location === slot.location && npc.status.locationId === slot.locationId) continue

    await NPC.updateOne(
      { _id: npc._id },
      {
        'status.location': slot.location,
        'status.locationId': slot.locationId,
        'status.cityId': npc.meta.cityId,
        'status.lastSeen': now,
        'activity.lastAction': slot.label,
        'activity.lastActionAt': now,
        'meta.updatedAt': now,
      }
    )

    if (slot.action !== 'sleep') {
      await logNPCEvent({
        type: 'npc_moved',
        npcId: npc._id,
        npcName: npc.name,
        cityId: npc.meta.cityId,
        locationId: slot.locationId,
        description: `${npc.name} foi visto em ${slot.label}`,
        publiclyVisible: Boolean(npc.meta?.isPublic),
        metadata: { action: slot.action, location: slot.location, locationId: slot.locationId },
        timestamp: now,
      })
    }
  }

  return { processed: npcs.length }
}

async function injureNPC(npcId, damage, cause, cityId) {
  const npc = await NPC.findById(npcId)
  if (!npc || !npc.status?.alive) return null
  const finalCityId = cityId || npc.meta?.cityId || npc.status?.cityId || 'unknown_city'

  const dmg = Math.max(0, Number(damage) || 0)
  const newHealth = Math.max(0, Number(npc.stats?.health || 0) - dmg)
  const severity = getSeverity(newHealth)
  const recoveryHours = { light: 2, moderate: 6, critical: 24 }[severity]

  const now = nowDate()
  const expectedDischarge = new Date(now.getTime() + recoveryHours * 3600000)

  const isDead = newHealth <= 0
  await NPC.updateOne(
    { _id: npcId },
    {
      'stats.health': newHealth,
      'status.alive': !isDead,
      'status.condition': isDead ? 'dead' : 'injured',
      'status.location': isDead ? 'dead' : 'hospital',
      'status.locationId': isDead ? `${finalCityId}_dead` : `${finalCityId}_hospital`,
      'status.lastSeen': now,
      'routine.enabled': false,
      'routine.suspended': true,
      'routine.suspendReason': isDead ? 'dead' : 'injured',
      'hospitalStay.admittedAt': isDead ? null : now,
      'hospitalStay.expectedDischarge': isDead ? null : expectedDischarge,
      'hospitalStay.severity': isDead ? null : severity,
      'hospitalStay.cause': cause || 'unknown',
      'hospitalStay.treatedBy': null,
      'hospitalStay.sabotaged': false,
      'hospitalStay.visitorLog': [],
      'meta.updatedAt': now,
    }
  )

  if (isDead) {
    await logNPCEvent({
      type: 'npc_died',
      npcId,
      npcName: npc.name,
      cityId: finalCityId,
      description: `${npc.name} morreu devido a ${cause || 'ferimentos graves'}`,
      publiclyVisible: true,
      metadata: { cause, damage: dmg },
      timestamp: now,
    })
  } else {
    await logNPCEvent({
      type: 'npc_injured',
      npcId,
      npcName: npc.name,
      cityId: finalCityId,
      description: `${npc.name} foi internado no hospital (${severity})`,
      publiclyVisible: true,
      metadata: { severity, cause, expectedDischarge },
      timestamp: now,
    })
  }

  return { npcId, newHealth, severity, expectedDischarge, dead: isDead }
}

async function dischargeFromHospital(npcId) {
  const npc = await NPC.findById(npcId)
  if (!npc) return null

  const now = nowDate()
  await NPC.updateOne(
    { _id: npcId },
    {
      'stats.health': Number(npc.stats?.maxHealth || 100),
      'status.condition': 'healthy',
      'status.location': 'street',
      'status.locationId': `${npc.meta.cityId}_zone_1`,
      'status.lastSeen': now,
      'routine.enabled': true,
      'routine.suspended': false,
      'routine.suspendReason': null,
      'hospitalStay.admittedAt': null,
      'hospitalStay.expectedDischarge': null,
      'hospitalStay.severity': null,
      'hospitalStay.cause': null,
      'hospitalStay.treatedBy': null,
      'hospitalStay.sabotaged': false,
      'hospitalStay.visitorLog': [],
      'meta.updatedAt': now,
    }
  )

  await logNPCEvent({
    type: 'npc_released',
    npcId,
    npcName: npc.name,
    cityId: npc.meta.cityId,
    description: `${npc.name} teve alta do hospital`,
    publiclyVisible: true,
    timestamp: now,
  })

  return { success: true }
}

async function accelerateRecovery(npcId, playerId, playerName, hoursReduced) {
  const npc = await NPC.findById(npcId)
  if (!npc || npc.status.location !== 'hospital') throw err('NPC não está no hospital', 400)

  const reduce = Math.max(0, Number(hoursReduced) || 0)
  if (reduce <= 0) throw err('hoursReduced deve ser > 0', 400)

  const now = nowDate()
  const currentExpected = npc.hospitalStay?.expectedDischarge ? new Date(npc.hospitalStay.expectedDischarge) : now
  const newDischarge = new Date(currentExpected.getTime() - reduce * 3600000)
  const finalDischarge = newDischarge < now ? now : newDischarge

  await NPC.updateOne(
    { _id: npcId },
    {
      'hospitalStay.expectedDischarge': finalDischarge,
      'meta.updatedAt': now,
      $push: {
        'hospitalStay.visitorLog': {
          visitorId: playerId,
          visitorType: 'player',
          timestamp: now,
          action: 'help',
        },
        'memory.playerInteractions': {
          playerId,
          playerName: playerName || null,
          type: 'helped',
          timestamp: now,
          sentiment: 40,
          notes: 'Pagou/ajudou recuperação no hospital',
        },
      },
    }
  )

  return { success: true, newDischarge: finalDischarge }
}

async function sabotageRecovery(npcId, playerId) {
  const npc = await NPC.findById(npcId)
  if (!npc || npc.status.location !== 'hospital') throw err('NPC não está no hospital', 400)

  const caughtChance = 0.35
  const caught = Math.random() < caughtChance
  if (caught) return { success: false, caught: true, consequence: 'arrested' }

  const now = nowDate()
  const extraHours = 6
  const expected = npc.hospitalStay?.expectedDischarge ? new Date(npc.hospitalStay.expectedDischarge) : now
  const newDischarge = new Date(expected.getTime() + extraHours * 3600000)

  await NPC.updateOne(
    { _id: npcId },
    {
      'hospitalStay.expectedDischarge': newDischarge,
      'hospitalStay.sabotaged': true,
      'meta.updatedAt': now,
      $push: {
        'hospitalStay.visitorLog': {
          visitorId: playerId,
          visitorType: 'player',
          timestamp: now,
          action: 'sabotage',
        },
      },
    }
  )

  return { success: true, caught: false, newDischarge }
}

async function arrestNPC(npcId, crime, sentenceHours, cityId, arrestedByPlayerId = null, arrestedByPlayerName = null) {
  const npc = await NPC.findById(npcId)
  if (!npc || !npc.status?.alive) return null
  const finalCityId = cityId || npc.meta?.cityId || npc.status?.cityId || 'unknown_city'

  const now = nowDate()
  const hours = Math.max(1, Number(sentenceHours) || 1)
  const expectedRelease = new Date(now.getTime() + hours * 3600000)

  await NPC.updateOne(
    { _id: npcId },
    {
      'status.condition': 'arrested',
      'status.location': 'prison',
      'status.locationId': `${finalCityId}_prison`,
      'status.lastSeen': now,
      'routine.enabled': false,
      'routine.suspended': true,
      'routine.suspendReason': 'arrested',
      'prisonStay.arrestedAt': now,
      'prisonStay.expectedRelease': expectedRelease,
      'prisonStay.sentence': hours,
      'prisonStay.crime': crime || 'crime desconhecido',
      'prisonStay.cell': null,
      'prisonStay.behavior': 'neutral',
      'prisonStay.escapeAttempts': 0,
      'prisonStay.visitorLog': [],
      'meta.updatedAt': now,
    }
  )

  if (arrestedByPlayerId) {
    await NPC.updateOne(
      { _id: npcId },
      {
        $push: {
          'memory.playerInteractions': {
            playerId: arrestedByPlayerId,
            playerName: arrestedByPlayerName || null,
            type: 'arrested',
            timestamp: now,
            sentiment: -90,
            notes: `Preso por crime: ${crime || 'desconhecido'}`,
          },
        },
      }
    )
  }

  await logNPCEvent({
    type: 'npc_arrested',
    npcId,
    npcName: npc.name,
    cityId: finalCityId,
    description: `${npc.name} foi preso por ${crime || 'crime'} (sentença: ${hours}h)`,
    publiclyVisible: true,
    metadata: { crime, sentenceHours: hours, expectedRelease },
    timestamp: now,
  })

  return { success: true, expectedRelease }
}

async function releaseFromPrison(npcId) {
  const npc = await NPC.findById(npcId)
  if (!npc) return null

  const now = nowDate()
  await NPC.updateOne(
    { _id: npcId },
    {
      'status.condition': 'healthy',
      'status.location': 'street',
      'status.locationId': `${npc.meta.cityId}_zone_1`,
      'status.lastSeen': now,
      'routine.enabled': true,
      'routine.suspended': false,
      'routine.suspendReason': null,
      'prisonStay.arrestedAt': null,
      'prisonStay.expectedRelease': null,
      'prisonStay.sentence': null,
      'prisonStay.crime': null,
      'prisonStay.cell': null,
      'prisonStay.behavior': 'neutral',
      'prisonStay.escapeAttempts': 0,
      'prisonStay.visitorLog': [],
      'meta.updatedAt': now,
    }
  )

  await logNPCEvent({
    type: 'npc_released',
    npcId,
    npcName: npc.name,
    cityId: npc.meta.cityId,
    description: `${npc.name} foi libertado da prisão`,
    publiclyVisible: true,
    timestamp: now,
  })

  return { success: true }
}

async function payBail(npcId, playerId, playerName, hoursReduced) {
  const npc = await NPC.findById(npcId)
  if (!npc || npc.status.location !== 'prison') throw err('NPC não está preso', 400)

  const reduce = Math.max(0, Number(hoursReduced) || 0)
  if (reduce <= 0) throw err('hoursReduced deve ser > 0', 400)

  const now = nowDate()
  const expected = npc.prisonStay?.expectedRelease ? new Date(npc.prisonStay.expectedRelease) : now
  const newRelease = new Date(expected.getTime() - reduce * 3600000)
  const finalRelease = newRelease < now ? now : newRelease

  await NPC.updateOne(
    { _id: npcId },
    {
      'prisonStay.expectedRelease': finalRelease,
      'meta.updatedAt': now,
      $push: {
        'prisonStay.visitorLog': {
          visitorId: playerId,
          visitorType: 'player',
          timestamp: now,
        },
        'memory.playerInteractions': {
          playerId,
          playerName: playerName || null,
          type: 'released',
          timestamp: now,
          sentiment: 70,
          notes: 'Pagou fiança',
        },
      },
    }
  )

  return { success: true, newRelease: finalRelease }
}

async function checkAndResumeRoutines() {
  const now = nowDate()

  const recoveredNPCs = await NPC.find({
    'status.location': 'hospital',
    'hospitalStay.expectedDischarge': { $lte: now },
  }).select('_id')

  for (const npc of recoveredNPCs) {
    await dischargeFromHospital(npc._id)
  }

  const releasedNPCs = await NPC.find({
    'status.location': 'prison',
    'prisonStay.expectedRelease': { $lte: now },
  }).select('_id')

  for (const npc of releasedNPCs) {
    await releaseFromPrison(npc._id)
  }

  const correctedSuspension = await NPC.updateMany(
    {
      'routine.enabled': true,
      'routine.suspended': false,
      'status.condition': { $in: ['injured', 'arrested', 'dead', 'hiding'] },
    },
    {
      'routine.suspended': true,
      'routine.suspendReason': 'condition_auto_sync',
      'meta.updatedAt': now,
    }
  )

  return {
    recovered: recoveredNPCs.length,
    released: releasedNPCs.length,
    suspendedAuto: correctedSuspension.modifiedCount || 0,
  }
}

async function handleWorldEvent(event) {
  if (!event?.type) throw err('Evento inválido', 400)
  const { type, cityId, zoneId, data = {} } = event
  const now = nowDate()

  switch (type) {
    case 'gang_war_started': {
      await NPC.updateMany(
        {
          'meta.cityId': cityId,
          'status.locationId': { $regex: zoneId || '' },
          tier: '1',
        },
        {
          'status.location': 'shelter',
          'status.condition': 'hiding',
          'routine.suspended': true,
          'routine.suspendReason': 'gang_war_started',
          'meta.updatedAt': now,
        }
      )

      await NPC.updateMany(
        {
          'meta.cityId': cityId,
          'faction.id': data.enemyFactionId,
          tier: '2',
        },
        {
          'status.condition': 'wanted',
          'activity.lastAction': 'Em alerta por gang war',
          'activity.lastActionAt': now,
          'meta.updatedAt': now,
        }
      )
      break
    }

    case 'police_raid': {
      await NPC.updateMany(
        {
          'meta.cityId': cityId,
          'status.locationId': { $regex: zoneId || '' },
          type: 'criminal',
        },
        {
          'status.location': 'shelter',
          'status.condition': 'hiding',
          'routine.suspended': true,
          'routine.suspendReason': 'police_raid',
          'meta.updatedAt': now,
        }
      )
      break
    }

    case 'city_event_festival': {
      await NPC.updateMany(
        {
          'meta.cityId': cityId,
          tier: { $in: ['1', '2'] },
          'status.condition': 'healthy',
        },
        {
          'status.location': 'street',
          'status.locationId': `${cityId}_${data.festivalZoneId || 'zone_1'}`,
          'activity.lastAction': 'A participar no festival',
          'activity.lastActionAt': now,
          'meta.updatedAt': now,
        }
      )
      break
    }

    case 'blackout': {
      await NPC.updateMany(
        {
          'meta.cityId': cityId,
          'routine.enabled': true,
        },
        {
          'routine.suspended': true,
          'routine.suspendReason': 'blackout',
          'meta.updatedAt': now,
        }
      )
      break
    }

    default:
      throw err(`Tipo de evento não suportado: ${type}`, 400)
  }

  return { success: true, type }
}

async function releaseBlackoutSuspension(cityId) {
  const now = nowDate()
  const r = await NPC.updateMany(
    {
      'meta.cityId': cityId,
      'routine.suspendReason': 'blackout',
    },
    {
      'routine.suspended': false,
      'routine.suspendReason': null,
      'meta.updatedAt': now,
    }
  )
  return { cityId, resumed: r.modifiedCount || 0 }
}

async function getCities() {
  const cityIds = await NPC.distinct('meta.cityId', {})
  return cityIds.filter(Boolean).map((id) => ({ _id: id }))
}

async function getActivePlayerCount(cityId) {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000)
  const cityFilter = cityId ? { home: { $regex: cityId, $options: 'i' } } : {}
  const byRecent = await Player.countDocuments({
    npc: { $ne: true },
    updatedAt: { $gte: fifteenMinutesAgo },
    ...cityFilter,
  })
  if (byRecent > 0) return byRecent
  return Player.countDocuments({ npc: { $ne: true } })
}

async function triggerAmbientEvent(npc) {
  const events = [
    { action: 'fight', chance: 0.15, damage: randomRange(10, 40), description: `${npc.name} foi envolvido numa briga de rua` },
    { action: 'crime_victim', chance: 0.1, damage: 0, description: `${npc.name} foi roubado na rua` },
    { action: 'accident', chance: 0.05, damage: randomRange(5, 25), description: `${npc.name} sofreu um acidente` },
  ]
  const triggered = weightedRandom(events)
  if (!triggered) return { triggered: false }

  if (triggered.damage > 0) {
    await injureNPC(npc._id, triggered.damage, triggered.action, npc.meta.cityId)
  }

  await logNPCEvent({
    type: 'npc_action',
    npcId: npc._id,
    npcName: npc.name,
    cityId: npc.meta.cityId,
    description: triggered.description,
    publiclyVisible: true,
    timestamp: nowDate(),
  })

  return { triggered: true, type: triggered.action }
}

async function triggerCharacterAction(npc) {
  const actions = [
    { type: 'deal', description: `${npc.name} foi visto a fazer um negócio suspeito` },
    { type: 'conflict', description: `${npc.name} entrou em confronto com um rival` },
    { type: 'patrol', description: `${npc.name} patrulhou o seu território` },
    { type: 'meeting', description: `${npc.name} teve um encontro secreto` },
  ]
  const action = randomFrom(actions)
  if (!action) return { triggered: false }

  await updateNPCActivity(npc._id, action.description, npc.status.location, Boolean(npc.meta?.isPublic))
  await logNPCEvent({
    type: action.type === 'conflict' ? 'npc_conflict' : 'npc_action',
    npcId: npc._id,
    npcName: npc.name,
    cityId: npc.meta.cityId,
    description: action.description,
    publiclyVisible: Boolean(npc.meta?.isPublic),
    timestamp: nowDate(),
  })

  return { triggered: true, type: action.type }
}

async function triggerSpecialNPCAction(npc) {
  const now = nowDate()
  if (npc.type === 'detective') {
    const description = `${npc.name} abriu uma investigação sobre actividade criminal recente`
    await updateNPCActivity(npc._id, description, npc.status.location, true)
    await logNPCEvent({
      type: 'npc_action',
      npcId: npc._id,
      npcName: npc.name,
      cityId: npc.meta.cityId,
      description,
      publiclyVisible: true,
      timestamp: now,
    })
    return { triggered: true, type: 'investigation' }
  }

  if (npc.type === 'criminal' && npc.faction?.id) {
    const description = `${npc.name} moveu-se para expandir o território da facção`
    await updateNPCActivity(npc._id, description, npc.status.location, true)
    await logNPCEvent({
      type: 'npc_action',
      npcId: npc._id,
      npcName: npc.name,
      cityId: npc.meta.cityId,
      description,
      publiclyVisible: true,
      timestamp: now,
    })
    return { triggered: true, type: 'faction_expand' }
  }

  const description = `${npc.name} iniciou uma acção estratégica na cidade`
  await updateNPCActivity(npc._id, description, npc.status.location, true)
  await logNPCEvent({
    type: 'npc_action',
    npcId: npc._id,
    npcName: npc.name,
    cityId: npc.meta.cityId,
    description,
    publiclyVisible: true,
    timestamp: now,
  })
  return { triggered: true, type: 'special' }
}

async function generateCityActivity(cityId, multiplier) {
  const npcs = await NPC.find({
    'meta.cityId': cityId,
    'status.alive': true,
    'status.condition': 'healthy',
  }).select('name type tier status faction meta')

  let triggered = 0
  for (const npc of npcs) {
    const roll = Math.random()

    if (npc.tier === '3' && roll < 0.15 * multiplier) {
      const r = await triggerSpecialNPCAction(npc)
      if (r?.triggered) triggered++
      continue
    }

    if (npc.tier === '2' && roll < 0.25 * multiplier) {
      const r = await triggerCharacterAction(npc)
      if (r?.triggered) triggered++
      continue
    }

    if (npc.tier === '1' && roll < 0.1 * multiplier) {
      const r = await triggerAmbientEvent(npc)
      if (r?.triggered) triggered++
    }
  }

  return { cityId, scanned: npcs.length, triggered }
}

async function generateAutonomousActivity() {
  const cities = await getCities()
  const summary = []

  for (const city of cities) {
    const cityId = String(city._id)
    const activePlayerCount = await getActivePlayerCount(cityId)
    const activityMultiplier = activePlayerCount < 5 ? 2.0 : activePlayerCount < 20 ? 1.5 : 1.0
    const result = await generateCityActivity(cityId, activityMultiplier)
    summary.push({ ...result, activePlayerCount, activityMultiplier })
  }

  return { cities: summary }
}

function baseNPC(cityId, seed, rng, tier, type) {
  const maxHealth = randomRange(80, 120)
  return {
    name: generateNPCName(rng),
    type,
    tier,
    gender: rng() > 0.5 ? 'male' : 'female',
    age: Math.floor(rng() * 40) + 20,
    avatar: `seed:${seed}-${cityId}-${tier}-${Math.floor(rng() * 10000)}`,
    status: {
      alive: true,
      location: 'street',
      locationId: `${cityId}_zone_${Math.floor(rng() * 5) + 1}`,
      cityId,
      condition: 'healthy',
      lastSeen: nowDate(),
    },
    stats: {
      health: 100,
      maxHealth,
      mentalHealth: 100,
      strength: Math.floor(rng() * 50) + 10,
      agility: Math.floor(rng() * 50) + 10,
      intelligence: Math.floor(rng() * 50) + 10,
    },
    personality: {
      aggression: Math.floor(rng() * 100),
      loyalty: Math.floor(rng() * 100),
      greed: Math.floor(rng() * 100),
      corruptibility: Math.floor(rng() * 100),
      ethics: Math.floor(rng() * 100),
    },
    faction: { id: null, name: null, rank: null, loyalty: 0 },
    routine: { enabled: false, suspended: false, suspendReason: null, schedule: [] },
    memory: { playerInteractions: [], npcInteractions: [], knownEvents: [] },
    relationships: { allies: [], enemies: [], neutral: [] },
    hospitalStay: {
      admittedAt: null,
      expectedDischarge: null,
      severity: null,
      cause: null,
      treatedBy: null,
      sabotaged: false,
      visitorLog: [],
    },
    prisonStay: {
      arrestedAt: null,
      expectedRelease: null,
      sentence: null,
      crime: null,
      cell: null,
      behavior: 'neutral',
      escapeAttempts: 0,
      visitorLog: [],
    },
    activity: { lastAction: 'A circular pela cidade', lastActionAt: nowDate(), currentEvent: null, actionLog: [] },
    economy: { cash: Math.floor(rng() * 500), debt: 0, debtTo: null },
    meta: { seed, cityId, generatedBy: 'seed', isPublic: true, createdAt: nowDate(), updatedAt: nowDate() },
  }
}

function generateSchedule(type, cityId) {
  const schedules = {
    criminal: [
      { time: '10:00', location: 'bar', locationId: `${cityId}_zone_2`, action: 'drink', label: 'No bar do bairro' },
      { time: '14:00', location: 'street', locationId: `${cityId}_zone_3`, action: 'deal', label: 'A circular pelo território' },
      { time: '20:00', location: 'building', locationId: `${cityId}_zone_1`, action: 'work', label: 'Reunião de negócios' },
      { time: '02:00', location: 'home', locationId: `${cityId}_zone_4`, action: 'sleep', label: 'Em casa' },
    ],
    vendor: [
      { time: '08:00', location: 'building', locationId: `${cityId}_zone_1`, action: 'work', label: 'A abrir a loja' },
      { time: '13:00', location: 'street', locationId: `${cityId}_zone_1`, action: 'eat', label: 'Pausa para almoço' },
      { time: '14:00', location: 'building', locationId: `${cityId}_zone_1`, action: 'work', label: 'De volta à loja' },
      { time: '20:00', location: 'home', locationId: `${cityId}_zone_2`, action: 'sleep', label: 'Em casa' },
    ],
    guard: [
      { time: '06:00', location: 'building', locationId: `${cityId}_zone_1`, action: 'patrol', label: 'Início do turno' },
      { time: '14:00', location: 'street', locationId: `${cityId}_zone_1`, action: 'patrol', label: 'Patrulha da tarde' },
      { time: '22:00', location: 'home', locationId: `${cityId}_zone_3`, action: 'sleep', label: 'Fim do turno' },
    ],
    detective: [
      { time: '07:00', location: 'building', locationId: `${cityId}_zone_1`, action: 'work', label: 'Na esquadra' },
      { time: '12:00', location: 'bar', locationId: `${cityId}_zone_2`, action: 'eat', label: 'Almoço com informador' },
      { time: '15:00', location: 'street', locationId: `${cityId}_zone_3`, action: 'patrol', label: 'Investigação de campo' },
      { time: '23:00', location: 'home', locationId: `${cityId}_zone_4`, action: 'sleep', label: 'Em casa' },
    ],
    medic: [
      { time: '08:00', location: 'hospital', locationId: `${cityId}_hospital`, action: 'work', label: 'Turno no hospital' },
      { time: '17:00', location: 'street', locationId: `${cityId}_zone_2`, action: 'walk', label: 'A caminho de casa' },
      { time: '20:00', location: 'home', locationId: `${cityId}_zone_3`, action: 'sleep', label: 'Em casa' },
    ],
  }
  return schedules[type] || schedules.criminal
}

function generateTier1NPC(cityId, seed, rng) {
  const npc = baseNPC(cityId, seed, rng, '1', 'ambient')
  const locations = ['street', 'bar', 'building', 'street', 'street']
  npc.status.location = randomFrom(locations, rng)
  return npc
}

function generateTier2NPC(cityId, seed, rng, type) {
  const npc = baseNPC(cityId, seed, rng, '2', type)
  npc.routine = {
    enabled: true,
    suspended: false,
    suspendReason: null,
    schedule: generateSchedule(type, cityId),
  }
  return npc
}

function generateTier3NPC(cityId, seed, rng, type) {
  const npc = baseNPC(cityId, seed, rng, '3', type)
  npc.routine = {
    enabled: true,
    suspended: false,
    suspendReason: null,
    schedule: generateSchedule(type, cityId),
  }
  npc.meta.isPublic = true
  return npc
}

async function seedCityNPCs(cityId, seed) {
  const existing = await NPC.countDocuments({ 'meta.cityId': cityId })
  if (existing > 0) return { created: 0, skipped: true, reason: 'already_seeded' }

  const rng = createSeededRandom(seed)
  const npcsToCreate = []

  for (let i = 0; i < 20; i++) {
    npcsToCreate.push(generateTier1NPC(cityId, seed, rng, i))
  }

  const tier2Types = ['vendor', 'criminal', 'guard', 'criminal', 'vendor', 'criminal', 'guard', 'character']
  for (let i = 0; i < 8; i++) {
    npcsToCreate.push(generateTier2NPC(cityId, seed, rng, tier2Types[i]))
  }

  const tier3Types = ['detective', 'criminal', 'medic']
  for (let i = 0; i < 3; i++) {
    npcsToCreate.push(generateTier3NPC(cityId, seed, rng, tier3Types[i]))
  }

  await NPC.insertMany(npcsToCreate)
  return { created: npcsToCreate.length, cityId }
}

async function cleanOldActivityLogs(maxAgeDays = 14) {
  const cutoff = new Date(Date.now() - Math.max(1, Number(maxAgeDays) || 14) * 24 * 3600000)
  const events = await NPCEvent.deleteMany({ timestamp: { $lt: cutoff } })

  await NPC.updateMany(
    {},
    {
      $pull: {
        'activity.actionLog': { timestamp: { $lt: cutoff } },
        'memory.playerInteractions': { timestamp: { $lt: cutoff } },
        'memory.npcInteractions': { timestamp: { $lt: cutoff } },
      },
    }
  )

  return { deletedEvents: events.deletedCount || 0 }
}

async function resetDailyNPCStats() {
  const now = nowDate()
  const r = await NPC.updateMany(
    {},
    {
      'activity.currentEvent': null,
      'meta.updatedAt': now,
    }
  )
  return { reset: r.modifiedCount || 0 }
}

async function listNPCs(filters = {}) {
  const query = {}
  if (filters.city) query['meta.cityId'] = String(filters.city)
  if (filters.location) query['status.location'] = String(filters.location)
  if (filters.condition) query['status.condition'] = String(filters.condition)
  if (filters.tier) query.tier = String(filters.tier)
  if (filters.type) query.type = String(filters.type)

  const npcs = await NPC.find(query)
    .select('name type tier status activity faction meta')
    .sort({ 'activity.lastActionAt': -1 })
    .limit(100)

  return { npcs, count: npcs.length }
}

async function getNPCById(npcId) {
  const npc = await NPC.findById(npcId)
  if (!npc) throw err('NPC não encontrado', 404)
  return npc
}

async function interactWithNPC(npcId, playerId, playerName, type, notes) {
  const npc = await NPC.findById(npcId)
  if (!npc) throw err('NPC não encontrado', 404)

  const sentiment = getSentimentForInteraction(type)
  const now = nowDate()

  await NPC.updateOne(
    { _id: npcId },
    {
      $push: {
        'memory.playerInteractions': {
          playerId,
          playerName,
          type,
          timestamp: now,
          sentiment,
          notes: notes || null,
        },
      },
      'meta.updatedAt': now,
    }
  )

  return { success: true, sentiment }
}

async function getNPCMemoryForPlayer(npcId, playerId) {
  const npc = await NPC.findById(npcId).select('memory.playerInteractions')
  if (!npc) throw err('NPC não encontrado', 404)

  const interactions = (npc.memory?.playerInteractions || []).filter(
    (i) => String(i.playerId) === String(playerId)
  )

  const totalSentiment = interactions.reduce((sum, i) => sum + Number(i.sentiment || 0), 0)
  return {
    interactions,
    totalSentiment,
    relationship: getSentimentLabel(totalSentiment),
  }
}

async function getCityFeed(cityId, limit = 50) {
  const events = await NPCEvent.find({ cityId, publiclyVisible: true })
    .sort({ timestamp: -1 })
    .limit(Math.min(200, Math.max(1, Number(limit) || 50)))
  return { events }
}

module.exports = {
  processNPCRoutines,
  shouldSuspendRoutine,
  checkAndResumeRoutines,
  injureNPC,
  dischargeFromHospital,
  accelerateRecovery,
  sabotageRecovery,
  arrestNPC,
  releaseFromPrison,
  payBail,
  handleWorldEvent,
  releaseBlackoutSuspension,
  generateAutonomousActivity,
  generateCityActivity,
  triggerAmbientEvent,
  triggerCharacterAction,
  triggerSpecialNPCAction,
  seedCityNPCs,
  cleanOldActivityLogs,
  resetDailyNPCStats,
  logNPCEvent,
  listNPCs,
  getNPCById,
  interactWithNPC,
  getNPCMemoryForPlayer,
  getCityFeed,
}
