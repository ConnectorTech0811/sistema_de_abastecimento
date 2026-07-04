const db = require('../backend/src/database');

async function runExplainSum() {
  const sql = db('tb_transacoes')
    .join('tb_atms', 'tb_transacoes.id_atm', 'tb_atms.id')
    .whereIn('tb_transacoes.data', ['2026-03-02', '2026-03-05'])
    .where('tb_atms.id_custodia', 3)
    .select('tb_transacoes.id_atm', 'tb_transacoes.data', 'tb_transacoes.tipo')
    .sum('tb_transacoes.valor as valor')
    .groupBy('tb_transacoes.id_atm', 'tb_transacoes.data', 'tb_transacoes.tipo')
    .toSQL().toNative();
  
  console.log('SQL:', sql);
  
  const explanation = await db.raw('EXPLAIN ' + sql.sql, sql.bindings);
  console.log('EXPLAIN:', JSON.stringify(explanation[0], null, 2));
}

runExplainSum().catch(console.error).finally(() => db.destroy());
