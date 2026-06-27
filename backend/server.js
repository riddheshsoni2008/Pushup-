const express = require('express');
const cors = require('cors');
const db = require('./database');
const { getWhatsAppStatus, sendWhatsAppMessage } = require('./whatsapp');
const { checkAndSendReminders } = require('./cron');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Helper function to get local date string YYYY-MM-DD
function getLocalDateString() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const localDate = new Date(d.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
}

// 1. Get user configuration & current status
app.get('/api/user', (req, res) => {
  db.get("SELECT * FROM users WHERE username = 'default'", (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if streak is broken (i.e. more than 1 day has passed since last workout)
    const today = getLocalDateString();
    let currentStreak = user.streak;

    if (user.last_workout_date) {
      const lastDate = new Date(user.last_workout_date);
      const todayDate = new Date(today);
      const diffTime = Math.abs(todayDate - lastDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 1 && user.last_workout_date !== today) {
        // Streak is broken! Reset it to 0
        currentStreak = 0;
        db.run("UPDATE users SET streak = 0 WHERE username = 'default'");
      }
    }

    // Get today's total reps to display progress
    db.get(
      "SELECT SUM(reps) as total_reps FROM logs WHERE date = (DATE('now', 'localtime'))",
      (errLogs, rowLogs) => {
        if (errLogs) {
          return res.status(500).json({ error: errLogs.message });
        }
        res.json({
          ...user,
          streak: currentStreak,
          reps_today: rowLogs.total_reps || 0
        });
      }
    );
  });
});

// 2. Update user settings (daily target, phone number)
app.put('/api/user', (req, res) => {
  const { daily_target, phone_number } = req.body;
  if (!daily_target || isNaN(daily_target)) {
    return res.status(400).json({ error: "Invalid daily target" });
  }

  db.run(
    "UPDATE users SET daily_target = ?, phone_number = ? WHERE username = 'default'",
    [daily_target, phone_number || ''],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: "Settings updated successfully" });
    }
  );
});

// 3. Get workout logs
app.get('/api/logs', (req, res) => {
  db.all("SELECT * FROM logs ORDER BY date DESC, id DESC LIMIT 50", (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// 4. Log a new push-up session
app.post('/api/logs', (req, res) => {
  const { reps, posture_score } = req.body;
  if (reps === undefined || posture_score === undefined) {
    return res.status(400).json({ error: "reps and posture_score are required" });
  }

  const today = getLocalDateString();

  db.serialize(() => {
    // Insert workout log
    db.run(
      "INSERT INTO logs (reps, posture_score) VALUES (?, ?)",
      [reps, posture_score],
      function (errLog) {
        if (errLog) {
          return res.status(500).json({ error: errLog.message });
        }

        // Fetch current user and sum of today's reps
        db.get("SELECT * FROM users WHERE username = 'default'", (errUser, user) => {
          if (errUser || !user) {
            return res.status(500).json({ error: "Failed to fetch user state" });
          }

          db.get(
            "SELECT SUM(reps) as total_reps FROM logs WHERE date = (DATE('now', 'localtime'))",
            (errSum, sumRow) => {
              if (errSum) {
                return res.status(500).json({ error: "Failed to sum reps" });
              }

              const repsToday = sumRow.total_reps || 0;
              const dailyTarget = user.daily_target;
              let newStreak = user.streak;
              let newLastWorkoutDate = user.last_workout_date;

              // Check if we hit the daily target with this workout
              // Only update streak if we haven't already locked in the streak for today
              if (repsToday >= dailyTarget && user.last_workout_date !== today) {
                if (user.last_workout_date) {
                  const lastDate = new Date(user.last_workout_date);
                  const todayDate = new Date(today);
                  const diffTime = Math.abs(todayDate - lastDate);
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                  if (diffDays === 1) {
                    // Completed on consecutive day: increment streak
                    newStreak += 1;
                  } else {
                    // Streak was broken or first time: reset to 1
                    newStreak = 1;
                  }
                } else {
                  // No previous workout: start streak at 1
                  newStreak = 1;
                }
                newLastWorkoutDate = today;
              }

              db.run(
                "UPDATE users SET streak = ?, last_workout_date = ? WHERE username = 'default'",
                [newStreak, newLastWorkoutDate],
                (updateErr) => {
                  if (updateErr) {
                    return res.status(500).json({ error: updateErr.message });
                  }
                  res.json({
                    message: "Workout logged successfully",
                    reps_today: repsToday,
                    streak: newStreak,
                    completed_today: repsToday >= dailyTarget
                  });
                }
              );
            }
          );
        });
      }
    );
  });
});

// 5. Get automated WhatsApp connection status & QR code
app.get('/api/whatsapp/status', (req, res) => {
  try {
    const statusInfo = getWhatsAppStatus();
    res.json(statusInfo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Manually trigger automatic reminder check (For testing)
app.post('/api/whatsapp/test', async (req, res) => {
  try {
    await checkAndSendReminders();
    res.json({ message: "Automated progress checked and reminders sent if target was incomplete." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
