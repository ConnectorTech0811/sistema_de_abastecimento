const db = require('../backend/src/database');

// Copy-pasting getDetailData logic from analyses.js to run in isolation
async function getDetailData(custodyId, referenceDate, customConfig = null) {
  let config = customConfig;

  if (!config) {
    const analysis = await db('tb_analises')
      .where({ id_custodia: custodyId, data_referencia: referenceDate })
      .first();

    if (!analysis) {
      throw new Error('Nenhuma análise salva encontrada para esta data');
    }

    config = typeof analysis.configuracao === 'string' ? JSON.parse(analysis.configuracao) : analysis.configuracao;
  }

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

  const allDates = Object.values(dateRows || {}).flat().map(d => d.date).filter(Boolean);
  const uniqueDates = [...new Set(allDates)];
  
  let transactions = [];
  if (uniqueDates.length > 0) {
    transactions = await db('tb_transacoes')
      .whereIn('id_atm', atms.map(a => a.id))
      .whereIn('data', uniqueDates);
  }

  const transMap = {};
  const macroTransMap = {};

  transactions.forEach(t => {
    const dateStr = t.data instanceof Date ? t.data.toISOString().split('T')[0] : t.data;
    const atmKey = `${t.id_atm}_${dateStr}_${t.tipo}`;
    const macroKey = `${dateStr}_${t.tipo}`;
    
    const val = parseFloat(t.valor) || 0;
    transMap[atmKey] = (transMap[atmKey] || 0) + val;
    macroTransMap[macroKey] = (macroTransMap[macroKey] || 0) + val;
  });

  const dailyTotals = uniqueDates.map(date => {
    return {
      date,
      withdrawal: macroTransMap[`${date}_saque`] || 0,
      deposit: macroTransMap[`${date}_deposito`] || 0
    };
  });

  const getFinalPrediction = (type, isMicro) => {
    let activeLines = lines.filter(row => isMicro ? row.micro : row.macro);
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

  const custody = custodyId === 'all' ? { id: 'all', nome: 'Custódia - Brasil (TODAS)' } : await db('tb_custodias').where({ id: custodyId }).first();
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

async function run() {
  // Test Case 1: Custody 4, Date 2026-05-18
  console.log('--- Test Case 1: Custody 4, Date 2026-05-18 ---');
  try {
    const data = await getDetailData(4, '2026-05-18');
    console.log('Result status: success');
    console.log('ATMs count:', data.atms.length);
    console.log('Summary:', data.summary);
  } catch (err) {
    console.error('Error:', err.message);
  }

  // Test Case 2: Custody 3, Date 2026-05-21
  console.log('\n--- Test Case 2: Custody 3, Date 2026-05-21 ---');
  try {
    const data = await getDetailData(3, '2026-05-21');
    console.log('Result status: success');
    console.log('ATMs count:', data.atms.length);
    console.log('Summary:', data.summary);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run().finally(() => db.destroy());
