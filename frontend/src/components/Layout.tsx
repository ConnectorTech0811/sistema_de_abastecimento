import { useState } from 'react';
import { Menu, X, LayoutDashboard, Calculator, FileUp, Users, Settings, LogOut, ChevronRight, Banknote } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import logoConnector from '../assets/logo_connector.png';
import { Footer } from './Footer';

const sidebarItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Calculator, label: 'Análise de ATMs', path: '/analysis' },
  { icon: Users, label: 'Usuários', path: '/users', adminOnly: true },
  { icon: Settings, label: 'Custódias', path: '/custodies', adminOnly: true },
];

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const navigate = useNavigate();

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const isAdmin = user?.role === 'admin';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-white transition-colors duration-300 flex">
      {/* Sidebar */}
      <aside 
        className={`fixed top-0 left-0 z-40 h-screen transition-transform ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } w-64 bg-white border-r border-slate-200 shadow-xl flex flex-col`}
      >
        <div className="flex flex-col h-full pt-4">
          <div className="h-20 flex items-center justify-center px-6 border-b border-slate-100 mb-4">
            <img src={logoConnector} alt="Connector Tech" className="h-12 w-auto object-contain" />
          </div>

          <nav className="flex-1 overflow-y-auto px-4 space-y-2">
            {sidebarItems.filter(i => !i.adminOnly || isAdmin).map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 rounded-xl transition-all duration-200 group font-bold ${
                    isActive
                      ? 'bg-primary-50 text-primary-700 shadow-sm border border-primary-100'
                      : 'text-slate-600 hover:bg-primary-50 hover:text-primary-600'
                  }`
                }
              >
                <item.icon className="w-5 h-5 mr-3 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </NavLink>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-100 mt-auto">
            <button 
              onClick={handleLogout}
              className="flex items-center w-full px-4 py-3 text-sm font-bold text-slate-600 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-colors"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Sair
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main 
        className={`transition-all duration-300 flex-1 ${
          isSidebarOpen ? 'ml-64' : 'ml-0'
        } min-h-screen flex flex-col bg-slate-50`}
      >
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 flex items-center px-6 shadow-sm">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-lg text-slate-500 hover:bg-primary-50 hover:text-primary-600 transition-colors"
            >
              {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            
            <div className="flex items-center space-x-2">
              <div className="bg-primary-600 p-1.5 rounded-lg shadow-sm">
                <Banknote className="h-6 w-6 text-white" />
              </div>
              <span className="text-lg font-black text-primary-900 tracking-tighter uppercase hidden sm:block">
                ATMs supply
              </span>
            </div>
          </div>
          
          <div className="flex-1 flex justify-center">
            <h1 className="text-base font-bold text-slate-400 uppercase tracking-widest hidden lg:block">
              Sistema de Abastecimento
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-primary-900">{user?.name || 'Usuário'}</p>
              <p className="text-xs text-slate-500">{user?.email || 'email@sistema.com'}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold shadow-sm border border-primary-200">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6 md:p-8 flex-1 flex flex-col">
          <div className="flex-1">
            {children}
          </div>
        </div>
        
        <Footer />
      </main>
    </div>
  );
};
