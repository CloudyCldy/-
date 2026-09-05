const router = require('express').Router();
const controller = require('../controllers/messageController');
const { requireAuth } = require('../middleware/authMiddleware');

router.use(requireAuth);
router.get('/', controller.list);
router.post('/', controller.create);
router.delete('/conversation/:userId', controller.removeConversation);

module.exports = router;