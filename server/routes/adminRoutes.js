const router = require('express').Router();
const controller = require('../controllers/adminController');
const { requireAuth, requirePlatformAdmin } = require('../middleware/authMiddleware');

router.use(requireAuth);
router.use(requirePlatformAdmin);

router.get('/organizations', controller.listOrganizations);
router.post('/organizations/:id/verify', controller.verifyOrganization);
router.post('/organizations/:id/official-check', controller.officialCheck);
router.get('/audit-logs', controller.auditLogs);

module.exports = router;
