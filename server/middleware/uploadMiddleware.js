const multer = require('multer');
const path = require('path');

const allowed = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'zip', 'png', 'jpg', 'jpeg']);
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).slice(1).toLowerCase();
    if (!allowed.has(extension)) return callback(new Error('El archivo no es válido.'));
    callback(null, true);
  }
});
const imageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).slice(1).toLowerCase();
    if (!new Set(['png', 'jpg', 'jpeg', 'webp']).has(extension)) return callback(new Error('La foto debe ser PNG, JPG o WEBP.'));
    callback(null, true);
  }
});
module.exports = upload;
module.exports.imageUpload = imageUpload;