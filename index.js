require('dotenv').config();
const express = require('express');
const app = express();
const connectDB = require('./configs/db');
const authRoutes = require('./routes/auth.route');
const userRoutes = require('./routes/user.route');
const interestRoutes = require('./routes/interest.route');
const cors = require('cors');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.get('/', (req, res) => {
  res.send('Hello World');
});
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/interests', interestRoutes);

app.listen(process.env.PORT, () => {
  connectDB();
  console.log(`Server is running on port ${process.env.PORT}`);
});
