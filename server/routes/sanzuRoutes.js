const router = require('express').Router();
const controller = require('../controllers/sanzuController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

router.use(requireAuth);
router.get('/status', controller.status);
router.post('/configure', requireAdmin, controller.configure);
router.post('/test', requireAdmin, controller.test);

module.exports = router;
