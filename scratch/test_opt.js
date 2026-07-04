const db = require('../backend/src/database');

async function testOpt() {
  console.time('fetch transactions (optimized join)');
  const uniqueDates = ['2026-03-02', '2026-03-05'];
  const custodyId = 3;
  let query = db('tb_transacoes')
    .whereIn('tb_transacoes.data', uniqueDates)
    .select('tb_transacoes.id_atm', 'tb_transacoes.data', 'tb_transacoes.tipo', 'tb_transacoes.valor');
  
  if (custodyId !== 'all') {
    query = query.join('tb_atms', 'tb_transacoes.id_atm', 'tb_atms.id')
      .where('tb_atms.id_custodia', custodyId);
  }
  const transactionsOpt = await query;
  console.timeEnd('fetch transactions (optimized join)');
  console.log('optimized transactions count:', transactionsOpt.length);
}

testOpt().catch(console.error).finally(() => db.destroy());
