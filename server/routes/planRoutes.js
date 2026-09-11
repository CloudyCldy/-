const router = require('express').Router();
const controller = require('../controllers/planController');

router.get('/', controller.list);

module.exports = router;