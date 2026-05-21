import express from 'express';
import cors from 'cors';

import healthRoutes from './routes/healthRoutes.js';
import userRoutes from './routes/userRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import summaryRoutes from './routes/summaryRoutes.js';
import memoryRoutes from './routes/memoryRoutes.js';
import notFound from './middleware/notFound.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/health', healthRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/summaries', summaryRoutes);
app.use('/api/memory', memoryRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
