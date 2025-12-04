const { db } = require("../db");

class MixedFile {
  constructor({ id, originalFiles, duration, path, size, createdAt }) {
    this.id = id;
    this.originalFiles = originalFiles || [];
    this.duration = duration || null;
    this.path = path;
    this.size = size || null;
    this.createdAt = createdAt || new Date().toISOString();
  }

  static create({ id, originalFiles, duration, path, size }) {
    const createdAt = new Date().toISOString();
    const originalFilesJson = JSON.stringify(originalFiles || []);
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO mixed_files (id, original_files, duration, path, size, created_at) VALUES (?, ?, ?, ?, ?, ?)`;
      db.run(
        sql,
        [id, originalFilesJson, duration, path, size, createdAt],
        function (err) {
          if (err) return reject(err);
          resolve(
            new MixedFile({
              id,
              originalFiles,
              duration,
              path,
              size,
              createdAt,
            })
          );
        }
      );
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM mixed_files WHERE id = ?`;
      db.get(sql, [id], (err, row) => {
        if (err) return reject(err);
        if (!row) return resolve(null);
        resolve(
          new MixedFile({
            id: row.id,
            originalFiles: JSON.parse(row.original_files),
            duration: row.duration,
            path: row.path,
            size: row.size,
            createdAt: row.created_at,
          })
        );
      });
    });
  }

  static all() {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM mixed_files ORDER BY created_at DESC`;
      db.all(sql, [], (err, rows) => {
        if (err) return reject(err);
        resolve(
          rows.map(
            (row) =>
              new MixedFile({
                id: row.id,
                originalFiles: JSON.parse(row.original_files),
                duration: row.duration,
                path: row.path,
                size: row.size,
                createdAt: row.created_at,
              })
          )
        );
      });
    });
  }

  static delete(id) {
    return new Promise((resolve, reject) => {
      const sql = `DELETE FROM mixed_files WHERE id = ?`;
      db.run(sql, [id], function (err) {
        if (err) return reject(err);
        resolve(this.changes > 0);
      });
    });
  }

  toJSON() {
    return {
      id: this.id,
      originalFiles: this.originalFiles,
      duration: this.duration,
      path: this.path,
      size: this.size,
      createdAt: this.createdAt,
    };
  }
}

module.exports = MixedFile;
