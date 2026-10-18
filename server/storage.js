const fs = require('fs');
const path = require('path');

const uploadsDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

function ensureSubmissionsDir() {
  fs.mkdirSync(path.join(uploadsDir, 'submissions'), { recursive: true });
}

function saveUploadedFile(file, subdir = 'submissions') {
  ensureSubmissionsDir();
  const targetDir = path.join(uploadsDir, subdir);
  fs.mkdirSync(targetDir, { recursive: true });

  const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
  const finalPath = path.join(targetDir, safeName);
  fs.writeFileSync(finalPath, file.buffer);
  return {
    fileName: safeName,
    storagePath: finalPath,
    publicUrl: `/uploads/${subdir}/${safeName}`
  };
}

module.exports = { saveUploadedFile, uploadsDir };
