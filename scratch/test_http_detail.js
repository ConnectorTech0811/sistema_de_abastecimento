const jwt = require('jsonwebtoken');

// Generate token
const token = jwt.sign({ id: 1, role: 'admin' }, process.env.JWT_SECRET || 'secret123', { expiresIn: '1h' });

async function test() {
  const payload = {
    custodyId: 4,
    referenceDate: '2026-05-18'
  };
  
  console.log('Sending request to backend on port 3000 with payload:', payload);
  try {
    const res = await fetch('http://127.0.0.1:3000/api/analyses/detail', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    
    console.log('Response Status:', res.status);
    const data = await res.json();
    console.log('Response Data keys:', Object.keys(data));
    if (data.error) {
      console.log('Error from API:', data.error);
    } else {
      console.log('ATMs count:', data.atms ? data.atms.length : 'undefined');
    }
  } catch (err) {
    console.error('Request failed:', err);
  }
}

test();
