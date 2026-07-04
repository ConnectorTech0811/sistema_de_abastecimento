const knex = require('knex');
const knexConfig = require('./knexfile.js');
const db = knex(knexConfig.development);

async function run() {
  try {
    const custodies = await db('tb_custodias').select('*');
    console.log('--- Custodies ---');
    console.log(custodies);

    const atmsCount = await db('tb_atms').groupBy('id_custodia').select('id_custodia').count('id as count');
    console.log('--- ATMs Count by Custody ---');
    console.log(atmsCount);

    const transactionsCount = await db('tb_transacoes').count('id as count');
    console.log('--- Transactions Count ---');
    console.log(transactionsCount);

    const lastTransactions = await db('tb_transacoes').orderBy('data', 'desc').limit(5);
    console.log('--- Last 5 Transactions ---');
    console.log(lastTransactions);

    const analyses = await db('tb_analises').select('id', 'id_custodia', 'data_referencia', 'configuracao');
    console.log('--- Saved Analyses ---');
    console.log(analyses.map(a => ({
      id: a.id,
      id_custodia: a.id_custodia,
      data_referencia: a.data_referencia,
      configLength: a.configuracao ? a.configuracao.length : 0
    })));

  } catch (err) {
    console.error(err);
  } finally {
    await db.destroy();
  }
}

run();
