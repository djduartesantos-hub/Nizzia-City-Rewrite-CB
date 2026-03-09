const express = require('express')
const { getPublicCityEvents } = require('../controllers/worldAdminController')

const router = express.Router()

router.get('/:seed/events', getPublicCityEvents)

module.exports = router
