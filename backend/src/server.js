import dotenv from 'dotenv';
import path from 'path';
import colors from 'colors';
import express from 'express';
import errorHandler from './middleware/error.js';
import corsHandler from './middleware/cors.js';
import connectDB from './middleware/mongodb.js';

// Configure dotenv to load environment variables
dotenv.config({ path: './config/.env' });

// Connect to database
if (process.env.NODE_ENV !== 'test') {
    connectDB();
}

// Import Routes
import auth from './routes/auth.js';
import country from './routes/country.js';
import myswitzerland from './routes/myswitzerland.js';
import weather from './routes/weather.js';

// Create an instance of Express
const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));
app.use(corsHandler());

// Mount routes
app.use('/api/v1/auth', auth);
app.use('/api/v1/country', country);
app.use('/api/v1/myswitzerland', myswitzerland);
app.use('/api/v1/weather', weather);

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