const { mixWithFfmpeg } = require("../services/audioMixService.js");
const fs = require("fs");

exports.mixAudio = async (req, res) => {
  try {
    console.log('Mix request received');
    console.log('Files:', req.files);
    
    if (!req.files || !req.files.original || !req.files.mic) {
      return res.status(400).json({ error: "Missing files. Need both 'original' and 'mic' files." });
    }

    const original = req.files.original[0];
    const mic = req.files.mic[0];

    console.log('Original file:', original.originalname, original.size, 'bytes', original.path);
    console.log('Mic file:', mic.originalname, mic.size, 'bytes', mic.path);

    // Check if files are empty
    if (original.size === 0) {
      return res.status(400).json({ error: "Original file is empty (0 bytes)" });
    }
    if (mic.size === 0) {
      return res.status(400).json({ error: "Mic/recording file is empty (0 bytes)" });
    }

    // Verify files exist on disk
    if (!fs.existsSync(original.path)) {
      return res.status(400).json({ error: "Original file not found on server" });
    }
    if (!fs.existsSync(mic.path)) {
      return res.status(400).json({ error: "Mic file not found on server" });
    }

    const outputPath = await mixWithFfmpeg(original.path, mic.path);

    // Verify output file exists and has content
    if (!fs.existsSync(outputPath)) {
      return res.status(500).json({ error: "Mixed audio file was not created" });
    }

    const stats = fs.statSync(outputPath);
    console.log('Output file created:', outputPath, stats.size, 'bytes');

    if (stats.size === 0) {
      return res.status(500).json({ error: "Mixed audio file is empty" });
    }

    res.download(outputPath, (err) => {
      if (err) {
        console.error('Download error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to send file" });
        }
      } else {
        // Clean up uploaded files after successful download
        fs.unlink(original.path, () => {});
        fs.unlink(mic.path, () => {});
      }
    });
  } catch (err) {
    console.error('Mix error:', err);
    res.status(500).json({ error: "Audio mix failed", details: err.message });
  }
};

