const router = require('express').Router();
const controller = require('../controllers/fileController');
const upload = require('../middleware/uploadMiddleware');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
router.use(requireAuth); router.get('/', controller.list); router.post('/', requireAdmin, upload.single('file'), controller.upload); router.get('/:id/download', controller.download); router.delete('/:id', requireAdmin, controller.remove);
module.exports = router;