const db = require('../backend/src/database');

async function checkAnalyses() {
  const rows = await db('tb_analises').select('id', 'id_usuario', 'id_custodia', 'data_referencia');
  console.log('Saved analyses in tb_analises:', rows);
}

checkAnalyses()
  .catch(console.error)
  .finally(() => db.destroy());
