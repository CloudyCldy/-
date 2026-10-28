const router = require('express').Router();
const controller = require('../controllers/userController');
const { requireAuth, requirePermission } = require('../middleware/authMiddleware');
const { checkUserLimit } = require('../middleware/planMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(requireAuth);
router.get('/', controller.list);
router.put('/me/profile', upload.imageUpload.single('photo'), controller.profile);
router.delete('/me', controller.deleteMe);
router.get('/:id/profile-photo', controller.profilePhoto);

router.post('/', requirePermission('company:manage_members'), checkUserLimit, controller.create);
router.put('/:id', requirePermission('company:manage_members'), controller.update);
router.delete('/:id', requirePermission('company:manage_members'), controller.remove);

module.exports = router;
