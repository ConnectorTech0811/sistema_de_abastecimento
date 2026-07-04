const http = require('http');

async function test() {
  const token = require('jsonwebtoken').sign({ id: 1, role: 'admin' }, process.env.JWT_SECRET || 'secret123', { expiresIn: 86400 });
  const req = http.request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/analyses/detail',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }, (res) => {
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      try {
        const data = JSON.parse(body);
        console.log('atms length:', data.atms?.length);
        console.log('error:', data.error);
      } catch (e) {
        console.log('Body length:', body.length);
        console.log('Parse error:', e.message);
      }
    });
  });
  
  req.write(JSON.stringify({
    custodyId: '3',
    referenceDate: '2026-05-18',
    config: null
  }));
  req.end();
}

test();
