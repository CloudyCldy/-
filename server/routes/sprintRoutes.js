const router = require('express').Router();
const controller = require('../controllers/sprintController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

router.use(requireAuth);

router.get('/:id', controller.get);
router.put('/:id', requireRole('admin', 'project_manager'), controller.update);
router.delete('/:id', requireRole('admin', 'project_manager'), controller.remove);
router.post('/:id/start', requireRole('admin', 'project_manager'), controller.start);
router.post('/:id/close', requireRole('admin', 'project_manager'), controller.close);

module.exports = router;
