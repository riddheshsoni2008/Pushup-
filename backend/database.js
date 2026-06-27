const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'pushups.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    // Create Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        phone_number TEXT,
        daily_target INTEGER DEFAULT 20,
        streak INTEGER DEFAULT 0,
        last_workout_date TEXT
      )
    `);

    // Create Push-up Workout Logs table
    db.run(`
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reps INTEGER NOT NULL,
        posture_score REAL NOT NULL,
        date TEXT DEFAULT (DATE('now', 'localtime'))
      )
    `);

    // Seed default user if not exists
    db.get("SELECT id FROM users WHERE username = 'default'", (err, row) => {
      if (err) {
        console.error('Error querying default user:', err.message);
        return;
      }
      if (!row) {
        db.run(
          "INSERT INTO users (username, phone_number, daily_target, streak) VALUES (?, ?, ?, ?)",
          ['default', '', 20, 0],
          (insertErr) => {
            if (insertErr) {
              console.error('Error seeding default user:', insertErr.message);
            } else {
              console.log('Default user seeded successfully.');
            }
          }
        );
      }
    });
  });
}

module.exports = db;
