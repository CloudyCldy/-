const router = require('express').Router();
const controller = require('../controllers/absenceController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

router.use(requireAuth);
router.get('/', controller.list);
router.post('/', requireAdmin, controller.create);
router.delete('/:id', requireAdmin, controller.remove);

module.exports = router;