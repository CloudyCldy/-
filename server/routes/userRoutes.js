const router = require('express').Router();
const controller = require('../controllers/userController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
const { checkUserLimit } = require('../middleware/planMiddleware');
const upload = require('../middleware/uploadMiddleware');
router.use(requireAuth); router.get('/', controller.list); router.put('/me/profile', upload.imageUpload.single('photo'), controller.profile); router.get('/:id/profile-photo', controller.profilePhoto); router.post('/', requireAdmin, checkUserLimit, controller.create); router.put('/:id', requireAdmin, controller.update); router.delete('/:id', requireAdmin, controller.remove);
module.exports = router;