const router = require('express').Router();
const controller = require('../controllers/notificationController');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/', requireAuth, controller.list);

module.exports = router;