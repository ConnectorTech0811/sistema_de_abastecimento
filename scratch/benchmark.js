const db = require('../backend/src/database');

async function getDetailData(custodyId, referenceDate) {
  console.time('fetch analysis');
  const analysis = await db('tb_analises')
    .where({ id_custodia: custodyId, data_referencia: referenceDate })
    .first();
  console.timeEnd('fetch analysis');

  if (!analysis) {
    throw new Error('Nenhuma análise salva encontrada para esta data');
  }

  const config = typeof analysis.configuracao === 'string' ? JSON.parse(analysis.configuracao) : analysis.configuracao;
  const { lines, dateRows, actionFinalMacro, actionFinalMicro } = config;

  console.time('fetch atms');
  const atmsQuery = db('tb_atms');
  if (custodyId !== 'all') {
    atmsQuery.where({ id_custodia: custodyId });
  }
  const atms = await atmsQuery;
  console.timeEnd('fetch atms');

  if (atms.length === 0) {
    return;
  }

  const allDates = Object.values(dateRows).flat().map(d => d.date).filter(Boolean);
  const uniqueDates = [...new Set(allDates)];
  
  console.log('uniqueDates count:', uniqueDates.length);
  console.log('ATMs count:', atms.length);

  console.time('fetch transactions (original)');
  let transactions = [];
  if (uniqueDates.length > 0) {
    transactions = await db('tb_transacoes')
      .whereIn('id_atm', atms.map(a => a.id))
      .whereIn('data', uniqueDates);
  }
  console.timeEnd('fetch transactions (original)');
  console.log('transactions count:', transactions.length);

  console.time('fetch transactions (optimized join)');
  let transactionsOpt = [];
  if (uniqueDates.length > 0) {
    let query = db('tb_transacoes')
      .whereIn('tb_transacoes.data', uniqueDates)
      .select('tb_transacoes.id_atm', 'tb_transacoes.data', 'tb_transacoes.tipo', 'tb_transacoes.valor');
    
    if (custodyId !== 'all') {
      query = query.join('tb_atms', 'tb_transacoes.id_atm', 'tb_atms.id')
        .where('tb_atms.id_custodia', custodyId);
    }
    transactionsOpt = await query;
  }
  console.timeEnd('fetch transactions (optimized join)');
  console.log('optimized transactions count:', transactionsOpt.length);
}

getDetailData(3, '2026-05-22')
  .catch(console.error)
  .finally(() => db.destroy());
