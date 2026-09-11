const router = require('express').Router();
const controller = require('../controllers/projectController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { checkProjectLimit } = require('../middleware/planMiddleware');
router.use(requireAuth); router.get('/', controller.list); router.get('/:id', controller.get); router.post('/', requireRole('admin', 'project_manager'), checkProjectLimit, controller.create); router.put('/:id', requireRole('admin', 'project_manager'), controller.update); router.get('/:id/members', controller.members); router.post('/:id/members', requireRole('admin', 'project_manager'), controller.addMember); router.delete('/:id/members/:userId', requireRole('admin', 'project_manager'), controller.removeMember);
module.exports = router;