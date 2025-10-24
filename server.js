const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
//app.set('view engine', 'ejs');
//app.set('views', path.join(__dirname, 'views'));

// Serve the login form
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// MySQL connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root', // your DB password
  database: 'dallascollege'
  
});

db.connect(err => {
  if (err) throw err;
  console.log('Connected to MySQL');
});


app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const query = 'SELECT * FROM users WHERE email = ? AND password = ?';

  db.query(query, [email, password], (err, results) => {
    if (err) throw err;

    if (results.length > 0) {
      const user = results[0];

      if (user.role === 'admin') {
        res.redirect('/AdminDashboard');
      } else {
        res.redirect('/UserHomePage');
      }

    } else {
      res.send('Invalid email or password.');
    }
  });
});

// Admin route
app.get('/AdminDashboard', (req, res) => {
  res.send('<h1>Welcome Admin!</h1>');
});

// User route
app.get('/UserHomePage', (req, res) => {
  res.send('<h1>Welcome to your home page!</h1>');
});

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
})
