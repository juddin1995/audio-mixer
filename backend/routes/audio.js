const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const audioCtrl = require("../controllers/audio");
const ensureLoggedIn = require("../middleware/ensureLoggedIn");

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "..", "uploads"));
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}${ext}`;
    cb(null, name);
  },
});
const upload = multer({ storage });

// Upload original audio (no auth required in this example, adjust as needed)
router.post(
  "/upload-original",
  upload.single("file"),
  audioCtrl.uploadOriginal
);

// Upload mixed/ad-libbed audio (require logged in user)
router.post(
  "/upload-mixed",
  ensureLoggedIn,
  upload.single("file"),
  audioCtrl.uploadMixed
);

module.exports = router;
