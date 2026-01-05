const http = require('http');

const data = JSON.stringify({
  draftMessage: 'hello how are you',
  conversationHistory: [],
  contactName: 'Test User'
});

const options = {
  hostname: '127.0.0.1',
  port: 5000,
  path: '/api/ai/rewrite',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTUyOGNmNWZkYjc0NDVhNTljNjFiZjAiLCJpYXQiOjE3MzU3NTA4NjksImV4cCI6MTczNjM1NTY2OX0.test',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', body);
  });
});

req.on('error', (e) => {
  console.error('Request Error:', e.message);
});

req.write(data);
req.end();
