// const express = require('express');
// const cors = require('cors');
// const helmet = require('helmet');
// const morgan = require('morgan');
// require('dotenv').config();
// const { connectDB, connectRedis } = require('./config/db');

// connectDB();
// connectRedis();
// const app = express();
// const userRoutes = require('./routes/userRoutes');
// const loanRoutes = require('./routes/loanRoutes');
// const authRoutes = require('./routes/authRoutes');
// const faucetRoutes = require('./routes/faucetRoutes');
// const livenessRoutes = require('./routes/livenessRoutes');
// const port = process.env.PORT || 5000;
// const { connectProvider, listenToContractEvents } = require('./services/blockchainService');
// const { startAutoRepayScheduler } = require('./services/autoRepayService');

// // Initialize Blockchain Service
// connectProvider();
// listenToContractEvents();

// // Initialize Automatic Repayment Cron (every 60 seconds)
// startAutoRepayScheduler();

// // Security and utility Middlewares
// app.use(helmet());
// app.use(cors());
// app.use(morgan('dev'));
// app.use(express.json({ limit: '10mb' }));
// app.use(express.urlencoded({ limit: '10mb', extended: true }));

// // Core API Routes
// app.use('/api/users', userRoutes);
// app.use('/api/loans', loanRoutes);
// app.use('/api/faucet', faucetRoutes);
// app.use('/api/liveness', livenessRoutes);
// app.use('/auth', authRoutes);

// // Basic Route for health check
// app.get('/', (req, res) => {
//   res.json({ message: 'Welcome to the Microfinance API', status: 'OK' });
// });

// // 404 Handler
// app.use((req, res, next) => {
//   res.status(404).json({ error: 'Route not found' });
// });

// // Global Error Handler
// app.use((err, req, res, next) => {
//   console.error(err.stack);
//   res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
// });

// app.listen(port, () => {
//   console.log(`Server is running on port: ${port}`);
// });

// module.exports = app;








const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();
const { connectDB, connectRedis } = require('./config/db');

connectDB();
connectRedis();
const app = express();
const userRoutes = require('./routes/userRoutes');
const loanRoutes = require('./routes/loanRoutes');
const authRoutes = require('./routes/authRoutes');
const faucetRoutes = require('./routes/faucetRoutes');
const livenessRoutes = require('./routes/livenessRoutes');
const chatRoutes = require('./routes/chatRoutes');
const port = process.env.PORT || 5000;
const { connectProvider, listenToContractEvents } = require('./services/blockchainService');
const { startAutoRepayScheduler } = require('./services/autoRepayService');

// Initialize Blockchain Service
connectProvider();
listenToContractEvents();

// Initialize Automatic Repayment Cron (every 60 seconds)
startAutoRepayScheduler();

// Security and utility Middlewares
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Core API Routes
app.use('/api/users', userRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/faucet', faucetRoutes);
app.use('/api/liveness', livenessRoutes);
app.use('/auth', authRoutes);
app.use('/api/chat', chatRoutes);

// Debug Routes
app.post('/api/debug/force-autopay/:loanId', async (req, res) => {
  const { forceAutoPay } = require('./services/autoRepayService');
  const result = await forceAutoPay(req.params.loanId);
  res.status(result.success ? 200 : 400).json(result);
});

// Basic Route for health check
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Microfinance API', status: 'OK' });
});

// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});

module.exports = app;