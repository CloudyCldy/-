const router = require('express').Router();
const controller = require('../controllers/chatBackgroundController');
const upload = require('../middleware/uploadMiddleware');
const { requireAuth } = require('../middleware/authMiddleware');

router.post('/', requireAuth, upload.imageUpload.single('background'), controller.upload);

module.exports = router;