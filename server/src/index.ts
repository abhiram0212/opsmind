import 'dotenv/config';
import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { db } from './database/db';
import { seedDatabase } from './database/seed';
import { createApi } from './routes/api';

seedDatabase(db);
const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }));
app.use(express.json({ limit: '32kb' }));
app.use('/api', createApi(db));
app.use((_request, response) => response.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'API route not found.' } }));
const errors: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  void _next;
  console.error('Unhandled API error:', error);
  response.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed.' } });
};
app.use(errors);

const port = Number(process.env.PORT ?? 4000);
const server = app.listen(port, () => console.log(`OpsMind API listening on http://localhost:${port}`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
}