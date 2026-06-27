require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { User, Log } = require('./database');

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
app.get('/api/user', async (req, res) => {
  try {
    let user = await User.findOne({ username: 'default' });
    if (!user) {
      // Seed default user if not exists
      user = await User.create({
        username: 'default',
        phone_number: '',
        daily_target: 20,
        streak: 0,
        last_workout_date: null
      });
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
        user.streak = 0;
        await user.save();
      }
    }

    // Get today's total reps to display progress
    const todayLogs = await Log.find({ date: today });
    const repsToday = todayLogs.reduce((sum, log) => sum + log.reps, 0);

    res.json({
      ...user.toObject(),
      streak: currentStreak,
      reps_today: repsToday
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Update user settings (daily target, phone number)
app.put('/api/user', async (req, res) => {
  try {
    const { daily_target, phone_number } = req.body;
    if (daily_target === undefined || isNaN(daily_target)) {
      return res.status(400).json({ error: "Invalid daily target" });
    }

    const user = await User.findOneAndUpdate(
      { username: 'default' },
      { daily_target: Number(daily_target), phone_number: phone_number || '' },
      { new: true, upsert: true }
    );

    res.json({ message: "Settings updated successfully", user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get workout logs
app.get('/api/logs', async (req, res) => {
  try {
    const logs = await Log.find().sort({ date: -1, _id: -1 }).limit(50);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Log a new push-up session
app.post('/api/logs', async (req, res) => {
  try {
    const { reps, posture_score } = req.body;
    if (reps === undefined || posture_score === undefined) {
      return res.status(400).json({ error: "reps and posture_score are required" });
    }

    const today = getLocalDateString();

    // Insert workout log
    await Log.create({ reps, posture_score, date: today });

    // Fetch current user
    let user = await User.findOne({ username: 'default' });
    if (!user) {
      user = await User.create({
        username: 'default',
        phone_number: '',
        daily_target: 20,
        streak: 0,
        last_workout_date: null
      });
    }

    // Sum today's reps
    const todayLogs = await Log.find({ date: today });
    const repsToday = todayLogs.reduce((sum, log) => sum + log.reps, 0);

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

    user.streak = newStreak;
    user.last_workout_date = newLastWorkoutDate;
    await user.save();

    res.json({
      message: "Workout logged successfully",
      reps_today: repsToday,
      streak: newStreak,
      completed_today: repsToday >= dailyTarget
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
