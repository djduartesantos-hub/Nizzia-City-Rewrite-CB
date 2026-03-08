const mongoose = require('mongoose')
const cron = require('node-cron')
const {
  processNPCRoutines,
  checkAndResumeRoutines,
  generateAutonomousActivity,
  cleanOldActivityLogs,
  resetDailyNPCStats,
} = require('../services/npcWorldService')

const ts = () => `[${new Date().toTimeString().slice(0, 8)}]`

function isReady() {
  return mongoose.connection.readyState === 1
}

function scheduleNpcWorld() {
  // Every 15 minutes: movement and routine updates
  cron.schedule('*/15 * * * *', async () => {
    try {
      if (!isReady()) return
      const [routine, recovery] = await Promise.all([
        processNPCRoutines(),
        checkAndResumeRoutines(),
      ])
      console.log(
        `${ts()} [npc-world] routines=${routine.processed} recovered=${recovery.recovered} released=${recovery.released}`
      )
    } catch (e) {
      console.error('[npc-world] routine tick error:', e.message)
    }
  })

  // Every 30 minutes: autonomous city activity
  cron.schedule('*/30 * * * *', async () => {
    try {
      if (!isReady()) return
      const r = await generateAutonomousActivity()
      const totalTriggered = (r.cities || []).reduce((sum, c) => sum + Number(c.triggered || 0), 0)
      console.log(`${ts()} [npc-world] autonomous events=${totalTriggered} cities=${(r.cities || []).length}`)
    } catch (e) {
      console.error('[npc-world] autonomous tick error:', e.message)
    }
  })

  // Daily cleanup + reset at 03:00
  cron.schedule('0 3 * * *', async () => {
    try {
      if (!isReady()) return
      const [cleaned, reset] = await Promise.all([
        cleanOldActivityLogs(14),
        resetDailyNPCStats(),
      ])
      console.log(`${ts()} [npc-world] cleanup events=${cleaned.deletedEvents} reset=${reset.reset}`)
    } catch (e) {
      console.error('[npc-world] daily tick error:', e.message)
    }
  })

  console.log(`${ts()} NPC world cron jobs scheduled (15m, 30m, daily 03:00)`)
}

module.exports = scheduleNpcWorld
