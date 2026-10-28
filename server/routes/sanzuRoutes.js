const router = require('express').Router();
const controller = require('../controllers/sanzuController');
const { requireAuth, requireAdmin, requirePermission } = require('../middleware/authMiddleware');

router.use(requireAuth);
router.get('/status', requirePermission('integrations:manage'), controller.status);
router.post('/configure', requireAdmin, requirePermission('integrations:manage'), controller.configure);
router.post('/test', requireAdmin, requirePermission('integrations:manage'), controller.test);

module.exports = router;
