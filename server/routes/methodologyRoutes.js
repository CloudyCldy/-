const router = require('express').Router();
const controller = require('../controllers/methodologyController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

router.use(requireAuth);

router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', requireRole('admin', 'project_manager'), controller.create);
router.put('/projects/:projectId/assign', requireRole('admin', 'project_manager'), controller.assignToProject);

module.exports = router;
