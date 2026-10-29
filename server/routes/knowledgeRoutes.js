const router = require('express').Router();
const controller = require('../controllers/knowledgeController');
const { requireAuth } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(requireAuth);
router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', upload.single('file'), controller.upload);
router.post('/:id/associate', controller.associate);
router.delete('/:id/associate', controller.removeAssociation);

module.exports = router;
