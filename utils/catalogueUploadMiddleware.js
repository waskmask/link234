const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Configure multer storage with dynamic path based on month-year
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const date = new Date();
    const monthYear = `${date.getMonth() + 1}-${date.getFullYear()}`;
    const dir = path.join(__dirname, "..", "catalogues", monthYear);

    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${timestamp}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedExtensions = [".pdf", ".jpg", ".jpeg", ".png"];
  const extension = path.extname(file.originalname).toLowerCase();

  if (allowedExtensions.includes(extension)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only PDF, JPG, and PNG are allowed."));
  }
};
const multerErrorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // Multer-specific errors
    return res.status(400).json({ message: err.message });
  } else if (err) {
    // File filter errors or other errors
    return res.status(400).json({ message: err.message });
  }
  next();
};
// Multer middleware
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  multerErrorHandler: multerErrorHandler,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
});

module.exports = upload;
