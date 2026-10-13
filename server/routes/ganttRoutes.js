const router = require('express').Router();
const controller = require('../controllers/ganttController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const multer = require('multer');
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

router.use(requireAuth);

router.get('/', controller.getGanttData);
router.post('/dependencies', requireRole('admin', 'project_manager', 'member'), controller.createDependency);
router.delete('/dependencies/:id', requireRole('admin', 'project_manager', 'member'), controller.deleteDependency);
router.post('/baseline', requireRole('admin', 'project_manager'), controller.saveBaseline);
router.post('/auto-schedule', requireRole('admin', 'project_manager', 'member'), controller.autoSchedule);

router.get('/export/gan', controller.exportGanttProjectGan);
router.get('/export/csv', controller.exportGanttCsv);
router.post('/import/gan', requireRole('admin', 'project_manager', 'member'), upload.single('file'), controller.importGanttProjectGan);

module.exports = router;
