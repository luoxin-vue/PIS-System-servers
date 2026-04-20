import express from 'express';
import cors from 'cors';
import path from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { initDb } from './db/index.js';
import { authRouter } from './routes/auth.js';
import { productsRouter } from './routes/products.js';
import { suppliersRouter } from './routes/suppliers.js';
import { purchasesRouter } from './routes/purchases.js';
import { salesRouter } from './routes/sales.js';
import { inventoryRouter } from './routes/inventory.js';
import { reportsRouter } from './routes/reports.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
initDb();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/purchases', purchasesRouter);
app.use('/api/sales', salesRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/reports', reportsRouter);

// Serve client static files in production (when client/dist exists)
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_, res, next) => {
    res.sendFile(path.join(clientDist, 'index.html'), (err) => {
      if (err) next();
    });
  });
}

const PORT = Number(process.env.PORT) || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please stop the existing process or set PORT to another value.`);
    process.exit(1);
  }
  console.error('Server error:', err);
  process.exit(1);
});
