import './config/env.js';
import connectDB from './config/db.js';
import app from './app.js';
import { startEvaluationWorker } from './evaluation/sessionJobs.js';

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    startEvaluationWorker();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to database:', err);
    process.exit(1);
  });
