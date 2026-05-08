import { useState } from 'react';
import { Lock, Mail, Check, Eye, EyeOff, Loader2, Banknote } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import loginImage from '../assets/loginatms.png';
import logoConnector from '../assets/logo_connector.png';
import { API_URL } from '../config';

export const Login = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos

      const response = await fetch(`${API_URL}/api/auth/authenticate`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMsg = 'Falha na autenticação';
        try {
          const data = await response.json();
          errorMsg = data.error || errorMsg;
        } catch {
          errorMsg = `Erro ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      navigate('/dashboard');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError('Tempo de conexão esgotado. O servidor está demorando muito para responder.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 md:p-8">
      <div className="max-w-5xl w-full bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[600px]">

        {/* Left Side - Illustration/Brand */}
        <div className="hidden md:flex w-1/2 relative bg-primary-900 overflow-hidden">
          <img
            src={loginImage}
            alt="Ilustração de abastecimento"
            className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary-900/90 via-primary-800/40 to-transparent"></div>

          <div className="relative z-10 flex flex-col justify-end items-center h-full w-full p-12 text-center pb-20">
            <h2 className="text-4xl font-black text-white mb-3 drop-shadow-md">Bem-vindo de volta!</h2>
            <p className="text-primary-50 text-base leading-relaxed max-w-sm drop-shadow-sm font-medium">
              Acesse o painel do Sistema de Abastecimento para gerar predições avançadas e gerenciar sua rede de ATMs.
            </p>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="w-full md:w-1/2 flex flex-col justify-center p-10 lg:p-16 bg-white relative">
          <div className="mb-10 text-center">
            <img src={logoConnector} alt="Connector Tech" className="h-16 w-auto mx-auto mb-6 object-contain" />
            <h2 className="text-3xl font-black text-slate-800 tracking-tight uppercase">Login</h2>
            <div className="w-12 h-1 bg-primary-500 mx-auto mt-4 rounded-full"></div>
          </div>

          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-bold animate-shake">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-slate-700">E-mail</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl pl-11 pr-4 py-3.5 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all font-medium placeholder:text-slate-400"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-slate-700">Senha</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl pl-11 pr-12 py-3.5 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all font-medium placeholder:text-slate-400"
                  placeholder="sua senha"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-primary-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <label
                className="flex items-center space-x-2 cursor-pointer group"
                onClick={() => setRememberMe(!rememberMe)}
              >
                <div className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-all ${rememberMe ? 'bg-primary-600 border-primary-600' : 'bg-white border-slate-300'
                  }`}>
                  <Check className={`w-3.5 h-3.5 text-white transition-opacity ${rememberMe ? 'opacity-100' : 'opacity-0'}`} />
                </div>
                <span className="text-sm font-semibold text-slate-600 group-hover:text-slate-800 transition-colors">Lembrar-me</span>
              </label>
              <button
                type="button"
                onClick={() => alert('Recuperação de senha em desenvolvimento.')}
                className="text-sm font-bold text-primary-600 hover:text-primary-700 hover:underline"
              >
                Esqueceu a Senha?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 transition-all transform hover:-translate-y-0.5 mt-4 flex items-center justify-center disabled:opacity-70 disabled:transform-none"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin mr-2 h-5 w-5" />
                  Autenticando...
                </>
              ) : 'Entrar'}
            </button>
          </form>

          <div className="mt-8 text-center">
            {/* <p className="text-sm font-medium text-slate-500 mb-6">
              Não Tem Uma Conta? <button 
                type="button"
                onClick={() => alert('Cadastro de novos usuários em desenvolvimento.')}
                className="text-primary-600 font-bold hover:underline"
              >
                Inscrever-se
              </button>
            </p> */}
            <div className="pt-6 border-t border-slate-100 flex flex-col items-center justify-center text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Desenvolvido para</p>
              <div className="flex items-center justify-center space-x-2 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-default bg-slate-50 px-4 py-2 rounded-lg border border-slate-100">
                <div className="bg-primary-600 p-1 rounded shadow-sm">
                  <Banknote className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-black text-primary-900 uppercase tracking-tight">ATMs supply</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
