const router = require('express').Router();
const controller = require('../controllers/userController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
router.use(requireAuth); router.get('/', controller.list); router.put('/me/profile', upload.imageUpload.single('photo'), controller.profile); router.post('/', requireAdmin, controller.create); router.put('/:id', requireAdmin, controller.update); router.delete('/:id', requireAdmin, controller.remove);
module.exports = router;