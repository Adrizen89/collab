import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './env.js';
import { logger } from './lib/logger.js';
import { authRouter } from './routes/auth.routes.js';
import { profileRouter } from './routes/profile.routes.js';
import { documentRouter } from './routes/document.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { internalRouter } from './routes/internal.routes.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.WEB_ORIGIN,
    credentials: true,
    exposedHeaders: ['content-disposition'],
  }),
);
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRouter);
app.use('/me', profileRouter);
app.use('/documents', documentRouter);
app.use('/admin', adminRouter);
app.use('/internal', internalRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.API_PORT, () => {
  logger.info(`Serveur API en écoute sur le port ${env.API_PORT}`);
});
