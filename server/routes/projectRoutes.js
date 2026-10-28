const router = require('express').Router();
const controller = require('../controllers/projectController');
const taskController = require('../controllers/taskController');
const sprintController = require('../controllers/sprintController');
const milestoneController = require('../controllers/milestoneController');
const riskController = require('../controllers/riskController');
const issueController = require('../controllers/issueController');
const methodologyController = require('../controllers/methodologyController');
const { requireAuth, requireRole, requirePermission } = require('../middleware/authMiddleware');
const { checkProjectLimit } = require('../middleware/planMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(requireAuth);
router.get('/', requirePermission('projects:read'), controller.list);
router.get('/:id', requirePermission('projects:read'), controller.get);
router.get('/:id/overview', requirePermission('projects:read'), controller.overview);
router.post('/:id/sync', requirePermission('analysis:run'), controller.sync);
router.get('/:id/intelligence', requirePermission('analysis:run'), controller.intelligence);
router.post('/', requirePermission('projects:create'), checkProjectLimit, controller.create);
router.put('/:id', requirePermission('projects:update'), controller.update);
router.get('/:id/members', requirePermission('projects:read'), controller.members);
router.post('/:id/members', requirePermission('projects:update'), controller.addMember);
router.delete('/:id/members/:userId', requirePermission('projects:update'), controller.removeMember);

router.get('/:id/tasks', requirePermission('projects:read'), taskController.listByProject);
router.post('/:id/tasks', requireRole('admin', 'company_admin', 'project_manager', 'member'), upload.imageUpload.single('image'), taskController.create);
router.get('/:id/sprints', requirePermission('projects:read'), sprintController.listByProject);
router.post('/:id/sprints', requireRole('admin', 'company_admin', 'project_manager'), sprintController.create);
router.get('/:id/milestones', requirePermission('projects:read'), milestoneController.list);
router.post('/:id/milestones', requireRole('admin', 'company_admin', 'project_manager'), milestoneController.create);
router.get('/:id/risks', requirePermission('projects:read'), riskController.list);
router.post('/:id/risks', requireRole('admin', 'company_admin', 'project_manager'), riskController.create);
router.get('/:id/issues', requirePermission('projects:read'), issueController.list);
router.post('/:id/issues', requireRole('admin', 'company_admin', 'project_manager', 'member'), issueController.create);

router.put('/:id/methodology', requirePermission('projects:update'), methodologyController.assignToProject);

module.exports = router;
