exports.up = async function(knex) {
  // Widen controle_contabil from VARCHAR(15) to VARCHAR(20)
  await knex.raw("ALTER TABLE tb_transacoes MODIFY COLUMN controle_contabil VARCHAR(20) NULL");

  // Ensure nsu is nullable and VARCHAR(10) to handle edge cases
  await knex.raw("ALTER TABLE tb_transacoes MODIFY COLUMN nsu VARCHAR(10) NULL");

  // Ensure data_hora_transacao and data_contabil are nullable
  await knex.raw("ALTER TABLE tb_transacoes MODIFY COLUMN data_hora_transacao DATETIME NULL");
  await knex.raw("ALTER TABLE tb_transacoes MODIFY COLUMN data_contabil DATE NULL");
  await knex.raw("ALTER TABLE tb_transacoes MODIFY COLUMN data DATE NULL");
};

exports.down = async function(knex) {
  await knex.raw("ALTER TABLE tb_transacoes MODIFY COLUMN controle_contabil VARCHAR(15) NULL");
  await knex.raw("ALTER TABLE tb_transacoes MODIFY COLUMN nsu VARCHAR(6) NULL");
};
