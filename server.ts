/**
 * Local development bootstrap for PhongTro Thai Nguyen.
 * This file starts the Express app only for local runs.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import express, { Request, Response } from 'express';
import { ensureDatabaseConnection } from './server/db.js';
import app from './server/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  try {
    await ensureDatabaseConnection();
  } catch (error) {
    console.error('Server startup failed because PostgreSQL is unavailable. The backend must not fall back to the mock database.');
    process.exit(1);
  }

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
