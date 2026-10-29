const router = require('express').Router();
const controller = require('../controllers/backlogController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

router.use(requireAuth);
router.get('/', controller.list);
router.post('/', requireRole('admin', 'project_manager'), controller.create);
router.put('/:id', controller.update);
router.delete('/:id', requireRole('admin', 'project_manager'), controller.remove);

module.exports = router;