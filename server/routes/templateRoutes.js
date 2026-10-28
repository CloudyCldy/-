const router = require('express').Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { getTemplates } = require('../templates');

router.use(requireAuth);

router.get('/', (req, res) => {
  const type = req.query.type ? String(req.query.type).toLowerCase() : null;
  res.json(getTemplates(type));
});

module.exports = router;
