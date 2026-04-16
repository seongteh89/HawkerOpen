import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import { hawkersRouter } from './routes/hawkers.js';
import { devicesRouter } from './routes/devices.js';
import { usersRouter } from './routes/users.js';
import { adminRouter } from './routes/admin.js';
export const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.get('/health', (_req, res) => {
    res.json({
        ok: true,
        service: 'hawkeropen-api',
        now: new Date().toISOString(),
    });
});
app.use('/api/v1/hawkers', hawkersRouter);
app.use('/api/v1/devices', devicesRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/admin', adminRouter);
app.use((err, _req, res, _next) => {
    console.error(err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: message });
});
