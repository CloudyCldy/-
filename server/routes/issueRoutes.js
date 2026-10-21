const router = require('express').Router();
const controller = require('../controllers/issueController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

router.use(requireAuth);

router.get('/', controller.list);
router.get('/:id', controller.get);

// Members and PMs/Admins can report issues; Viewers are read-only (403)
router.post('/', requireRole('admin', 'project_manager', 'member'), controller.create);
router.put('/:id', requireRole('admin', 'project_manager', 'member'), controller.update);
router.delete('/:id', requireRole('admin', 'project_manager'), controller.remove);

module.exports = router;
