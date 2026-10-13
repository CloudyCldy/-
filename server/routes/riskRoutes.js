const router = require('express').Router();
const controller = require('../controllers/riskController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

router.use(requireAuth);
router.get('/', controller.list);
router.get('/overview', controller.overview);
router.get('/workload', controller.workload);
router.post('/', requireRole('admin', 'project_manager', 'member'), controller.create);
router.put('/:id', requireRole('admin', 'project_manager', 'member'), controller.update);
router.delete('/:id', requireRole('admin', 'project_manager'), controller.remove);

module.exports = router;
