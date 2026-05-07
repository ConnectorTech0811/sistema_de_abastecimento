const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const db = require('../database');
const authMiddleware = require('../middlewares/auth');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.use(authMiddleware);

/**
 * Optimized Upsert:
 * Breaks the work into small, per-day-per-ATM transactions.
 * This prevents long-held locks that cause "Lock wait timeout exceeded".
 */
async function upsertTransactions(transactions, filename) {
  if (transactions.length === 0) return;

  // Step 1: Deduplicate internal to the batch
  const uniqueMap = new Map();
  for (const t of transactions) {
    const key = `${t.id_atm}|${t.data_hora_transacao ?? 'NULL'}|${t.valor}|${t.tipo}|${t.nsu ?? 'NULL'}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, t);
    }
  }
  const deduped = Array.from(uniqueMap.values());

  // Step 2: Group by (id_atm, data)
  const groups = new Map(); // "atm|date" -> [transactions]
  for (const t of deduped) {
    if (!t.id_atm || !t.data) continue;
    const groupKey = `${t.id_atm}|${t.data}`;
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(t);
  }

  // Step 3: Process each group in its OWN small transaction
  // This minimizes lock duration and prevents global timeouts
  for (const [key, rows] of groups.entries()) {
    const [id_atm, data] = key.split('|');
    
    await db.transaction(async trx => {
      try {
        // Delete all old records for this specific ATM and Date
        await trx('tb_transacoes')
          .where({ id_atm, data })
          .delete();

        // Insert new records for this day
        // Chunk inserts inside the group if necessary (usually few rows per day/atm)
        const subChunkSize = 200;
        for (let i = 0; i < rows.length; i += subChunkSize) {
          await trx('tb_transacoes')
            .insert(rows.slice(i, i + subChunkSize))
            .onConflict(['id_atm', 'data_hora_transacao', 'valor', 'tipo', 'nsu'])
            .ignore();
        }
      } catch (err) {
        console.error(`[Import] Erro no grupo ${key} do arquivo ${filename}:`, err.message);
        throw err; // Will rollback this specific small transaction and bubble up
      }
    });
  }
}

// GET /api/import/imported-files
router.get('/imported-files', async (req, res) => {
  try {
    const rows = await db('tb_transacoes')
      .distinct('nome_arquivo')
      .whereNotNull('nome_arquivo')
      .orderBy('nome_arquivo', 'asc');
    const files = rows.map(r => r.nome_arquivo).filter(Boolean);
    return res.json({ files });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/import
router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

  const filenameOriginal = req.file.originalname || 'arquivo_desconhecido';
  console.log(`[Import] Processando: ${filenameOriginal}`);

  try {
    const filename = filenameOriginal.toLowerCase();
    const isTextFallback = filename.endsWith('.txt') || filename.endsWith('.csv') || req.file.mimetype.includes('text') || !filename.includes('.');

    let isTextFormat = false;
    if (isTextFallback) {
      const preview = fs.readFileSync(req.file.path, 'utf8').substring(0, 200);
      if (preview.includes('H:') || preview.includes('D:') || preview.includes(';')) isTextFormat = true;
    }

    if (isTextFormat) {
      const fileContent = fs.readFileSync(req.file.path, 'utf8');
      const lines = fileContent.split(/\r?\n/);
      let recordsProcessed = 0;
      let skippedLines = 0;

      const atmRows = await db('tb_atms').select('id', 'numero');
      const atmMap = new Map(atmRows.map(a => [a.numero, a.id]));

      let defaultCustodyId = req.body.custodyId || null;
      let minDate = null;
      let maxDate = null;
      const transactionsToInsert = [];
      const newAtms = new Set();

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || !line.startsWith('D:')) continue;

        const parts = line.split(';');
        if (parts.length < 6) continue;

        const atmCode     = (parts[0] || '').substring(2).trim();
        const dataHoraStr = (parts[1] || '').trim();
        const dataContStr = (parts[2] || '').trim();
        const controle    = (parts[3] || '').trim();
        const tipo        = (parts[4] || '').trim().toUpperCase();
        const valorStr    = (parts[5] || '').trim();
        const nsu         = (parts[6] || '').trim();

        if (!atmCode || !dataHoraStr || !dataContStr || !tipo || !valorStr) { skippedLines++; continue; }
        if (dataContStr.endsWith('31')) { skippedLines++; continue; }

        const amount = parseFloat(valorStr) / 100;
        if (isNaN(amount)) { skippedLines++; continue; }

        const transactionType = tipo === 'DEPOSITO' ? 'deposito' : 'saque';
        let transactionDatetime = null;
        if (dataHoraStr.length >= 14) {
          transactionDatetime = `${dataHoraStr.substring(0,4)}-${dataHoraStr.substring(4,6)}-${dataHoraStr.substring(6,8)} ${dataHoraStr.substring(8,10)}:${dataHoraStr.substring(10,12)}:${dataHoraStr.substring(12,14)}`;
        }

        let accountingDate = null;
        if (dataContStr.length >= 8) {
          accountingDate = `${dataContStr.substring(0,4)}-${dataContStr.substring(4,6)}-${dataContStr.substring(6,8)}`;
        }

        const transactionDate = transactionDatetime ? transactionDatetime.split(' ')[0] : accountingDate;
        if (transactionDate) {
          if (!minDate || transactionDate < minDate) minDate = transactionDate;
          if (!maxDate || transactionDate > maxDate) maxDate = transactionDate;
        }

        if (!atmMap.has(atmCode)) newAtms.add(atmCode);

        transactionsToInsert.push({
          _atmCode: atmCode,
          valor: amount,
          tipo: transactionType,
          data_hora_transacao: transactionDatetime,
          data_contabil: accountingDate,
          controle_contabil: (controle || '').substring(0, 15),
          nsu: (nsu || '').substring(0, 6),
          data: transactionDate,
          nome_arquivo: filenameOriginal,
        });
        recordsProcessed++;
      }

      // ── Step A: Ensure all ATMs exist (separate small transaction) ──
      if (newAtms.size > 0) {
        await db.transaction(async trx => {
          if (!defaultCustodyId) {
            const custody = await trx('tb_custodias').first();
            defaultCustodyId = custody ? custody.id : (await trx('tb_custodias').insert({ nome: 'Custódia Padrão' }))[0];
          }
          for (const code of newAtms) {
            let atm = await trx('tb_atms').where({ numero: code }).first();
            if (!atm) {
              const [newId] = await trx('tb_atms').insert({ numero: code, id_custodia: defaultCustodyId });
              atmMap.set(code, newId);
            } else {
              atmMap.set(code, atm.id);
            }
          }
        });
      }

      // ── Step B: Resolve IDs ──
      const resolved = transactionsToInsert
        .map(t => {
          const id_atm = atmMap.get(t._atmCode);
          if (!id_atm) return null;
          const { _atmCode, ...rest } = t;
          return { ...rest, id_atm };
        })
        .filter(Boolean);

      // ── Step C: Execute Upsert (using small transactions internally) ──
      await upsertTransactions(resolved, filenameOriginal);

      cleanup(req.file.path);
      return res.json({
        message: `✅ "${filenameOriginal}" importado!\n${formatDateRange(minDate, maxDate)}`,
        recordsProcessed,
        skippedLines,
      });

    } else {
      // ── EXCEL ─────────────────────────────────────────────────────────────
      const workbook = xlsx.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

      let minDate = null;
      let maxDate = null;
      const transactionsToInsert = [];

      const atmCache = new Map();
      const atmRows = await db('tb_atms').select('id', 'numero');
      atmRows.forEach(a => atmCache.set(a.numero, a.id));

      for (const row of data) {
        if (!row.ATM || !row.Date || !row.Type || !row.Amount) continue;

        const atmCode = row.ATM.toString();
        let atmId = atmCache.get(atmCode);
        
        if (!atmId) {
          // One-off ATM creation if missing in Excel
          await db.transaction(async trx => {
            let atm = await trx('tb_atms').where({ numero: atmCode }).first();
            if (!atm) {
              const c = await trx('tb_custodias').first();
              const cId = c ? c.id : (await trx('tb_custodias').insert({ nome: 'Custódia Padrão' }))[0];
              atmId = (await trx('tb_atms').insert({ numero: atmCode, id_custodia: cId }))[0];
            } else {
              atmId = atm.id;
            }
            atmCache.set(atmCode, atmId);
          });
        }

        let parsedDate = row.Date;
        if (typeof row.Date === 'number') {
          parsedDate = new Date((row.Date - (25567 + 2)) * 86400 * 1000).toISOString().split('T')[0];
        }

        transactionsToInsert.push({
          id_atm: atmId,
          data: parsedDate,
          tipo: row.Type.toLowerCase().includes('dep') ? 'deposito' : 'saque',
          valor: parseFloat(row.Amount),
          nome_arquivo: filenameOriginal,
        });

        if (parsedDate) {
          if (!minDate || parsedDate < minDate) minDate = parsedDate;
          if (!maxDate || parsedDate > maxDate) maxDate = parsedDate;
        }
      }

      await upsertTransactions(transactionsToInsert, filenameOriginal);

      cleanup(req.file.path);
      return res.json({
        message: `✅ "${filenameOriginal}" importado!\n${formatDateRange(minDate, maxDate)}`,
        recordsProcessed: data.length,
      });
    }
  } catch (err) {
    console.error(`[Import] Erro em ${filenameOriginal}:`, err.message);
    cleanup(req.file.path);
    return res.status(500).json({ error: 'Erro ao processar o arquivo: ' + (err?.message || '') });
  }
});

function cleanup(filePath) {
  try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
}

function formatDateRange(minDate, maxDate) {
  if (!minDate || !maxDate) return '';
  return `Período: ${minDate.split('-').reverse().join('/')} a ${maxDate.split('-').reverse().join('/')}`;
}

module.exports = router;
