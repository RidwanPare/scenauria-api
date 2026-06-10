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
import placesRouter from './routes/places';
import capturesRouter from './routes/captures';
import visitsRouter, { publicVisitRouter } from './routes/visits';
import qrcodesRouter from './routes/qrcodes';
import hotspotsRouter from './routes/hotspots';
import ctaRouter from './routes/cta';
import surveysRouter from './routes/surveys';
import analyticsRouter from './routes/analytics';
import billingRouter from './routes/billing';
import adminRouter from './routes/admin';

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
app.use('/places', placesRouter);
app.use('/captures', capturesRouter);
app.use('/visits', visitsRouter);
app.use('/qrcodes', qrcodesRouter);
app.use('/hotspots', hotspotsRouter);
app.use('/cta', ctaRouter);
app.use('/surveys', surveysRouter);
app.use('/analytics', analyticsRouter);
app.use('/billing', billingRouter);
app.use('/v', publicVisitRouter);
app.use('/admin', adminRouter);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`scenauria-api running on port ${PORT}`);
});

export default app;
