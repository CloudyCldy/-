const router = require('express').Router();
const controller = require('../controllers/callController');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireFeature } = require('../middleware/planMiddleware');

router.use(requireAuth, requireFeature('calls'));
router.get('/', controller.list);
router.post('/', controller.create);
router.patch('/:id', controller.update);

module.exports = router;