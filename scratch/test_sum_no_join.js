const db = require('../backend/src/database');

async function testSumNoJoin() {
  console.time('fetch atms');
  const atms = await db('tb_atms').where('id_custodia', 3).select('id');
  console.timeEnd('fetch atms');
  
  const atmIds = atms.map(a => a.id);
  console.log('ATM count:', atmIds.length);
  
  const uniqueDates = ['2026-03-02', '2026-03-05'];
  
  console.time('fetch transactions aggregated (no join)');
  const results = await db('tb_transacoes')
    .whereIn('id_atm', atmIds)
    .whereIn('data', uniqueDates)
    .select('id_atm', 'data', 'tipo')
    .sum('valor as valor')
    .groupBy('id_atm', 'data', 'tipo');
  
  console.timeEnd('fetch transactions aggregated (no join)');
  console.log('results count:', results.length);
}

testSumNoJoin().catch(console.error).finally(() => db.destroy());
