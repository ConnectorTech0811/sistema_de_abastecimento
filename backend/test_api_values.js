const knex = require('knex');
const knexConfig = require('./knexfile.js');
const http = require('http');

const db = knex(knexConfig.development);

function httpPost(path, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: '127.0.0.1',
      port: 3000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Authorization': `Bearer ${token}`
      }
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch (e) { resolve({ status: res.statusCode, raw: body }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  try {
    const user = await db('tb_usuarios').first();
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ id: user.id, role: 'admin' }, process.env.JWT_SECRET || 'secret123', { expiresIn: 86400 });
    
    const configWithDates = {
      lines: [{ id: 0, macro: true, micro: true, action: 'Maior' }],
      dateRows: {
        '0': [{ id: 1, date: '2026-03-30', week: 'Domingo', amountW: '0,00', amountD: '0,00', factorW: '1,00', factorD: '1,00' }]
      },
      actionFinalMacro: 'Maior',
      actionFinalMicro: 'Maior'
    };
    const r2 = await httpPost('/api/analyses/detail', { custodyId: '3', referenceDate: '2026-05-21', config: configWithDates }, token);
    console.log('Status:', r2.status);
    if (r2.data) {
      console.log('summary:', JSON.stringify(r2.data.summary));
      if (r2.data.atms && r2.data.atms.length > 0) {
        const atmsWithWithdrawals = r2.data.atms.filter(a => a.withdrawal > 0);
        console.log(`ATMs with withdrawal > 0: ${atmsWithWithdrawals.length}`);
        console.log(`First ATM with withdrawal:`, atmsWithWithdrawals[0]);
      }
      if (r2.data.error) console.log('ERROR:', r2.data.error);
    }
  } catch (err) {
    console.error('Fatal Error:', err.message);
  } finally {
    await db.destroy();
  }
}

main();
