const express = require('express');
const router = express.Router();
const { bootstrapRole } = require('../controllers/bootstrapController');

router.post('/role', express.json(), bootstrapRole);

module.exports = router;
