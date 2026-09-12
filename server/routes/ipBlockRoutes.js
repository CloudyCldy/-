const router = require('express').Router();
const controller = require('../controllers/ipBlockController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
router.use(requireAuth, requireAdmin);
router.get('/', controller.list);
router.post('/', controller.create);
router.delete('/:id', controller.remove);
module.exports = router;
