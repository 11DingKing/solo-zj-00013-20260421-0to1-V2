import express from 'express';
import cors from 'cors';
import { config } from './config';
import authRoutes, { seedDefaultUsers } from './routes/auth';
import roomRoutes from './routes/rooms';
import bookingRoutes from './routes/bookings';
import prisma from './lib/prisma';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/bookings', bookingRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const startServer = async () => {
  try {
    await prisma.$connect();
    console.log('Database connected successfully');

    await seedDefaultUsers();
    console.log('Default users seeded');

    app.listen(config.port, () => {
      console.log(`Server is running on port ${config.port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await prisma.$disconnect();
  process.exit(0);
});
