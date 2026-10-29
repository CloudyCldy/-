const router = require('express').Router({ mergeParams: true });
const controller = require('../controllers/milestoneController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

router.use(requireAuth);

router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', requireRole('admin', 'project_manager'), controller.create);
router.put('/:id', requireRole('admin', 'project_manager'), controller.update);
router.delete('/:id', requireRole('admin', 'project_manager'), controller.remove);

module.exports = router;
