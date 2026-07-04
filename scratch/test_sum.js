const db = require('../backend/src/database');

async function testSum() {
  console.time('fetch transactions aggregated');
  const uniqueDates = ['2026-03-02', '2026-03-05'];
  const custodyId = 3;
  
  let query = db('tb_transacoes')
    .whereIn('tb_transacoes.data', uniqueDates)
    .select('tb_transacoes.id_atm', 'tb_transacoes.data', 'tb_transacoes.tipo')
    .sum('tb_transacoes.valor as valor')
    .groupBy('tb_transacoes.id_atm', 'tb_transacoes.data', 'tb_transacoes.tipo');
  
  if (custodyId !== 'all') {
    query = query.join('tb_atms', 'tb_transacoes.id_atm', 'tb_atms.id')
      .where('tb_atms.id_custodia', custodyId);
  }
  
  const results = await query;
  console.timeEnd('fetch transactions aggregated');
  console.log('results count:', results.length);
  if (results.length > 0) {
    console.log('First result:', results[0]);
  }
}

testSum().catch(console.error).finally(() => db.destroy());
