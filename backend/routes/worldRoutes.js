const express = require('express')
const { listPrisoners, attemptBreakout, payBail, listPrisonEvents } = require('../controllers/prisonController')
const { listPatients, treatPatient, revivePatient, listHospitalEvents } = require('../controllers/hospitalController')

const router = express.Router()

router.get('/prisoners', listPrisoners)
router.post('/prison/assist', attemptBreakout)
router.post('/prison/bail', payBail)
router.get('/prison/events', listPrisonEvents)

router.get('/patients', listPatients)
router.post('/hospital/treat', treatPatient)
router.post('/hospital/revive', revivePatient)
router.get('/hospital/events', listHospitalEvents)

module.exports = router
