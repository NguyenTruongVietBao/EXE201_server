require('dotenv').config();
process.env.TZ = 'Asia/Ho_Chi_Minh';

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./configs/db');
const socketHandler = require('./socket');
const cron = require('node-cron');
const { releaseCommissions } = require('./controllers/payment.controller');

const authRoutes = require('./routes/auth.route');
const userRoutes = require('./routes/user.route');
const interestRoutes = require('./routes/interest.route');
const documentRoutes = require('./routes/document.route');
const groupRoutes = require('./routes/group.route');
const chatRoutes = require('./routes/chat.route');
const paymentRoutes = require('./routes/payment.route');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
  },
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.get('/', (req, res) => {
  res.send('Hello World');
});
app.get('/test-download', (req, res) => {
  res.sendFile(__dirname + '/test-download.html');
});
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/interests', interestRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/payments', paymentRoutes);

socketHandler(io);

connectDB();

// Cron job chạy mỗi 60s để kiểm tra và release commission
cron.schedule('*/30 * * * * *', async () => {
  console.log('🔄 Running commission release job...');
  await releaseCommissions();
});

server.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});
