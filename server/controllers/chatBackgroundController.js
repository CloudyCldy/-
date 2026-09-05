async function upload(req, res) {
  if (!req.file) return res.status(400).json({ error: 'Selecciona una imagen para el fondo.' });
  res.status(201).json({ url: `/uploads/${req.file.filename}` });
}

module.exports = { upload };