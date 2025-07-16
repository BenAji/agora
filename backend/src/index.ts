import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { supabase } from './lib/supabase';

// Import routes
import authRoutes from './routes/auth';
import eventRoutes from './routes/events';
import calendarRoutes from './routes/calendar';
import rsvpRoutes from './routes/rsvp';
import subscriptionRoutes from './routes/subscriptions';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/rsvp', rsvpRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

// Test route
app.get('/api/health', (req, res) => {
  res.json({ message: 'Agora API is running!' });
});

// Test database connection
app.get('/api/test-db', async (req, res) => {
  try {
    const { count: userCount, error: userError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    const { count: eventCount, error: eventError } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true });

    const { count: companyCount, error: companyError } = await supabase
      .from('gics_companies')
      .select('*', { count: 'exact', head: true });

    if (userError || eventError || companyError) {
      throw new Error('Database query failed');
    }
    
    res.json({
      message: 'Database connection successful!',
      counts: {
        users: userCount || 0,
        events: eventCount || 0,
        companies: companyCount || 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Database connection failed', details: error });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  process.exit(0);
});

export default app;
