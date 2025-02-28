const fs = require("fs");
const path = require("path");

exports.deleteFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error("Error deleting file:", err);
      } else {
        console.log("File deleted:", filePath);
      }
    });
  }
};
