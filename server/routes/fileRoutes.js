const router = require('express').Router();
const controller = require('../controllers/fileController');
const upload = require('../middleware/uploadMiddleware');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
const { checkStorageLimit } = require('../middleware/planMiddleware');
router.use(requireAuth); router.get('/', controller.list); router.post('/', upload.single('file'), checkStorageLimit, controller.upload); router.get('/:id/view', controller.view); router.get('/:id/download', controller.download); router.delete('/:id', requireAdmin, controller.remove);
module.exports = router;