const router = require('express').Router();
const controller = require('../controllers/callController');
const { requireAuth } = require('../middleware/authMiddleware');

router.use(requireAuth);
router.get('/', controller.list);
router.post('/', controller.create);
router.patch('/:id', controller.update);

module.exports = router;