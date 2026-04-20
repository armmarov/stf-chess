import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import authRouter from './modules/auth/auth.routes';
import sessionsRouter from './modules/sessions/sessions.routes';
import { preAttendanceRouter, attendanceRouter } from './modules/attendance/attendance.routes';
import usersRouter from './modules/users/users.routes';
import paymentsRouter from './modules/payments/payments.routes';
import configRouter from './modules/config/config.routes';
import notificationsRouter from './modules/notifications/notifications.routes';
import dashboardRouter from './modules/dashboard/dashboard.routes';
import tournamentsRouter from './modules/tournaments/tournaments.routes';

const app = express();

// Trust first proxy hop (nginx on the same host). Required for
// express-rate-limit to read real client IPs from X-Forwarded-For,
// and for req.ip / req.protocol to reflect the original request.
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());

const authLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/auth', authLimiter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/sessions/:id/pre-attendance', preAttendanceRouter);
app.use('/api/sessions/:id/attendance', attendanceRouter);
app.use('/api/users', usersRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/config', configRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/tournaments', tournamentsRouter);

app.use(errorHandler);

export default app;
