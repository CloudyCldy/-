const router = require('express').Router();
const controller = require('../controllers/taskController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
router.use(requireAuth); router.get('/', controller.list); router.get('/:id', controller.get); router.post('/', requireRole('admin', 'project_manager', 'member'), controller.create); router.put('/:id', requireRole('admin', 'project_manager', 'member'), controller.update); router.patch('/:id/status', controller.status); router.delete('/:id', requireRole('admin', 'project_manager'), controller.remove);
module.exports = router;