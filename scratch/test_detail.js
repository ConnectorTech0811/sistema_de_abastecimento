const db = require('../backend/src/database');

async function testDetail() {
  const custodyId = 3;
  const referenceDate = '2026-05-18';
  
  console.log('Querying with:', { id_custodia: custodyId, data_referencia: referenceDate });
  const analysis = await db('tb_analises')
    .where({ id_custodia: custodyId, data_referencia: referenceDate })
    .first();
  
  console.log('Result:', analysis);
}

testDetail().catch(console.error).finally(() => db.destroy());
