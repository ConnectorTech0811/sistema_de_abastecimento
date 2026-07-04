const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// basic healthcheck
app.get(['/api/health', '/health'], (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// require routes (Duplicated for cPanel Passenger compatibility)
app.use('/api/auth', require('./src/routes/auth'));
app.use('/auth', require('./src/routes/auth'));

app.use('/api/users', require('./src/routes/users'));
app.use('/users', require('./src/routes/users'));

app.use('/api/custodies', require('./src/routes/custodies'));
app.use('/custodies', require('./src/routes/custodies'));

app.use('/api/import', require('./src/routes/import'));
app.use('/import', require('./src/routes/import'));

app.use('/api/analyses', require('./src/routes/analyses'));
app.use('/analyses', require('./src/routes/analyses'));

app.use('/api/dashboard', require('./src/routes/dashboard'));
app.use('/dashboard', require('./src/routes/dashboard'));

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT} (0.0.0.0)`);
  });
}

module.exports = app;
