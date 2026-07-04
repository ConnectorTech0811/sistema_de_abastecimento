const db = require('../backend/src/database');

async function showIndexes() {
  const indexes = await db.raw('SHOW INDEX FROM tb_transacoes');
  console.log(JSON.stringify(indexes[0], null, 2));
}

showIndexes().catch(console.error).finally(() => db.destroy());
