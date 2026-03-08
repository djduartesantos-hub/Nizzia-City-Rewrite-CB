const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authUser');
const {
  searchForCash,
  getLocations,
  pickpocketCrime,
  burglaryCrime,
  smugglingCrime,
} = require('../controllers/crimeController');

router.post('/search-for-cash', requireAuth, searchForCash);
router.post('/pickpocket', requireAuth, pickpocketCrime);
router.post('/burglary', requireAuth, burglaryCrime);
router.post('/smuggling', requireAuth, smugglingCrime);
router.get('/locations', getLocations);

module.exports = router;
