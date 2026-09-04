const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const allowed = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'zip', 'png', 'jpg', 'jpeg']);
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads'),
  filename: (req, file, callback) => callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).slice(1).toLowerCase();
    if (!allowed.has(extension)) return callback(new Error('El archivo no es válido.'));
    callback(null, true);
  }
});
module.exports = upload;