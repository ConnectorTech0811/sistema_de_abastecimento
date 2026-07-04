const db = require('../backend/src/database');
const analysesRouter = require('../backend/src/routes/analyses');

// Let's copy getDetailData from the route so we can test it directly
async function runDetail() {
  const { getDetailData } = require('../backend/src/routes/analyses'); // wait, is it exported?
  // It is not exported because module.exports = router;
  // Let's extract it or copy the function here to run it
}

// Copy of getDetailData logic
async function getDetailData(custodyId, referenceDate) {
  const analysis = await db('tb_analises')
    .where({ id_custodia: custodyId, data_referencia: referenceDate })
    .first();

  if (!analysis) {
    throw new Error('Nenhuma análise salva encontrada para esta data');
  }

  const config = typeof analysis.configuracao === 'string' ? JSON.parse(analysis.configuracao) : analysis.configuracao;
  const { lines, dateRows, actionFinalMacro, actionFinalMicro } = config;

  const atmsQuery = db('tb_atms');
  if (custodyId !== 'all') {
    atmsQuery.where({ id_custodia: custodyId });
  }
  const atms = await atmsQuery;

  if (atms.length === 0) {
    const custody = custodyId === 'all' ? { id: 'all', nome: 'Custódia - Brasil (TODAS)' } : await db('tb_custodias').where({ id: custodyId }).first();
    return { custody, referenceDate, atms: [], availableDates: [] };
  }

  const allDates = Object.values(dateRows).flat().map(d => d.date).filter(Boolean);
  const uniqueDates = [...new Set(allDates)];
  
  console.log('uniqueDates:', uniqueDates);
  console.log('atms count:', atms.length);

  let transactions = [];
  if (uniqueDates.length > 0) {
    transactions = await db('tb_transacoes')
      .whereIn('id_atm', atms.map(a => a.id))
      .whereIn('data', uniqueDates);
  }
  
  console.log('transactions count:', transactions.length);
  return { uniqueDates, transactionsCount: transactions.length };
}

getDetailData(3, '2026-05-18')
  .then(console.log)
  .catch(console.error)
  .finally(() => db.destroy());
