import { ArrowLeft, Landmark, TrendingUp, DownloadCloud, Loader2, Calendar, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';

const PAGE_SIZE = 20;

const getDayOfWeek = (dateString: string) => {
  if (!dateString) return '';
  const data = new Date(dateString + 'T12:00:00');
  const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  return dias[data.getDay()] || '';
};

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const formatPercent = (val: number) => {
  if (val === undefined || val === null) return '0.0%';
  const diff = (val - 1) * 100;
  return (diff > 0 ? '+' : '') + diff.toFixed(1) + '%';
};

export const AnalysisDetail = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const custodyId = params.get('custody') || '1';
  const refDate = params.get('date') || '2026-03-30';

  const [custodyName, setCustodyName] = useState('');
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState('FINAL');
  const [atms, setAtms] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [search, selectedDate]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const resp = await fetch(`/api/analyses/detail`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ custodyId, referenceDate: refDate })
        });
        if (!resp.ok) {
          if (resp.status === 404) throw new Error('Nenhuma análise salva encontrada para esta data.');
          throw new Error('Falha ao buscar detalhamento');
        }
        const data = await resp.json();
        setAtms(data.atms || []);
        setAvailableDates(data.availableDates || []);
        setSummary(data.summary);
        if (data.custody) setCustodyName(data.custody.nome);
      } catch (err: any) {
        setError(err.message || 'Falha ao carregar dados');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [custodyId, refDate]);

  // Todos os ATMs transformados para a data selecionada
  const displayData = useMemo(() => atms.map(atm => {
    if (selectedDate === 'FINAL') {
      return {
        id: atm.id,
        name: atm.name,
        number: atm.number,
        rawW: Object.values(atm.dailyData || {}).reduce((a: any, b: any) => a + (b.rawW || 0), 0),
        rawD: Object.values(atm.dailyData || {}).reduce((a: any, b: any) => a + (b.rawD || 0), 0),
        withdrawal: atm.withdrawal,
        deposit: atm.deposit
      };
    } else {
      const day = atm.dailyData?.[selectedDate] || { rawW: 0, adjW: 0, rawD: 0, adjD: 0 };
      return {
        id: atm.id,
        name: atm.name,
        number: atm.number,
        rawW: day.rawW,
        rawD: day.rawD,
        withdrawal: day.adjW,
        deposit: day.adjD
      };
    }
  }), [atms, selectedDate]);

  // Totais globais — sempre sobre todos os ATMs, independente de filtro ou página
  const totalW    = useMemo(() => displayData.reduce((a, b) => a + b.withdrawal, 0), [displayData]);
  const totalD    = useMemo(() => displayData.reduce((a, b) => a + b.deposit,    0), [displayData]);
  const totalRawW = useMemo(() => displayData.reduce((a, b) => a + b.rawW,       0), [displayData]);
  const totalRawD = useMemo(() => displayData.reduce((a, b) => a + b.rawD,       0), [displayData]);

  // Dados filtrados pelo campo de busca
  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return displayData;
    return displayData.filter(
      atm => atm.name.toLowerCase().includes(q) || String(atm.number).toLowerCase().includes(q)
    );
  }, [displayData, search]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));

  // Dados da página atual
  const pagedData = useMemo(
    () => filteredData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredData, page]
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 text-primary-600 animate-spin" />
        <p className="text-slate-500 font-bold animate-pulse uppercase tracking-widest">Carregando Consolidação...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
        <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100 text-center max-w-md">
          <p className="text-rose-600 font-bold mb-4">{error}</p>
          <button
            onClick={() => navigate('/analysis')}
            className="px-6 py-2 bg-rose-600 text-white rounded-lg font-bold shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all"
          >
            Voltar para Análise
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/analysis')}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Consolidação da Predição</h1>
            <p className="text-slate-500 mt-1">{custodyName}</p>
          </div>
        </div>
        <div className="flex items-center space-x-6">
          <div className="text-right">
            <p className="text-sm font-bold text-slate-900 mb-1">
              {new Date(refDate + 'T12:00:00').toLocaleDateString('pt-BR')}
            </p>
            <p className="text-xs text-slate-500 uppercase tracking-tighter">
              {getDayOfWeek(refDate)} • Data de Previsão
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={async () => {
                try {
                  const resp = await fetch('/api/analyses/export/pdf', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({ custodyId, date: refDate })
                  });
                  if (!resp.ok) throw new Error('Falha ao gerar PDF');
                  const blob = await resp.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `consolidacao_${custodyId}_${refDate}.pdf`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch {
                  alert('Erro ao exportar PDF');
                }
              }}
              className="flex items-center px-4 py-2 bg-white border border-slate-200 text-rose-600 hover:bg-rose-50 rounded-lg shadow-sm transition-colors font-bold text-sm"
            >
              <DownloadCloud className="w-4 h-4 mr-2" />
              PDF
            </button>
            <button
              onClick={async () => {
                try {
                  const resp = await fetch('/api/analyses/export/excel', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({ custodyId, date: refDate })
                  });
                  if (!resp.ok) throw new Error('Falha ao gerar Excel');
                  const blob = await resp.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `consolidacao_${custodyId}_${refDate}.xlsx`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch {
                  alert('Erro ao exportar Excel');
                }
              }}
              className="flex items-center px-4 py-2 bg-white border border-slate-200 text-emerald-600 hover:bg-emerald-50 rounded-lg shadow-sm transition-colors font-bold text-sm"
            >
              <DownloadCloud className="w-4 h-4 mr-2" />
              Excel
            </button>
          </div>
        </div>
      </div>

      {/* View Selector & Summary Index */}
      <div className="flex flex-col xl:flex-row gap-6 items-start">
        <div className="w-full xl:w-72 bg-white border border-primary-100 shadow-sm p-5 rounded-xl relative overflow-hidden shrink-0">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-primary-500"></div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
            <Calendar className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
            Visualização
          </label>
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all cursor-pointer"
          >
            <option value="FINAL" className="font-black text-primary-700">🏆 CONSOLIDAÇÃO FINAL</option>
            <optgroup label="Dados Históricos">
              {availableDates.map(d => (
                <option key={d} value={d}>
                  {new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        {summary && selectedDate === 'FINAL' && (
          <div className="flex-1 bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-inner max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div className="flex items-center space-x-4">
                <div className="p-2.5 bg-slate-800 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Cenário Macro (Teto)</p>
                  <div className="flex space-x-4">
                    <span className="text-sm font-bold text-blue-300">S: {formatCurrency(summary.macroW)}</span>
                    <span className="text-sm font-bold text-emerald-400">D: {formatCurrency(summary.macroD)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-4 border-t sm:border-t-0 sm:border-l border-slate-800 pt-4 sm:pt-0 sm:pl-8">
                <div className="p-2.5 bg-slate-800 rounded-lg">
                  <Landmark className="w-5 h-5 text-primary-400" />
                </div>
                <div>
                  <p className="text-[10px] text-primary-400 font-black uppercase tracking-widest mb-1">Índice de Ajuste</p>
                  <div className="flex space-x-4">
                    <span className="text-base font-black text-white">S: {formatPercent(summary.indexW)}</span>
                    <span className="text-base font-black text-white">D: {formatPercent(summary.indexD)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ATM Table */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        {displayData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Landmark className="w-12 h-12 text-slate-300 mb-4" />
            <p className="text-slate-400 font-bold">Nenhuma análise salva encontrada para gerar o detalhamento.</p>
          </div>
        ) : (
          <>
            {/* Barra de filtro */}
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-100 bg-slate-50/60">
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar ATM por nome ou número..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                />
              </div>
              <p className="text-xs text-slate-400 font-bold whitespace-nowrap shrink-0">
                {search.trim()
                  ? `${filteredData.length} de ${displayData.length} ATMs`
                  : `${displayData.length} ATMs`}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">ATM / Identificação</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase text-right">Valor Real Sacado</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase text-right border-r border-slate-100">Valor Real Dep.</th>
                    <th className="px-6 py-4 text-[10px] font-black text-primary-600 uppercase text-right">Previsão Saque</th>
                    <th className="px-6 py-4 text-[10px] font-black text-emerald-600 uppercase text-right">Previsão Depósito</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-900 uppercase text-right">SALDO PREVISTO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {pagedData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm font-bold">
                        Nenhum ATM encontrado para "{search}"
                      </td>
                    </tr>
                  ) : (
                    pagedData.map((atm) => (
                      <tr key={atm.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center mr-3">
                              <Landmark className="w-4 h-4 text-slate-500" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-800">{atm.name}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase">ID: {atm.number}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-xs font-medium text-slate-500">{formatCurrency(atm.rawW)}</span>
                        </td>
                        <td className="px-6 py-4 text-right border-r border-slate-100">
                          <span className="text-xs font-medium text-slate-500">{formatCurrency(atm.rawD)}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-bold text-primary-800">{formatCurrency(atm.withdrawal)}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-bold text-emerald-700">{formatCurrency(atm.deposit)}</span>
                        </td>
                        <td className="px-6 py-4 text-right bg-slate-50/30">
                          <span className="text-sm font-black text-slate-900">{formatCurrency(atm.withdrawal - atm.deposit)}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td className="px-6 py-4">
                      <p className="text-xs font-black text-slate-500 uppercase">Total Geral</p>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">{displayData.length} ATMs</p>
                    </td>
                    <td className="px-6 py-4 text-right text-xs font-bold text-slate-500">{formatCurrency(totalRawW)}</td>
                    <td className="px-6 py-4 text-right text-xs font-bold text-slate-500 border-r border-slate-100">{formatCurrency(totalRawD)}</td>
                    <td className="px-6 py-4 text-right text-sm font-black text-primary-800">{formatCurrency(totalW)}</td>
                    <td className="px-6 py-4 text-right text-sm font-black text-emerald-700">{formatCurrency(totalD)}</td>
                    <td className="px-6 py-4 text-right text-sm font-black text-slate-900">{formatCurrency(totalW - totalD)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/40">
                <p className="text-xs text-slate-500 font-medium">
                  Exibindo{' '}
                  <span className="font-black text-slate-700">
                    {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredData.length)}
                  </span>{' '}
                  de{' '}
                  <span className="font-black text-slate-700">{filteredData.length}</span> ATMs
                </p>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white hover:border-primary-300 hover:text-primary-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                    .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, idx) =>
                      p === 'ellipsis' ? (
                        <span key={`e-${idx}`} className="px-2 text-slate-400 text-xs select-none">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setPage(p as number)}
                          className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold transition-all border ${
                            page === p
                              ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                              : 'border-slate-200 text-slate-600 hover:bg-white hover:border-primary-300 hover:text-primary-600'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    )}

                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white hover:border-primary-300 hover:text-primary-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
