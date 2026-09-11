const router = require('express').Router();
const controller = require('../controllers/organizationController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
router.post('/register', controller.register);
router.use(requireAuth);
router.get('/current', controller.current);
router.get('/usage', controller.usage);
router.put('/current', requireAdmin, controller.update);
module.exports = router;