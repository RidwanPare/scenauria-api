// Express 5 — handlers async gérés nativement (pas besoin de wrapper try/catch pour propager vers errorHandler)
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler';
import authRouter from './routes/auth';
import organizationsRouter from './routes/organizations';
import invitationsRouter from './routes/invitations';

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  credentials: true,
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/auth', authRouter);
app.use('/organizations', organizationsRouter);
app.use('/invitations', invitationsRouter);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`scenauria-api running on port ${PORT}`);
});

export default app;
