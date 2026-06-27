const mongoose = require('mongoose');

const mongoURI = process.env.MONGODB_URI;

if (!mongoURI) {
  console.error("Error: MONGODB_URI environment variable is not defined in .env file.");
  process.exit(1);
}

mongoose.connect(mongoURI)
  .then(() => console.log('Connected to MongoDB Atlas successfully!'))
  .catch((err) => {
    console.error('Error connecting to MongoDB Atlas:', err.message);
  });

// Helper function to get local date string YYYY-MM-DD
function getLocalDateString() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const localDate = new Date(d.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
}

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, default: 'default' },
  phone_number: { type: String, default: '' },
  daily_target: { type: Number, default: 20 },
  streak: { type: Number, default: 0 },
  last_workout_date: { type: String, default: null }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

const logSchema = new mongoose.Schema({
  reps: { type: Number, required: true },
  posture_score: { type: Number, required: true },
  date: { type: String, default: getLocalDateString }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

const User = mongoose.model('User', userSchema);
const Log = mongoose.model('Log', logSchema);

module.exports = {
  User,
  Log,
  mongoose
};
