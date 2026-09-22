const router = require('express').Router();
const controller = require('../controllers/absenceController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

router.use(requireAuth);
router.get('/', controller.list);
router.get('/appeals', requireAdmin, controller.listAppeals);
router.post('/', requireAdmin, controller.create);
router.post('/:id/appeal', controller.appeal);
router.put('/:id/resolve', requireAdmin, controller.resolveAppeal);
router.delete('/:id', requireAdmin, controller.remove);

module.exports = router;
