const router = require('express').Router();
const controller = require('../controllers/taskController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
router.use(requireAuth); router.get('/', controller.list); router.get('/:id', controller.get); router.post('/', requireAdmin, controller.create); router.put('/:id', requireAdmin, controller.update); router.patch('/:id/status', controller.status); router.delete('/:id', requireAdmin, controller.remove);
module.exports = router;