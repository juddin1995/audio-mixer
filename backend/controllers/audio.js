const path = require("path");
const fs = require("fs");

// Save metadata or additional processing could go here
exports.uploadOriginal = function (req, res) {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });
  const url = `/uploads/${req.file.filename}`;
  return res.json({ url, filename: req.file.filename });
};

exports.uploadMixed = function (req, res) {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });
  const url = `/uploads/${req.file.filename}`;
  // In a real app you might create a DB record linking to the original
  return res.json({ url, filename: req.file.filename });
};
