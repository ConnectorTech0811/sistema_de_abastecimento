const express = require('express');
const db = require('../database');
const authMiddleware = require('../middlewares/auth');

const router = express.Router();

router.use(authMiddleware);

// GET /api/custodies
router.get('/', async (req, res) => {
  try {
    const custodies = await db('tb_custodias').select('id', 'nome as name', 'regiao as region', 'cidades as cities', 'descricao as description', 'status', 'created_at', 'updated_at');
    res.json(custodies);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar custódias' });
  }
});

// POST /api/custodies (Admin only)
router.post('/', async (req, res) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito ao administrador' });
  }

  const { name, region, cities, description, status } = req.body;
  if (!name) return res.status(400).json({ error: 'O nome é obrigatório' });

  try {
    const [id] = await db('tb_custodias').insert({ nome: name, regiao: region, cidades: cities, descricao: description, status });
    res.status(201).json({ id, name });
  } catch (err) {
    res.status(400).json({ error: 'Erro ao criar custódia (pode já existir)' });
  }
});

// PUT /api/custodies/:id (Admin only)
router.put('/:id', async (req, res) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito ao administrador' });
  }

  const { id } = req.params;
  const { name, region, cities, description, status } = req.body;

  try {
    await db('tb_custodias').where({ id }).update({ nome: name, regiao: region, cidades: cities, descricao: description, status });
    res.json({ message: 'Custódia atualizada com sucesso' });
  } catch (err) {
    res.status(400).json({ error: 'Erro ao atualizar custódia' });
  }
});

// DELETE /api/custodies/:id (Admin only)
router.delete('/:id', async (req, res) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito ao administrador' });
  }

  const { id } = req.params;

  try {
    await db('tb_custodias').where({ id }).del();
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir custódia' });
  }
});

// GET /api/custodies/:id/daily-totals?date=YYYY-MM-DD
router.get('/:id/daily-totals', async (req, res) => {
  const { id } = req.params;
  const { date } = req.query;

  if (!date) return res.status(400).json({ error: 'A data é obrigatória' });

  try {
    const totalsQuery = db('tb_transacoes')
      .join('tb_atms', 'tb_transacoes.id_atm', 'tb_atms.id')
      .where('tb_transacoes.data', date)
      .select('tb_transacoes.tipo')
      .sum('valor as total')
      .groupBy('tb_transacoes.tipo');

    if (id !== 'all') {
      totalsQuery.where('tb_atms.id_custodia', id);
    }

    const totals = await totalsQuery;

    const result = {
      withdrawal: 0,
      deposit: 0
    };

    totals.forEach(t => {
      if (t.tipo === 'saque') result.withdrawal = parseFloat(t.total);
      if (t.tipo === 'deposito') result.deposit = parseFloat(t.total);
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar totais diários' });
  }
});

// GET /api/custodies/:id/atm-daily-totals?date=YYYY-MM-DD
// Returns per-ATM withdrawal and deposit totals for a specific date
router.get('/:id/atm-daily-totals', async (req, res) => {
  const { id } = req.params;
  const { date } = req.query;

  if (!date) return res.status(400).json({ error: 'A data é obrigatória' });

  try {
    const atmFilter = id === 'all'
      ? db('tb_atms').select('id')
      : db('tb_atms').where({ id_custodia: id }).select('id');

    const [atms, transRows] = await Promise.all([
      id === 'all' ? db('tb_atms') : db('tb_atms').where({ id_custodia: id }),
      db('tb_transacoes')
        .whereIn('id_atm', atmFilter)
        .where('data', date)
        .select('id_atm', 'tipo')
        .sum('valor as total')
        .groupBy('id_atm', 'tipo')
    ]);

    const transMap = {};
    transRows.forEach(row => {
      if (!transMap[row.id_atm]) transMap[row.id_atm] = { withdrawal: 0, deposit: 0 };
      if (row.tipo === 'saque') transMap[row.id_atm].withdrawal = parseFloat(row.total) || 0;
      if (row.tipo === 'deposito') transMap[row.id_atm].deposit = parseFloat(row.total) || 0;
    });

    const results = atms.map(atm => ({
      id: atm.id,
      number: atm.numero,
      name: `ATM ${atm.numero}`,
      withdrawal: transMap[atm.id]?.withdrawal || 0,
      deposit: transMap[atm.id]?.deposit || 0
    }));

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar totais por ATM' });
  }
});

module.exports = router;
