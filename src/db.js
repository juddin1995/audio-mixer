const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();

const DB_PATH = path.resolve(__dirname, "..", "data", "audio.sqlite");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new sqlite3.Database(DB_PATH);

function init() {
  // create table if missing
  const sql = `
	CREATE TABLE IF NOT EXISTS mixed_files (
		id TEXT PRIMARY KEY,
		original_files TEXT NOT NULL,
		duration INTEGER,
		path TEXT NOT NULL,
		size INTEGER,
		created_at TEXT NOT NULL
	);
	`;
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => (err ? reject(err) : resolve()));
  });
}

module.exports = { db, init };
