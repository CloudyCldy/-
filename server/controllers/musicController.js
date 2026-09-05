const musicService = require('../services/musicService');

async function search(req, res) {
  const query = String(req.query.q || '').trim();
  if (!query) return res.status(400).json({ error: 'Escribe una canción o artista.' });
  try {
    res.json(await musicService.search({ query, source: String(req.query.source || 'spotify') }));
  } catch (error) {
    res.status(502).json({ error: error.message || 'No fue posible consultar MusicAPI.' });
  }
}

module.exports = { search };