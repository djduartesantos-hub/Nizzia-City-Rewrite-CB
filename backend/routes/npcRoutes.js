const express = require('express')
const router = express.Router()
const npcController = require('../controllers/npcController')
const { requireAuth } = require('../middleware/authUser')

router.get('/list', npcController.list)
router.get('/feed/:cityId', npcController.feed)
router.get('/:id', npcController.detail)

router.post('/:id/interact', requireAuth, npcController.interact)
router.get('/:id/memory/:playerId', requireAuth, npcController.memory)
router.post('/:id/hospital/help', requireAuth, npcController.hospitalHelp)
router.post('/:id/hospital/sabotage', requireAuth, npcController.hospitalSabotage)
router.post('/:id/prison/pay-bail', requireAuth, npcController.prisonPayBail)
router.post('/:id/injure', requireAuth, npcController.injure)
router.post('/:id/arrest', requireAuth, npcController.arrest)
router.post('/event', requireAuth, npcController.triggerEvent)

module.exports = router
