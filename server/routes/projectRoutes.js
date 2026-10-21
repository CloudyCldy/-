const router = require('express').Router();
const controller = require('../controllers/projectController');
const taskController = require('../controllers/taskController');
const sprintController = require('../controllers/sprintController');
const milestoneController = require('../controllers/milestoneController');
const riskController = require('../controllers/riskController');
const issueController = require('../controllers/issueController');
const methodologyController = require('../controllers/methodologyController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { checkProjectLimit } = require('../middleware/planMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(requireAuth);
router.get('/', controller.list);
router.get('/:id', controller.get);
router.get('/:id/overview', controller.overview);
router.post('/:id/sync', requireRole('admin', 'project_manager'), controller.sync);
router.get('/:id/intelligence', controller.intelligence);
router.post('/', requireRole('admin', 'project_manager'), checkProjectLimit, controller.create);
router.put('/:id', requireRole('admin', 'project_manager'), controller.update);
router.get('/:id/members', controller.members);
router.post('/:id/members', requireRole('admin', 'project_manager'), controller.addMember);
router.delete('/:id/members/:userId', requireRole('admin', 'project_manager'), controller.removeMember);

router.get('/:id/tasks', taskController.listByProject);
router.post('/:id/tasks', requireRole('admin', 'project_manager', 'member'), upload.imageUpload.single('image'), taskController.create);
router.get('/:id/sprints', sprintController.listByProject);
router.post('/:id/sprints', requireRole('admin', 'project_manager'), sprintController.create);
router.get('/:id/milestones', milestoneController.list);
router.post('/:id/milestones', requireRole('admin', 'project_manager'), milestoneController.create);
router.get('/:id/risks', riskController.list);
router.post('/:id/risks', requireRole('admin', 'project_manager'), riskController.create);
router.get('/:id/issues', issueController.list);
router.post('/:id/issues', requireRole('admin', 'project_manager', 'member'), issueController.create);

router.put('/:id/methodology', requireRole('admin', 'project_manager'), methodologyController.assignToProject);

module.exports = router;