const express = require('express')
const { listPrisoners, attemptBreakout, payBail, listPrisonEvents } = require('../controllers/prisonController')

const router = express.Router()

router.get('/prisoners', listPrisoners)
router.post('/prison/assist', attemptBreakout)
router.post('/prison/bail', payBail)
router.get('/prison/events', listPrisonEvents)

module.exports = router
