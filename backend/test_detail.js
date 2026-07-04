const knex = require('knex');
const knexConfig = require('./knexfile.js');

const db = knex(knexConfig.development);

async function testGetDetail() {
  const custodyId = '3';
  const referenceDate = '2026-05-21';
  const config = {
    lines: [{ id: 0, macro: true, micro: true, action: 'Maior' }],
    dateRows: {
      '0': [{ id: 1, date: '2026-03-30', factorW: 1, factorD: 1 }]
    },
    actionFinalMacro: 'Maior',
    actionFinalMicro: 'Maior'
  };

  const atms = await db('tb_atms').where({ id_custodia: custodyId });
  console.log(`Found ${atms.length} ATMs`);

  const uniqueDates = ['2026-03-30'];
  const transactions = await db('tb_transacoes')
    .whereIn('id_atm', atms.map(a => a.id))
    .whereIn('data', uniqueDates);
  
  console.log(`Found ${transactions.length} transactions for date 2026-03-30`);

  const transMap = {};
  transactions.forEach(t => {
    const dateStr = t.data instanceof Date ? t.data.toISOString().split('T')[0] : t.data;
    const atmKey = `${t.id_atm}_${dateStr}_${t.tipo}`;
    const val = parseFloat(t.valor) || 0;
    transMap[atmKey] = (transMap[atmKey] || 0) + val;
  });

  const sampleKeys = Object.keys(transMap).slice(0, 5);
  console.log("Sample transMap keys:", sampleKeys);
  for (const key of sampleKeys) {
    console.log(`${key}: ${transMap[key]}`);
  }

  process.exit(0);
}

testGetDetail().catch(console.error);
