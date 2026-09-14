const router = require('express').Router();
const controller = require('../controllers/incidenceController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

router.use(requireAuth);
router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', controller.create);
router.patch('/:id/status', controller.updateStatus);
router.post('/:id/appeal', controller.appeal);

module.exports = router;
