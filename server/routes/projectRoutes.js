const router = require('express').Router();
const controller = require('../controllers/projectController');
const taskController = require('../controllers/taskController');
const sprintController = require('../controllers/sprintController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { checkProjectLimit } = require('../middleware/planMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(requireAuth);
router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', requireRole('admin', 'project_manager'), checkProjectLimit, controller.create);
router.put('/:id', requireRole('admin', 'project_manager'), controller.update);
router.get('/:id/members', controller.members);
router.post('/:id/members', requireRole('admin', 'project_manager'), controller.addMember);
router.delete('/:id/members/:userId', requireRole('admin', 'project_manager'), controller.removeMember);

router.get('/:id/tasks', taskController.listByProject);
router.post('/:id/tasks', requireRole('admin', 'project_manager', 'member'), upload.imageUpload.single('image'), taskController.create);
router.get('/:id/sprints', sprintController.listByProject);
router.post('/:id/sprints', requireRole('admin', 'project_manager'), sprintController.create);

module.exports = router;