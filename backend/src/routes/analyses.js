const express = require('express');
const db = require('../database');
const authMiddleware = require('../middlewares/auth');
const PDFDocument = require('pdfkit');
const xlsx = require('xlsx');

const router = express.Router();
router.use(authMiddleware);

// Helper function to extract ATM prediction logic, reused by /detail, /export/pdf, and /export/excel
async function getDetailData(custodyId, referenceDate) {
  const analysis = await db('tb_analises')
    .where({ id_custodia: custodyId, data_referencia: referenceDate })
    .first();

  if (!analysis) {
    throw new Error('Nenhuma análise salva encontrada para esta data');
  }

  const config = typeof analysis.configuracao === 'string' ? JSON.parse(analysis.configuracao) : analysis.configuracao;
  const { lines, dateRows, actionFinalMacro, actionFinalMicro } = config;

  const atms = await db('tb_atms').where({ id_custodia: custodyId });
  if (atms.length === 0) return { custody: await db('tb_custodias').where({ id: custodyId }).first(), referenceDate, atms: [], availableDates: [] };

  const allDates = Object.values(dateRows).flat().map(d => d.date).filter(Boolean);
  const uniqueDates = [...new Set(allDates)];
  
  let transactions = [];
  if (uniqueDates.length > 0) {
    transactions = await db('tb_transacoes')
      .whereIn('id_atm', atms.map(a => a.id))
      .whereIn('data', uniqueDates);
  }

  // 1. Pre-process transactions into lookup maps for O(1) access and correct summation
  const transMap = {}; // Key: atmId_date_type -> sum
  const macroTransMap = {}; // Key: date_type -> sum

  transactions.forEach(t => {
    const dateStr = t.data instanceof Date ? t.data.toISOString().split('T')[0] : t.data;
    const atmKey = `${t.id_atm}_${dateStr}_${t.tipo}`;
    const macroKey = `${dateStr}_${t.tipo}`;
    
    const val = parseFloat(t.valor) || 0;
    transMap[atmKey] = (transMap[atmKey] || 0) + val;
    macroTransMap[macroKey] = (macroTransMap[macroKey] || 0) + val;
  });

  // 2. Calculate Daily Totals for the Custody (Macro level)
  const dailyTotals = uniqueDates.map(date => {
    return {
      date,
      withdrawal: macroTransMap[`${date}_saque`] || 0,
      deposit: macroTransMap[`${date}_deposito`] || 0
    };
  });
  const getFinalPrediction = (type, isMicro) => {
    let activeLines = lines.filter(row => isMicro ? row.micro : row.macro);
    
    // Fallback: if no micro lines are selected, use macro lines as baseline for ATMs
    if (isMicro && activeLines.length === 0) {
      activeLines = lines.filter(row => row.macro);
    }

    const actionFinal = isMicro ? actionFinalMicro : actionFinalMacro;
    const rowValues = activeLines
      .map(row => {
        const rowDates = dateRows[row.id] || [];
        const dailyValues = rowDates.map(rd => {
          const factor = parseFloat(String(type === 'W' ? rd.factorW : rd.factorD).replace(',', '.')) || 1;
          const dayTotal = dailyTotals.find(dt => dt.date === rd.date);
          const baseVal = dayTotal ? (type === 'W' ? dayTotal.withdrawal : dayTotal.deposit) : 0;
          return baseVal * factor;
        });

        if (dailyValues.length === 0) return 0;
        switch (row.action) {
          case 'Maior': return Math.max(...dailyValues);
          case 'Menor': return Math.min(...dailyValues);
          case 'Média': return dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length;
          case 'Soma': return dailyValues.reduce((a, b) => a + b, 0);
          default: return 0;
        }
      });

    if (rowValues.length === 0) return 0;
    switch (actionFinal) {
      case 'Maior': return Math.max(...rowValues);
      case 'Menor': return Math.min(...rowValues);
      case 'Média': return rowValues.reduce((a, b) => a + b, 0) / rowValues.length;
      case 'Soma': return rowValues.reduce((a, b) => a + b, 0);
      default: return 0;
    }
  };

  // MACRO prediction for the cards
  const macroTotalW = getFinalPrediction('W', false);
  const macroTotalD = getFinalPrediction('D', false);

  const getAtmDetailedInfo = (atmId, type) => {
    const dailyData = {};
    let activeLines = lines.filter(row => row.micro);
    if (activeLines.length === 0) activeLines = lines.filter(row => row.macro);

    const rowValues = activeLines
      .map(row => {
        const rowDates = dateRows[row.id] || [];
        const dailyValues = rowDates.map(rd => {
          const raw = transMap[`${atmId}_${rd.date}_${type === 'W' ? 'saque' : 'deposito'}`] || 0;
          const factor = parseFloat(String(type === 'W' ? rd.factorW : rd.factorD).replace(',', '.')) || 1;
          const adjusted = raw * factor;

          if (!dailyData[rd.date]) dailyData[rd.date] = { rawW: 0, adjW: 0, factorW: 1, rawD: 0, adjD: 0, factorD: 1 };
          if (type === 'W') {
            dailyData[rd.date].rawW = raw; dailyData[rd.date].adjW = adjusted; dailyData[rd.date].factorW = factor;
          } else {
            dailyData[rd.date].rawD = raw; dailyData[rd.date].adjD = adjusted; dailyData[rd.date].factorD = factor;
          }
          return adjusted;
        });

        if (dailyValues.length === 0) return 0;
        switch (row.action) {
          case 'Maior': return Math.max(...dailyValues);
          case 'Menor': return Math.min(...dailyValues);
          case 'Média': return dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length;
          case 'Soma': return dailyValues.reduce((a, b) => a + b, 0);
          default: return 0;
        }
      });

    let microPrediction = 0;
    if (rowValues.length > 0) {
      switch (actionFinalMicro) {
        case 'Maior': microPrediction = Math.max(...rowValues); break;
        case 'Menor': microPrediction = Math.min(...rowValues); break;
        case 'Média': microPrediction = rowValues.reduce((a, b) => a + b, 0) / rowValues.length; break;
        case 'Soma': microPrediction = rowValues.reduce((a, b) => a + b, 0); break;
      }
    }
    return { dailyData, microPrediction };
  };

  const atmResults = atms.map(atm => {
    const infoW = getAtmDetailedInfo(atm.id, 'W');
    const infoD = getAtmDetailedInfo(atm.id, 'D');
    const dailyData = infoW.dailyData;
    Object.keys(infoD.dailyData).forEach(date => {
      if (!dailyData[date]) dailyData[date] = infoD.dailyData[date];
      else {
        dailyData[date].rawD = infoD.dailyData[date].rawD;
        dailyData[date].adjD = infoD.dailyData[date].adjD;
        dailyData[date].factorD = infoD.dailyData[date].factorD;
      }
    });

    return {
      id: atm.id,
      number: atm.numero,
      name: `ATM ${atm.numero}`,
      microPredictionW: infoW.microPrediction,
      microPredictionD: infoD.microPrediction,
      withdrawalRaw: Object.values(dailyData).reduce((a, b) => a + (b.rawW || 0), 0),
      depositRaw: Object.values(dailyData).reduce((a, b) => a + (b.rawD || 0), 0),
      dailyData
    };
  });

  const microSumW = atmResults.reduce((a, b) => a + b.microPredictionW, 0);
  const microSumD = atmResults.reduce((a, b) => a + b.microPredictionD, 0);

  const indexW = microSumW > 0 ? (macroTotalW / microSumW) : 1;
  const indexD = microSumD > 0 ? (macroTotalD / microSumD) : 1;

  const finalAtms = atmResults.map(atm => ({
    ...atm,
    withdrawal: atm.microPredictionW * indexW,
    deposit: atm.microPredictionD * indexD,
  }));

  const custody = await db('tb_custodias').where({ id: custodyId }).first();
  return { 
    custody, referenceDate, 
    atms: finalAtms, 
    availableDates: uniqueDates,
    summary: {
      macroW: macroTotalW, macroD: macroTotalD,
      microW: microSumW, microD: microSumD,
      indexW, indexD
    }
  };
}

// POST /api/analyses/calculate
// Calculates the prediction index based on the user's configuration
router.post('/calculate', async (req, res) => {
  const { custodyId, referenceDate, lines, actionFinalMacro, actionFinalMicro } = req.body;
  if (!custodyId || !referenceDate || !lines) {
    return res.status(400).json({ error: 'Parâmetros ausentes' });
  }

  try {
    // Basic structured response for calculation (simplified logic for now)
    // In reality, this queries all `transactions` for the given custody and dates,
    // applies the line factors, groups by action (Maior, Media, etc), and calculates
    // the final % index diff between calculated macro and individual sums.
    
    // For scaffolding purposes, we simulate the calculation:
    const atms = await db('tb_atms').where({ id_custodia: custodyId });
    
    // Return mock calculated index and individual ATM adjustments
    const simulationIndex = 1.02; // e.g. 2% more
    const results = atms.map(atm => ({
      atmId: atm.id,
      atmNumber: atm.numero,
      originalPrediction: 10000, 
      adjustedPrediction: 10000 * simulationIndex
    }));

    res.json({
      custodyId,
      referenceDate,
      calculatedIndex: simulationIndex,
      macroPrediction: 500000,
      microSum: 490196,
      details: results
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha no cálculo' });
  }
});

// GET /api/analyses
// Fetch a saved analysis for a specific custody and date
router.get('/', async (req, res) => {
  const { custodyId, referenceDate } = req.query;
  if (!custodyId || !referenceDate) {
    return res.status(400).json({ error: 'Parâmetros ausentes' });
  }

  try {
    const analysis = await db('tb_analises')
      .where({ id_custodia: custodyId, data_referencia: referenceDate })
      .first();
    
    if (analysis && analysis.configuracao) {
      return res.json(typeof analysis.configuracao === 'string' ? JSON.parse(analysis.configuracao) : analysis.configuracao);
    }
    res.json(null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao buscar análise' });
  }
});

// POST /api/analyses
// Save or Update an analysis
router.post('/', async (req, res) => {
  const { custodyId, referenceDate, config } = req.body;
  try {
    const existing = await db('tb_analises')
      .where({ id_custodia: custodyId, data_referencia: referenceDate })
      .first();

    if (existing) {
      await db('tb_analises')
        .where({ id: existing.id })
        .update({
          configuracao: JSON.stringify(config),
          id_usuario: req.userId,
          updated_at: db.fn.now()
        });
      res.json({ id: existing.id, message: 'Análise atualizada' });
    } else {
      const [id] = await db('tb_analises').insert({
        id_usuario: req.userId,
        id_custodia: custodyId,
        data_referencia: referenceDate,
        configuracao: JSON.stringify(config)
      });
      res.status(201).json({ id, message: 'Análise salva' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao salvar análise' });
  }
});

// POST /api/analyses/detail
// Returns detailed ATM-level predictions based on saved analysis
router.post('/detail', async (req, res) => {
  const { custodyId, referenceDate } = req.body;
  if (!custodyId || !referenceDate) {
    return res.status(400).json({ error: 'Parâmetros ausentes' });
  }

  try {
    const data = await getDetailData(custodyId, referenceDate);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(err.message === 'Nenhuma análise salva encontrada para esta data' ? 404 : 500).json({ error: err.message || 'Falha ao gerar detalhamento' });
  }
});

// Helper: fetch per-ATM totals for a custody on a given date
async function getAtmTotalsForDate(custodyId, date) {
  const atms = await db('tb_atms').where({ id_custodia: custodyId });
  const results = [];

  for (const atm of atms) {
    const totals = await db('tb_transacoes')
      .where({ id_atm: atm.id, data: date })
      .select('tipo')
      .sum('valor as total')
      .groupBy('tipo');

    let withdrawal = 0;
    let deposit = 0;
    totals.forEach(t => {
      if (t.tipo === 'saque') withdrawal = parseFloat(t.total) || 0;
      if (t.tipo === 'deposito') deposit = parseFloat(t.total) || 0;
    });

    results.push({
      id: atm.id,
      number: atm.numero,
      name: `ATM ${atm.numero}`,
      withdrawal,
      deposit
    });
  }

  return results;
}

router.post('/export/pdf', async (req, res) => {
  const { custodyId, date } = req.body;
  if (!custodyId || !date) {
    return res.status(400).json({ error: 'Parâmetros ausentes (custodyId, date)' });
  }

  try {
    const custody = await db('tb_custodias').where({ id: custodyId }).first();
    const data = await getDetailData(custodyId, date);
    const atms = data.atms;

    const formatBRL = (val) => val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=consolidacao_${custodyId}_${date}.pdf`);
    doc.pipe(res);

    // Header with better styling
    doc.rect(0, 0, 600, 80).fill('#0f172a');
    doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold').text('CONSOLIDAÇÃO DE ABASTECIMENTO', 50, 25);
    doc.fontSize(10).font('Helvetica').text(`CUSTÓDIA: ${custody ? custody.nome.toUpperCase() : custodyId}  |  DATA DE PREVISÃO: ${date.split('-').reverse().join('/')}`, 50, 52);
    
    doc.fillColor('#000000').moveDown(4);

    // Summary Box
    const totalW = atms.reduce((a, b) => a + b.withdrawal, 0);
    const totalD = atms.reduce((a, b) => a + b.deposit, 0);
    
    doc.rect(50, 100, 500, 60).fill('#f8fafc').stroke('#e2e8f0');
    doc.fillColor('#64748b').fontSize(8).font('Helvetica-Bold').text('RESUMO DA PREVISÃO TOTAL', 65, 112);
    
    doc.fillColor('#1e293b').fontSize(14).text(`SAQUE: R$ ${formatBRL(totalW)}`, 65, 130);
    doc.fillColor('#059669').text(`DEPÓSITO: R$ ${formatBRL(totalD)}`, 280, 130);
    
    doc.moveDown(3);

    // Table
    const tableTop = 180;
    doc.fillColor('#475569').fontSize(9).font('Helvetica-Bold');
    doc.text('ATM', 50, tableTop);
    doc.text('PREVISÃO SAQUE', 200, tableTop, { width: 100, align: 'right' });
    doc.text('PREVISÃO DEPÓSITO', 320, tableTop, { width: 100, align: 'right' });
    doc.text('TOTAL ESTIMADO', 450, tableTop, { width: 100, align: 'right' });
    
    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).strokeColor('#cbd5e1').stroke();
    
    let currentY = tableTop + 25;
    doc.font('Helvetica').fontSize(9).fillColor('#1e293b');

    atms.forEach((atm, index) => {
      if (currentY > 750) {
        doc.addPage();
        currentY = 50;
      }

      if (index % 2 === 0) {
        doc.rect(50, currentY - 5, 500, 20).fill('#f1f5f9');
        doc.fillColor('#1e293b');
      }

      doc.text(atm.name, 50, currentY);
      doc.text(`R$ ${formatBRL(atm.withdrawal)}`, 200, currentY, { width: 100, align: 'right' });
      doc.text(`R$ ${formatBRL(atm.deposit)}`, 320, currentY, { width: 100, align: 'right' });
      doc.font('Helvetica-Bold').text(`R$ ${formatBRL(atm.withdrawal + atm.deposit)}`, 450, currentY, { width: 100, align: 'right' }).font('Helvetica');
      
      currentY += 20;
    });

    // Footer
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).fillColor('#94a3b8').text(
        `Gerado em ${new Date().toLocaleString('pt-BR')}  |  Página ${i + 1} de ${pages.count}`,
        50,
        780,
        { align: 'center', width: 500 }
      );
    }

    doc.end();
  } catch (err) {
    console.error('Erro ao gerar PDF:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Falha ao gerar PDF' });
    }
  }
});

// POST /api/analyses/export/excel
// Exports consolidation to Excel
router.post('/export/excel', async (req, res) => {
  const { custodyId, date } = req.body;
  if (!custodyId || !date) {
    return res.status(400).json({ error: 'Parâmetros ausentes (custodyId, date)' });
  }

  try {
    const data = await getDetailData(custodyId, date);
    const atms = data.atms;

    const sheetData = atms.map(atm => ({
      'ATM': atm.name,
      'Identificação': atm.number,
      'Total Real Sacado (R$)': atm.withdrawalRaw,
      'Total Real Depositado (R$)': atm.depositRaw,
      'Previsão de Saque (R$)': +atm.withdrawal.toFixed(2),
      'Previsão de Depósito (R$)': +atm.deposit.toFixed(2),
      'Total Estimado (R$)': +(atm.withdrawal + atm.deposit).toFixed(2)
    }));

    // Totals row
    const totalW = atms.reduce((a, b) => a + b.withdrawal, 0);
    const totalD = atms.reduce((a, b) => a + b.deposit, 0);
    const totalRawW = atms.reduce((a, b) => a + b.withdrawalRaw, 0);
    const totalRawD = atms.reduce((a, b) => a + b.depositRaw, 0);

    sheetData.push({
      'ATM': 'TOTAL',
      'Identificação': '',
      'Total Real Sacado (R$)': totalRawW,
      'Total Real Depositado (R$)': totalRawD,
      'Previsão de Saque (R$)': +totalW.toFixed(2),
      'Previsão de Depósito (R$)': +totalD.toFixed(2),
      'Total Estimado (R$)': +(totalW + totalD).toFixed(2)
    });

    const worksheet = xlsx.utils.json_to_sheet(sheetData);
    worksheet['!cols'] = [
      { wch: 20 }, { wch: 15 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }
    ];

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Consolidação');

    const buf = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', `attachment; filename="consolidacao_${custodyId}_${date}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    console.error('Erro ao gerar Excel:', err);
    res.status(500).json({ error: 'Falha ao gerar Excel' });
  }
});

module.exports = router;
