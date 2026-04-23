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

// Create an instance of Express
const app = express();

// Cors
app.use(corsHandler());

app.get('/', (req, res) => {
    res.send('Hello from theoakcellar');
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