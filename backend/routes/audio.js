const express = require("express");
const multer = require("multer");
const path = require("path");
const { mixAudio } = require("../controllers/audioController");

const router = express.Router();

// Configure multer with better file handling
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../uploads/"));
  },
  filename: function (req, file, cb) {
    // Preserve original extension if available
    const ext = path.extname(file.originalname) || '';
    cb(null, `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

router.post(
  "/mix",
  upload.fields([
    { name: "original", maxCount: 1 },
    { name: "mic", maxCount: 1 },
  ]),
  mixAudio
);

module.exports = router;

