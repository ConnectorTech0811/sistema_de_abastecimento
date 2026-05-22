import { Activity, Landmark, FileText, TrendingUp, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { API_URL } from '../config';

export const Dashboard = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const resp = await fetch(`${API_URL}/api/dashboard/stats`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const stats = await resp.json();
        setData(stats);
      } catch (err) {
        console.error('Erro ao buscar stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const stats = [
    { title: 'Total de ATMs', value: data?.totalAtms || '0', icon: Landmark, trend: '+12%', color: 'from-blue-500 to-cyan-400' },
    { title: 'Custódias Ativas', value: data?.activeCustodies || '0', icon: Activity, trend: '+2', color: 'from-emerald-500 to-teal-400' },
    { title: 'Análises no Mês', value: data?.monthlyAnalyses || '0', icon: FileText, trend: '+24%', color: 'from-primary-500 to-indigo-500' },
    { title: 'Previsões Geradas', value: data?.predictionsCount > 1000 ? (data.predictionsCount / 1000).toFixed(1) + 'K' : data?.predictionsCount || '0', icon: TrendingUp, trend: '+5%', color: 'from-orange-500 to-amber-400' },
  ];

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const diffMs = new Date().getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `Há ${diffMins} minutos`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Há ${diffHours} horas`;
    return date.toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-12 h-12 text-primary-600 animate-spin" />
        <p className="mt-4 text-slate-500 font-bold uppercase tracking-widest animate-pulse">Carregando Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard Geral</h1>
          <p className="text-slate-500 mt-1">Visão panorâmica do sistema de abastecimento.</p>
        </div>
        {/* <button className="mt-4 md:mt-0 flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-md transition-colors font-medium">
          <DownloadCloud className="w-4 h-4 mr-2" />
          Exportar Relatório
        </button> */}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 relative overflow-hidden group">
            <div className={`absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br ${stat.color} rounded-full opacity-10 group-hover:scale-150 transition-transform duration-500`}></div>
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} text-white shadow-lg`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <span className="text-sm font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                {stat.trend}
              </span>
            </div>
            <div>
              <h3 className="text-3xl font-bold text-slate-800">{stat.value}</h3>
              <p className="text-sm text-slate-500 mt-1 font-medium">{stat.title}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 shadow-sm rounded-xl p-6 min-h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-slate-800">Volume de Transações Recentes</h2>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 bg-primary-500 rounded-full"></span>
              <span className="text-xs font-bold text-slate-500 uppercase">Total Movimentado (R$)</span>
            </div>
          </div>

          <div className="relative h-[300px] w-full mt-4">
            {/* Grid Lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-10">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="w-full border-t border-slate-100/50"></div>
              ))}
            </div>

            {/* SVG Chart */}
            <svg viewBox="0 0 1000 300" className="w-full h-full overflow-visible" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0" />
                </linearGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {data?.chartData && data.chartData.length > 0 && (
                <>
                  {/* Area Fill */}
                  <path
                    d={`M 0,300 ${data.chartData.map((d: any, i: number) => {
                      const maxVal = Math.max(...data.chartData.map((v: any) => v.value), 1);
                      const x = (i / (data.chartData.length - 1)) * 1000;
                      const y = 280 - (d.value / maxVal) * 240;
                      return `L ${x},${y}`;
                    }).join(' ')} L 1000,300 Z`}
                    fill="url(#chartGradient)"
                    className="transition-all duration-1000 ease-in-out"
                  />

                  {/* The Main Line */}
                  <path
                    d={data.chartData.map((d: any, i: number) => {
                      const maxVal = Math.max(...data.chartData.map((v: any) => v.value), 1);
                      const x = (i / (data.chartData.length - 1)) * 1000;
                      const y = 280 - (d.value / maxVal) * 240;
                      return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
                    }).join(' ')}
                    fill="none"
                    stroke="rgb(59, 130, 246)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#glow)"
                    className="transition-all duration-1000 ease-in-out"
                  />

                  {/* Interactivity Points */}
                  {data.chartData.map((d: any, i: number) => {
                    const maxVal = Math.max(...data.chartData.map((v: any) => v.value), 1);
                    const x = (i / (data.chartData.length - 1)) * 1000;
                    const y = 280 - (d.value / maxVal) * 240;
                    return (
                      <g key={i} className="group cursor-pointer">
                        <circle
                          cx={x}
                          cy={y}
                          r="6"
                          fill="white"
                          stroke="rgb(59, 130, 246)"
                          strokeWidth="3"
                          className="hover:r-8 transition-all duration-300"
                        />
                        {/* Hidden Tooltip Area */}
                        <foreignObject x={x - 60} y={y - 60} width="120" height="50" className="overflow-visible pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:-translate-y-2">
                          <div className="bg-slate-900 text-white text-[10px] font-black py-2 px-3 rounded-lg shadow-2xl text-center relative border border-slate-700">
                            R$ {d.value.toLocaleString('pt-BR')}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-900"></div>
                          </div>
                        </foreignObject>
                        {/* X-Axis Labels */}
                        <text x={x} y="320" textAnchor="middle" className="text-[11px] font-bold fill-slate-400 uppercase tracking-tighter">
                          {d.date}
                        </text>
                      </g>
                    );
                  })}
                </>
              )}
            </svg>
          </div>
        </div>
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-6">Atividade Recente</h2>
          <div className="space-y-4">
            {data?.recentActivity?.length > 0 ? data.recentActivity.map((activity: any) => (
              <div key={activity.id} className="flex items-start space-x-3 p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                <div className="w-2 h-2 mt-2 rounded-full bg-primary-500"></div>
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    Análise gerada para {activity.custodyName}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {formatTimeAgo(activity.created_at)} por {activity.userName}
                  </p>
                </div>
              </div>
            )) : (
              <p className="text-center text-slate-400 text-sm py-8 italic">Nenhuma atividade recente registrada.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
