const http = require('http');

// Test if localhost:3000 shows "Hello Blog"
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/',
  method: 'GET'
};

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (data.includes('Hello Blog')) {
      console.log('✓ SUCCESS: http://localhost:3000 shows "Hello Blog"');
      process.exit(0);
    } else {
      console.log('✗ FAIL: "Hello Blog" not found');
      process.exit(1);
    }
  });
});

req.on('error', (err) => {
  console.log('✗ FAIL: Could not connect to localhost:3000');
  process.exit(1);
});

req.setTimeout(5000, () => {
  console.log('✗ FAIL: Request timeout');
  req.destroy();
  process.exit(1);
});

req.end();