import dotenv from 'dotenv';
import path from 'path';
import colors from 'colors';
import express from 'express';
import errorHandler from './middleware/error.js';
import corsHandler from './middleware/cors.js';
import connectDB from './middleware/mongodb.js';
import { connectRedis } from './middleware/redis.js';

// Configure dotenv to load environment variables
dotenv.config({ path: './config/.env' });

// Connect to database
if (process.env.NODE_ENV !== 'test') {
    connectDB();
    connectRedis();
}

// Import Routes
import auth from './routes/auth.js';
import country from './routes/country.js';
import myswitzerland from './routes/myswitzerland.js';
import weather from './routes/weather.js';
import transport from './routes/transport.js';
import trips from './routes/trips.js';
import hikingRoutes from './routes/hikingRoutes.js';
import bikeRoutes from './routes/bikeRoutes.js';
import ai from './routes/ai.js';
import billing from './routes/billing.js';

// Create an instance of Express
const app = express();

// Middleware
app.use(corsHandler());

// Billing is mounted ahead of the global JSON parser so /webhook's express.raw() sees Stripe's
// untouched raw body for signature verification (the global express.json() would otherwise
// consume it first) — /checkout and /portal get their own express.json() in routes/billing.js.
app.use('/api/v1/billing', billing);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Mount routes
app.use('/api/v1/auth', auth);
app.use('/api/v1/country', country);
app.use('/api/v1/myswitzerland', myswitzerland);
app.use('/api/v1/weather', weather);
app.use('/api/v1/transport', transport);
app.use('/api/v1/trips', trips);
app.use('/api/v1/hikes', hikingRoutes);
app.use('/api/v1/bikes', bikeRoutes);
app.use('/api/v1/ai', ai);

app.get('/', (req, res) => {
    res.send('Hello from ActivSwitzerland API');
  });

  // Error handler
app.use(errorHandler);

// Start the server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`.yellow.bold);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    console.log(`Error: ${err.message}`.red.bold);
    // Close server & exit process
    server.close(() => process.exit(1));
});

export default app;