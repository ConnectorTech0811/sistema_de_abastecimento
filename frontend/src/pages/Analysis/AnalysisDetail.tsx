import { ArrowLeft, Landmark, TrendingUp, DownloadCloud, Loader2, Calendar } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';

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

  // Fetch analysis config and detailed data
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

  const getTableData = () => {
    return atms.map(atm => {
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
    });
  };

  const displayData = getTableData();
  const totalW = displayData.reduce((a, b) => a + b.withdrawal, 0);
  const totalD = displayData.reduce((a, b) => a + b.deposit, 0);

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
                {displayData.map((atm) => (
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
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td className="px-6 py-4 text-xs font-black text-slate-500 uppercase">Totais Visíveis</td>
                  <td className="px-6 py-4 text-right text-xs font-bold text-slate-500">{formatCurrency(displayData.reduce((a, b) => a + b.rawW, 0))}</td>
                  <td className="px-6 py-4 text-right text-xs font-bold text-slate-500 border-r border-slate-100">{formatCurrency(displayData.reduce((a, b) => a + b.rawD, 0))}</td>
                  <td className="px-6 py-4 text-right text-sm font-black text-primary-800">{formatCurrency(totalW)}</td>
                  <td className="px-6 py-4 text-right text-sm font-black text-emerald-700">{formatCurrency(totalD)}</td>
                  <td className="px-6 py-4 text-right text-sm font-black text-slate-900">{formatCurrency(totalW - totalD)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
