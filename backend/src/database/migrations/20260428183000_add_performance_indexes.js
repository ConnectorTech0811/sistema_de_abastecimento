exports.up = function(knex) {
  return knex.schema
    .alterTable('tb_transacoes', table => {
      // Índices para otimizar as buscas no Detalhamento e no Dashboard
      table.index(['id_atm', 'data'], 'idx_transacoes_atm_data');
      table.index('data', 'idx_transacoes_data');
      table.index('tipo', 'idx_transacoes_tipo');
    })
    .alterTable('tb_analises', table => {
      // Índices para buscas rápidas de configurações anteriores e relatórios
      table.index(['id_custodia', 'data_referencia'], 'idx_analises_custodia_data');
      table.index('created_at', 'idx_analises_created_at');
    });
};

exports.down = function(knex) {
  return knex.schema
    .alterTable('tb_transacoes', table => {
      table.dropIndex(['id_atm', 'data'], 'idx_transacoes_atm_data');
      table.dropIndex('data', 'idx_transacoes_data');
      table.dropIndex('tipo', 'idx_transacoes_tipo');
    })
    .alterTable('tb_analises', table => {
      table.dropIndex(['id_custodia', 'data_referencia'], 'idx_analises_custodia_data');
      table.dropIndex('created_at', 'idx_analises_created_at');
    });
};
