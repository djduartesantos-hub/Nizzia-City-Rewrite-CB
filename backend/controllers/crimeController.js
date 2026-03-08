const Player = require('../models/Player');
const Item = require('../models/Item');
const HospitalEvent = require('../models/HospitalEvent');
const PrisonEvent = require('../models/PrisonEvent');
const { getConfig } = require('../services/worldConfigService');
const { CRIMES, LOCATION } = require('../config/crimes/search_for_cash');

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

function ensureCrimeMap(player) {
	if (!player.crime) player.crime = { last: new Map() };
	if (!player.crime.last) player.crime.last = new Map();
	// Handle legacy plain-object storage
	if (typeof player.crime.last.get !== 'function') {
		player.crime.last = new Map(Object.entries(player.crime.last || {}));
	}
	return player.crime.last;
}

const CRIME_CONFIG_TTL = 30 * 1000;
let cachedCrimePunishConfig = null;
let crimeConfigLoadedAt = 0;

async function loadCrimePunishConfig(force = false) {
	const now = Date.now();
	if (!force && cachedCrimePunishConfig && (now - crimeConfigLoadedAt) < CRIME_CONFIG_TTL) {
		return cachedCrimePunishConfig;
	}
	cachedCrimePunishConfig = await getConfig('crime');
	crimeConfigLoadedAt = now;
	return cachedCrimePunishConfig;
}

function applyVariance(base, variance) {
	if (!variance) return base;
	return base + randInt(-Math.abs(variance), Math.abs(variance));
}

async function applyCrimeCriticalFail(player, {
	severity = 'major',
	locationName = 'crime',
	crimeId = null,
	notes = '',
} = {}) {
	const config = await loadCrimePunishConfig();
	if (!config) return { damage: 0, hospitalized: false, jailed: false };
	const severityMultipliers = config.severityMultipliers || {};
	const severityMultiplier = Number(severityMultipliers[severity]) || 1;
	let damage = 0;
	if (config.enableHealthLoss !== false) {
		const current = Math.max(0, Number(player.health || 0));
		const pct = Math.max(0, Number(config.criticalHpLossPercent) || 0);
		const flat = Math.max(0, Number(config.criticalHpLossFlat) || 0);
		const pctDamage = Math.floor((pct / 100) * current);
		damage = Math.max(0, Math.round((pctDamage + flat) * severityMultiplier));
		if (damage > 0) {
			player.health = Math.max(0, current - damage);
			player.lastDamage = {
				type: 'crime_fail',
				source: notes || `Falha em ${locationName}`,
				ts: new Date(),
				amount: damage,
			};
		}
	}
	let hospitalized = false;
	if (config.enableHospitalize !== false) {
		const threshold = Math.max(0, Number(config.hospitalizeBelowHealth) || 0);
		if (player.health <= threshold) hospitalized = true;
	}
	if (player.health <= 0) hospitalized = true;
	const eventLogs = config.logEvents !== false;
	if (hospitalized) {
		const baseSeconds = Math.max(60, Number(config.hospitalSeconds) || 600);
		const variance = Math.max(0, Number(config.hospitalVarianceSeconds) || 0);
		const duration = Math.max(60, applyVariance(baseSeconds, variance));
		player.hospitalized = true;
		player.hospitalTime = Math.max(duration, Number(player.hospitalTime || 0));
		const floor = Number(config.hospitalHealthFloor);
		if (Number.isFinite(floor) && floor > 0) {
			player.health = Math.max(player.health, floor);
		}
		if (eventLogs) {
			await HospitalEvent.create({
				type: 'triage',
				actorUserId: null,
				actorName: 'Trauma Team',
				targetUserId: String(player.user),
				targetName: player.name,
				success: true,
				summary: `${player.name} foi internado após falha em ${locationName}.`,
				meta: { duration, crimeId, severity },
			});
		}
	}
	let jailed = false;
	if (config.enableJail !== false) {
		const chance = Math.max(0, Math.min(100, Number(config.jailChancePercent) || 0));
		if (Math.random() * 100 < chance) {
			const baseSeconds = Math.max(60, Number(config.jailSeconds) || 600);
			const variance = Math.max(0, Number(config.jailVarianceSeconds) || 0);
			const duration = Math.max(60, applyVariance(baseSeconds, variance));
			const cap = Math.max(duration, Number(config.jailMaxSeconds) || 86400);
			player.jailed = true;
			player.jailTime = Math.min(cap, Math.max(duration, Number(player.jailTime || 0)));
			player.lastCrime = {
				type: 'crime_fail',
				actor: 'sistema',
				actorName: 'Polícia Metropolitana',
				severity,
				ts: new Date(),
				notes: notes || `Falha em ${locationName}`,
			};
			if (eventLogs) {
				await PrisonEvent.create({
					type: 'system',
					actorUserId: null,
					actorName: 'Sistema',
					targetUserId: String(player.user),
					targetName: player.name,
					success: true,
					summary: `${player.name} foi detido após falha em ${locationName}.`,
					meta: { duration, crimeId, severity },
				});
			}
			jailed = true;
		}
	}
	return { damage, hospitalized, jailed };
}

const PICKPOCKET_TARGETS = [
	{ id: 'neon-bazaar', name: 'Mercado Neon', reward: [120, 320], success: 68 },
	{ id: 'tram-expo', name: 'Tram Expo', reward: [200, 420], success: 52 },
	{ id: 'skylux-gala', name: 'Gala Skylux', reward: [420, 880], success: 38 },
];

const PICKPOCKET_GEAR = [
	{ id: 'smart-fabric', label: 'Smart fabric', bonus: 6 },
	{ id: 'pulse-jammer', label: 'Pulse jammer', bonus: 8 },
	{ id: 'microdrone', label: 'Microdrone', bonus: 4 },
];

const PICKPOCKET_CREW = [
	{ id: 'solo', label: 'Solo', bonus: 0 },
	{ id: 'lookout', label: 'Lookout', bonus: 5 },
	{ id: 'decoy', label: 'Decoy crew', bonus: 7 },
];

const PICKPOCKET_SUCCESS_BLURBS = [
	'Lookout desviou o chefe de segurança e abrimos espaço para sacar 3 chips gold.',
	'Saída limpa via túneis de serviço. Os scanners nem chegaram a calibrar.',
	'Transferimos as wallets antes do security sweep, zero pistas.',
];

const PICKPOCKET_FAIL_BLURBS = [
	'Sensor acústico detectou o jammer. Fomos expulsos antes de tocar no loot.',
	'Lookout perdeu sinal e os drones seguiram o calor corporal.',
	'Um VIP reconheceu o disfarce. Retirada forçada, heat elevado.',
];

const BURGLARY_ESTATES = [
	{ id: 'skylane', name: 'Skylane Pinnacle', reward: [4200, 7800], success: 54 },
	{ id: 'helios', name: 'Helios Suites', reward: [2600, 5200], success: 72 },
	{ id: 'vault-99', name: 'Vault 99', reward: [5800, 11000], success: 41 },
];

const BURGLARY_TOOLKITS = [
	{ id: 'phase', label: 'Phase cutter', bonus: 8 },
	{ id: 'ghostkey', label: 'Ghost key', bonus: 5 },
	{ id: 'drone', label: 'Micro drone', bonus: 3 },
];

const BURGLARY_ENTRY_TEAMS = [
	{ id: 'ghosts', label: 'Ghost runners', bonus: 7 },
	{ id: 'insider', label: 'Insider badge', bonus: 5 },
	{ id: 'solo', label: 'Solo climb', bonus: 0 },
];

const BURGLARY_SUCCESS_BLURBS = [
	'Escada externa reprogramada, saída via telhado auxiliar sem alarmes.',
	'Drone fantasma sincronizado com iluminação — zero testemunhas.',
	'Elevador de serviço ficou em loop, equipa desceu invisível.',
];

const BURGLARY_FAIL_BLURBS = [
	'Laser grid voltou mais cedo; suits ficaram marcados com tinta UV.',
	'Um bot reconheceu a corda; tivemos de cortar a missão.',
	'Cartão insider bloqueado, equipe exposta no lobby.',
];

const SMUGGLING_ROUTES = [
	{ id: 'aurora-run', name: 'Aurora Run', success: 78 },
	{ id: 'sunken-trade', name: 'Sunken Trade', success: 63 },
	{ id: 'skycaravan', name: 'Sky Caravan', success: 48 },
];

const SMUGGLING_CARGO = [
	{ id: 'biochips', label: 'Biochips', capacity: 40, reward: 48000 },
	{ id: 'plasma', label: 'Plasma cores', capacity: 60, reward: 72000 },
	{ id: 'relics', label: 'Relíquias', capacity: 30, reward: 96000 },
];

const SMUGGLING_ESCORTS = [
	{ id: 'mirage', label: 'Mirage wing', bonus: 12 },
	{ id: 'riptide', label: 'Riptide subs', bonus: 8 },
	{ id: 'phantom', label: 'Phantom riders', bonus: 5 },
];

const SMUGGLING_SUCCESS_BLURBS = [
	'TTX reforçado atravessou o nevoeiro sem qualquer ping nos radares.',
	'Drones Mirage confundiram satélites e entregámos 100% da carga.',
	'Escolta Phantom fez cortejo urbano que baralhou as patrulhas.',
];

const SMUGGLING_FAIL_BLURBS = [
	'Tempestade magnética derrubou o VTOL, escolta abortou.',
	'Interceptores detectaram assinatura térmica do submersível.',
	'Tropas federais seguiram o comboio fantasma via satélite secundário.',
];

function getCooldownRemaining(player, crimeId, cooldownSeconds) {
	if (!cooldownSeconds) return 0;
	const crimeMap = ensureCrimeMap(player);
	const lastAttempt = crimeMap.get(crimeId);
	if (!lastAttempt) return 0;
	const diffSeconds = Math.floor((Date.now() - new Date(lastAttempt).getTime()) / 1000);
	return Math.max(0, cooldownSeconds - diffSeconds);
}

function stampCrimeAttempt(player, crimeId) {
	const crimeMap = ensureCrimeMap(player);
	crimeMap.set(crimeId, new Date());
	player.markModified('crime');
}

function applyCrimeXp(player, crime, outcome) {
	if (!crime) return 0;
	player.crimesCommitted = Number(player.crimesCommitted || 0) + 1;
	let xp = 0;
	if (outcome === 'success') {
		player.crimesSuccessful = Number(player.crimesSuccessful || 0) + 1;
		xp = Number(crime.expPerSuccess || 0);
	} else if (outcome === 'critical_fail') {
		player.crimesCriticalFails = Number(player.crimesCriticalFails || 0) + 1;
		xp = Number(crime.expPerFail || 0);
	} else {
		player.crimesFails = Number(player.crimesFails || 0) + 1;
		xp = Number(crime.expPerFail || 0);
	}
	if (xp > 0) {
		player.crimeExp = Number(player.crimeExp || 0) + xp;
		player.exp = Number(player.exp || 0) + xp;
		if (!player.crimesXpList) player.crimesXpList = [];
		const rec = player.crimesXpList.find((r) => r.crimeId === crime.id);
		if (rec) rec.exp = Number(rec.exp || 0) + xp;
		else player.crimesXpList.push({ crimeId: crime.id, exp: xp });
	}
	return xp;
}

function badRequest(message, extra = {}) {
	const err = new Error(message);
	err.status = 400;
	err.extra = extra;
	return err;
}

async function handleCrimeAction(req, res, crimeKey, executor) {
	try {
		const userId = req.authUserId;
		const player = await resolvePlayer(userId);
		if (!player) return res.status(404).json({ error: 'Player not found' });
		const crime = CRIMES[crimeKey];
		if (!crime) return res.status(500).json({ error: 'Crime config missing' });
		const nerveStats = player.nerveStats || (player.nerveStats = {});
		const nerve = Number(nerveStats.nerve || 0);
		const nerveCost = Number(crime.nerveCost || 1);
		const cooldownSeconds = Number(crime.cooldownSeconds || 0);
		if (nerve < nerveCost) return res.status(400).json({ error: 'Not enough nerve' });
		const remaining = getCooldownRemaining(player, crime.id, cooldownSeconds);
		if (remaining > 0) {
			return res.status(429).json({ error: 'Cooldown ativo', secondsLeft: remaining });
		}
		const result = await executor({ player, body: req.body || {}, crime, nerveCost });
		if (!result || typeof result !== 'object') throw new Error('Crime result missing');
		const payout = Number(result.payout || 0);
		if (payout > 0) {
			player.$locals._txMeta = { type: 'crime', description: `${crime.name} payout` };
			player.money = Number((Number(player.money || 0) + payout).toFixed(2));
		}
		nerveStats.nerve = Math.max(0, nerve - nerveCost);
		if (cooldownSeconds > 0) stampCrimeAttempt(player, crime.id);
		const outcome = result.outcome || (result.success ? 'success' : 'fail');
		const xpGained = applyCrimeXp(player, crime, outcome);
		await player.save();
		const response = {
			ok: true,
			result: {
				success: !!result.success,
				outcome,
				payout,
				heat: result.heat ?? null,
				...result.details,
			},
			xpGained,
			money: player.money,
			nerve: player.nerveStats?.nerve || 0,
		};
		if (cooldownSeconds > 0) {
			response.cooldown = {
				secondsLeft: cooldownSeconds,
				endsAt: new Date(Date.now() + cooldownSeconds * 1000).toISOString(),
			};
		}
		return res.json(response);
	} catch (e) {
		const status = e.status || 500;
		const payload = { error: e.message || 'Internal error' };
		if (e.extra) Object.assign(payload, e.extra);
		return res.status(status).json(payload);
	}
}

function findLocationById(id) {
	const entries = Object.values(LOCATION || {})
	return entries.find(l => l.id === id || l.id === String(id)) || null
}

async function resolvePlayer(userId) {
	if (!userId) return null
	return Player.findOne({ user: userId })
}

// POST /api/crime/search-for-cash { locationId }
async function searchForCash(req, res) {
	try {
		const userId = req.authUserId
		const { locationId } = req.body || {}
		const player = await resolvePlayer(userId)
		if (!player) return res.status(404).json({ error: 'Player not found' })

		// Use config for this crime
		const crime = CRIMES.search_for_cash
		const allowedLocs = Array.isArray(crime.location) ? crime.location : [crime.location].filter(Boolean)
		const nerveCost = Number(crime.nerveCost || 1)
		const cooldownSeconds = Number(crime.cooldownSeconds || 0)
		const nerve = Number(player.nerveStats?.nerve || 0)
		if (nerve < nerveCost) return res.status(400).json({ error: 'Not enough nerve' })

		let lastAttempt = null
		if (cooldownSeconds > 0) {
			const crimeMap = ensureCrimeMap(player)
			lastAttempt = crimeMap.get(crime.id)
			const lastMs = lastAttempt ? new Date(lastAttempt).getTime() : 0
			if (lastMs > 0) {
				const diffSeconds = Math.floor((Date.now() - lastMs) / 1000)
				const remaining = cooldownSeconds - diffSeconds
				if (remaining > 0) {
					return res.status(429).json({ error: 'Cooldown ativo', secondsLeft: remaining })
				}
			}
		}

		// Resolve location: require selection and validate against config list
		if (!locationId) return res.status(400).json({ error: 'locationId is required' })
		if (allowedLocs.length && !allowedLocs.includes(locationId)) return res.status(400).json({ error: 'Invalid location for this crime' })
		const locId = locationId
		const loc = findLocationById(locId)
		if (!loc) return res.status(400).json({ error: 'Invalid location' })

			// No cooldown enforcement for crimes

			// Determine outcome from location-specific chances, adjusted by popularity
			// Popularity bucket by local time
			const hour = new Date().getHours()
			const bucket = hour >= 6 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'afternoon' : hour >= 18 && hour < 22 ? 'evening' : 'night'
			const popTable = loc.PopularityAt || {}
			const popPerc = Number(popTable[bucket] || 50)
			const popularity = Math.max(0, Math.min(1, popPerc / 100)) // 0..1
			const critBase = Number(loc.CriticalFailChance || 0)
			const minorBase = Number(loc.MinorFailChance || 0)
			// Reduce fail chances up to 50% at max popularity
			const failFactor = 1 - 0.5 * popularity
			const critChance = Math.max(0, critBase * failFactor)
			const minorChance = Math.max(0, minorBase * failFactor)
			const rollOutcome = Math.random() * 100
			let outcome = 'success'
			if (rollOutcome < critChance) outcome = 'critical_fail'
			else if (rollOutcome < (critChance + minorChance)) outcome = 'minor_fail'

			const awarded = { money: 0, items: [] }
			const warnings = []
				if (outcome === 'success') {
				// Roll loot: independent chances per entry; aggregate
						for (const entry of (loc.loot || [])) {
							// Boost loot chances based on popularity (0.5x .. 1.5x)
							const base = Number(entry.chance || 0)
							const lootFactor = 0.5 + popularity // 0.5..1.5
							const effChance = Math.max(0, Math.min(100, base * lootFactor))
							const roll = Math.random() * 100
							if (roll <= effChance) {
						if (entry.type === 'money') {
							const min = Math.max(0, Number(entry.min || 0))
							const max = Math.max(min, Number(entry.max || min))
							const amt = randInt(min, max)
							awarded.money += amt
						} else if (entry.type === 'item') {
							const itemId = String(entry.value)
							const doc = await Item.findOne({ id: itemId })
							if (doc) {
								player.inventory = player.inventory || []
								const idx = player.inventory.findIndex((e) => String(e.item) === String(doc._id))
								if (idx >= 0) player.inventory[idx].qty = Number(player.inventory[idx].qty || 0) + 1
								else player.inventory.push({ item: doc._id, qty: 1 })
								awarded.items.push(itemId)
							} else {
								warnings.push(`Item ${itemId} not found`)
							}
						}
					}
				}
			}

		// Apply gains and costs
			if (outcome === 'success') {
			player.$locals._txMeta = { type: 'crime', description: `Crime payout` };
			player.money = Number((Number(player.money || 0) + Number(awarded.money || 0)).toFixed(2))
		}
		if (player.nerveStats) player.nerveStats.nerve = Math.max(0, Number(nerve - nerveCost))

		// Record cooldown timestamp for this crime
		if (cooldownSeconds > 0) {
			const crimeMap = ensureCrimeMap(player)
			crimeMap.set(crime.id, new Date())
			player.markModified('crime')
		}

			// Update counters and XP
			player.crimesCommitted = Number(player.crimesCommitted || 0) + 1
			let xpGained = 0
			if (outcome === 'success') {
				player.crimesSuccessful = Number(player.crimesSuccessful || 0) + 1
					// XP reward on success
					xpGained = Number(crime.expPerSuccess || 5)
				player.crimeExp = Number(player.crimeExp || 0) + xpGained
				player.exp = Number(player.exp || 0) + xpGained
				// Track per-crime XP
				const cid = CRIMES.search_for_cash.id
				if (!player.crimesXpList) player.crimesXpList = []
				const rec = player.crimesXpList.find((r) => r.crimeId === cid)
				if (rec) rec.exp = Number(rec.exp || 0) + xpGained
				else player.crimesXpList.push({ crimeId: cid, exp: xpGained })
			} else if (outcome === 'minor_fail') {
				player.crimesFails = Number(player.crimesFails || 0) + 1
					const failXp = Number(crime.expPerFail || 0)
					if (failXp > 0) { player.crimeExp = Number(player.crimeExp || 0) + failXp; player.exp = Number(player.exp || 0) + failXp }
			} else if (outcome === 'critical_fail') {
				player.crimesCriticalFails = Number(player.crimesCriticalFails || 0) + 1
				const failXp = Number(crime.expPerFail || 0)
				if (failXp > 0) { player.crimeExp = Number(player.crimeExp || 0) + failXp; player.exp = Number(player.exp || 0) + failXp }
				const ev = loc.CriticalFailEvent || {}
				await applyCrimeCriticalFail(player, {
					severity: ev.severity || 'major',
					locationName: loc.name,
					crimeId: crime.id,
					notes: ev.note || 'Busca por dinheiro deu errado',
				})
			}

		await player.save()

		const response = {
			ok: true,
			location: loc.id,
			awarded,
			warnings,
			outcome,
			xpGained,
			money: player.money,
			nerve: player.nerveStats?.nerve || 0,
		}
		if (cooldownSeconds > 0) {
			response.cooldown = {
				secondsLeft: cooldownSeconds,
				endsAt: new Date(Date.now() + cooldownSeconds * 1000).toISOString(),
			}
		}
		return res.json(response)
	} catch (e) {
		return res.status(500).json({ error: e.message })
	}
}

async function getLocations(req, res) {
	try {
		const crime = CRIMES.search_for_cash;
		const allowedIds = Array.isArray(crime.location) ? crime.location : [crime.location].filter(Boolean);
		const hour = new Date().getHours();
		const bucket = hour >= 6 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'afternoon' : hour >= 18 && hour < 22 ? 'evening' : 'night';
		const list = allowedIds
			.map((id) => Object.values(LOCATION || {}).find((l) => l.id === id))
			.filter(Boolean)
			.map((l) => {
				const table = l.PopularityAt || {};
				const perc = Number(table[bucket] || 50);
				const popularity = Math.max(0, Math.min(1, perc / 100));
				return { id: l.id, name: l.name, popularity };
			});
		res.json({ locations: list });
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
}

async function pickpocketCrime(req, res) {
	return handleCrimeAction(req, res, 'pickpocket', async ({ player, body, crime }) => {
		const targetId = body?.targetId;
		const gearId = body?.gearId;
		const crewId = body?.crewId;
		const target = PICKPOCKET_TARGETS.find((t) => t.id === targetId) || PICKPOCKET_TARGETS[0];
		const gear = PICKPOCKET_GEAR.find((g) => g.id === gearId) || PICKPOCKET_GEAR[0];
		const crew = PICKPOCKET_CREW.find((c) => c.id === crewId) || PICKPOCKET_CREW[0];
		if (!target) throw badRequest('Invalid target');
		const bonus = (gear?.bonus || 0) + (crew?.bonus || 0);
		const chance = Math.min(96, target.success + bonus);
		const roll = Math.random() * 100;
		const success = roll < chance;
		if (success) {
			const payout = Math.round(randInt(target.reward[0], target.reward[1]) * (1 + bonus / 45));
			const heat = Math.max(2, 12 - Math.floor(bonus / 2));
			return {
				success: true,
				payout,
				heat,
				details: {
					target: target.name,
					blurb: pick(PICKPOCKET_SUCCESS_BLURBS),
				},
			};
		}
		const critical = roll > chance + 25;
		if (critical) {
			await applyCrimeCriticalFail(player, {
				severity: 'minor',
				locationName: target.name,
				crimeId: crime.id,
				notes: 'Falha crítica em pickpocket',
			})
		}
		return {
			success: false,
			payout: 0,
			heat: 20,
			outcome: critical ? 'critical_fail' : 'minor_fail',
			details: {
				target: target.name,
				blurb: pick(PICKPOCKET_FAIL_BLURBS),
			},
		};
	});
}

async function burglaryCrime(req, res) {
	return handleCrimeAction(req, res, 'burglary', async ({ player, body, crime }) => {
		const estateId = body?.estateId;
		const toolkitId = body?.toolkitId;
		const entryId = body?.entryId;
		const estate = BURGLARY_ESTATES.find((e) => e.id === estateId) || BURGLARY_ESTATES[0];
		const toolkit = BURGLARY_TOOLKITS.find((t) => t.id === toolkitId) || BURGLARY_TOOLKITS[0];
		const entry = BURGLARY_ENTRY_TEAMS.find((e) => e.id === entryId) || BURGLARY_ENTRY_TEAMS[0];
		if (!estate) throw badRequest('Invalid estate');
		const bonus = (toolkit?.bonus || 0) + (entry?.bonus || 0);
		const chance = Math.min(97, estate.success + bonus);
		const roll = Math.random() * 100;
		const success = roll < chance;
		if (success) {
			const payout = randInt(estate.reward[0], estate.reward[1]);
			const heat = Math.max(3, 15 - Math.floor(chance / 10));
			return {
				success: true,
				payout,
				heat,
				details: {
					target: estate.name,
					intel: 'Blueprint ++',
					blurb: pick(BURGLARY_SUCCESS_BLURBS),
				},
			};
		}
		const critical = roll > chance + 20;
		if (critical) {
			await applyCrimeCriticalFail(player, {
				severity: 'major',
				locationName: estate.name,
				crimeId: crime.id,
				notes: 'Invasão fracassou',
			})
		}
		return {
			success: false,
			payout: 0,
			heat: 25,
			outcome: critical ? 'critical_fail' : 'minor_fail',
			details: {
				target: estate.name,
				intel: 'Guards alert',
				blurb: pick(BURGLARY_FAIL_BLURBS),
			},
		};
	});
}

async function smugglingCrime(req, res) {
	return handleCrimeAction(req, res, 'smuggling', async ({ player, body, crime }) => {
		const routeId = body?.routeId;
		const cargoId = body?.cargoId;
		const escortId = body?.escortId;
		const route = SMUGGLING_ROUTES.find((r) => r.id === routeId) || SMUGGLING_ROUTES[0];
		const cargo = SMUGGLING_CARGO.find((c) => c.id === cargoId) || SMUGGLING_CARGO[0];
		const escort = SMUGGLING_ESCORTS.find((e) => e.id === escortId) || SMUGGLING_ESCORTS[0];
		if (!route || !cargo || !escort) throw badRequest('Invalid manifest selection');
		const penalty = Math.round((cargo.capacity || 0) / 5);
		const chance = Math.max(20, Math.min(94, route.success + (escort?.bonus || 0) - penalty));
		const roll = Math.random() * 100;
		const success = roll < chance;
		if (success) {
			const payout = Math.round((cargo.reward || 0) * (0.8 + Math.random() * 0.4));
			const heat = Math.max(5, 20 - Math.floor(chance / 8));
			return {
				success: true,
				payout,
				heat,
				details: {
					route: route.name,
					cargo: cargo.label,
					blurb: pick(SMUGGLING_SUCCESS_BLURBS),
				},
			};
		}
		const critical = roll > chance + 15;
		if (critical) {
			await applyCrimeCriticalFail(player, {
				severity: 'major',
				locationName: route.name,
				crimeId: crime.id,
				notes: 'Contrabando interceptado',
			})
		}
		return {
			success: false,
			payout: 0,
			heat: 35,
			outcome: critical ? 'critical_fail' : 'minor_fail',
			details: {
				route: route.name,
				cargo: cargo.label,
				blurb: pick(SMUGGLING_FAIL_BLURBS),
			},
		};
	});
}

async function listCrimeCatalog(req, res) {
  try {
    const catalog = await getConfig('crimeCatalog')
    const crimes = Array.isArray(catalog?.crimes) ? catalog.crimes : []
    return res.json({ crimes })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Falha ao carregar catálogo de crimes' })
  }
}

module.exports = {
  searchForCash,
  pickpocketCrime,
  burglaryCrime,
  smugglingCrime,
  getLocations,
  listCrimeCatalog,
};
