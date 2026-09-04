const router = require('express').Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { dashboard } = require('../controllers/dashboardController');
router.get('/', requireAuth, dashboard);
module.exports = router;