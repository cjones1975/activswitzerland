import cors from 'cors';

const corsHandler = () => {
  // Enable CORS
  if (process.env.NODE_ENV === 'development') {
    return cors({
      origin: true, // Allow all origins in development
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type', 'x-app-key'],
      optionsSuccessStatus: 200,
    });
  } else {
    const whitelist = [
      'https://localhost',
      'http://localhost:4200',
      'http://cjones.synology.me:4200'
    ];
    const corsOptions = {
      origin: function (origin, callback) {
        if (!origin || whitelist.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          if (process.env.NODE_ENV !== 'production') {
            console.error(`Blocked by CORS: ${origin}`);
          }  
          callback(new Error('Not allowed by CORS'));
        }
      },
      optionsSuccessStatus: 200,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type', 'x-app-key'],
    };
    return cors(corsOptions);
  }
};

export default corsHandler