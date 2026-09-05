const router = require('express').Router();
const controller = require('../controllers/musicController');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/search', requireAuth, controller.search);

module.exports = router;