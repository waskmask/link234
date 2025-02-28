const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

// Define storage engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const monthYear = new Date()
      .toLocaleString("en-us", { month: "2-digit", year: "numeric" })
      .replace("/", "-");

    const dir = path.join(__dirname, "..", "uploads", monthYear, "images");

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const fileExt = path.extname(file.originalname);
    const filename = `${timestamp}${fileExt}`;
    cb(null, filename);
  },
});

// Multer single file upload middleware
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"), false);
    }
  },
});

// Resize image and convert to WebP
const resizeImage = async (inputPath, outputPath) => {
  try {
    const tempOutputPath = `${outputPath}-temp.webp`;

    const image = sharp(inputPath);

    // Get metadata to check the image dimensions
    const metadata = await image.metadata();

    if (metadata.width > 800) {
      // If the image width is greater than 800px, resize it and save to a temporary path
      await image.resize(800).webp().toFile(tempOutputPath);
    } else {
      // If the image width is <= 800px, just convert to WebP and save to a temporary path
      await image.webp().toFile(tempOutputPath);
    }

    // Replace the original file with the resized one
    fs.renameSync(tempOutputPath, outputPath);
  } catch (error) {
    console.error("Error resizing image:", error);
  }
};

// Delete file function
const deleteFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error("Error deleting file:", error);
  }
};

module.exports = { upload, resizeImage, deleteFile };
