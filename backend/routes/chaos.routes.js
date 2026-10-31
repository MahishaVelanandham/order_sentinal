const express = require('express');
const router = express.Router();
const { getChaosStatus, updateChaosRules, resetChaosRules } = require('../controllers/chaos.controller');

router.get('/', getChaosStatus);
router.post('/inject', updateChaosRules);
router.post('/reset', resetChaosRules);

module.exports = router;
