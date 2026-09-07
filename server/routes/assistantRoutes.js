const router = require('express').Router();
const { requireAdmin } = require('../middleware/authMiddleware');
const controller = require('../controllers/assistantController');

router.post('/chat', requireAdmin, controller.chat);

module.exports = router;