import { UploadCloud, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useState, useRef } from 'react';

export const ImportData = ({ custodyId, isModal = false }: { custodyId?: string, isModal?: boolean }) => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setProgress(0);
    setError('');
    setSuccess('');

    const formData = new FormData();
    formData.append('file', file);
    if (custodyId) {
      formData.append('custodyId', custodyId);
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/import', true);
    xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('token')}`);
    
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.min(Math.round((event.loaded / event.total) * 100), 99);
        setProgress(percentComplete);
      }
    };

    xhr.onload = () => {
      setLoading(false);
      setProgress(100);
      if (fileInputRef.current) fileInputRef.current.value = '';

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
           const result = JSON.parse(xhr.responseText);
           setSuccess(result.message || `Upload concluído com sucesso! ${result.recordsProcessed || 0} registros processados.`);
        } catch {
           setSuccess(`Upload concluído com sucesso!`);
        }
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText);
          setError(errorData.error || 'Erro ao realizar upload do arquivo.');
        } catch {
          setError('Erro na conexão com o servidor.');
        }
      }
    };

    xhr.onerror = () => {
      setLoading(false);
      setError('Falha na conexão com o servidor.');
    };

    xhr.send(formData);
  };

  return (
    <div className={`space-y-6 w-full mx-auto ${isModal ? '' : 'max-w-3xl'}`}>
      {!isModal && (
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Importação de Dados</h1>
          <p className="text-slate-500 mt-1 font-medium">Faça o upload do Excel contendo os dados brutos de ATMs e transações.</p>
        </div>
      )}

      <div className={`bg-white ${isModal ? 'p-6' : 'p-10'} flex flex-col items-center justify-center ${isModal ? 'min-h-[300px]' : 'min-h-[400px]'} border-2 border-dashed border-primary-300 rounded-2xl shadow-sm hover:border-primary-500 transition-colors bg-primary-50/30`}>
        {loading ? (
          <div className="flex flex-col items-center w-full max-w-md">
            <Loader2 className="w-16 h-16 text-primary-600 animate-spin mb-6" />
            <p className="text-primary-700 font-bold uppercase tracking-widest text-sm mb-4">Processando arquivo... {progress}%</p>
            <div className="w-full bg-slate-200 rounded-full h-3">
              <div 
                className="bg-primary-600 h-3 rounded-full transition-all duration-300 ease-out flex items-center justify-center overflow-hidden" 
                style={{ width: `${progress}%` }}
              >
                <div className="w-full h-full bg-white/20 animate-pulse"></div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className={`${isModal ? 'w-16 h-16 mb-4' : 'w-24 h-24 mb-6'} rounded-full bg-primary-100 flex items-center justify-center shadow-inner border border-primary-200`}>
              <UploadCloud className={`${isModal ? 'w-8 h-8' : 'w-12 h-12'} text-primary-600`} />
            </div>
            <h3 className={`${isModal ? 'text-lg' : 'text-xl'} font-bold text-slate-800 mb-2 text-center`}>Arraste e solte o arquivo ou clique no botão</h3>
            <p className="text-slate-500 mb-8 text-center max-w-sm font-medium text-sm">
              Formatos suportados: .xlsx, .xls, .csv, .txt.
            </p>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".xlsx,.xls,.csv,.txt"
              onChange={handleFileChange}
            />
            <button 
              onClick={handleUploadClick}
              className="px-8 py-3.5 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 active:bg-primary-800 transition-all shadow-lg hover:shadow-xl flex items-center"
            >
              <UploadCloud className="w-5 h-5 mr-3" />
              Selecionar Arquivo
            </button>
            
            {success && (
              <div className="mt-8 bg-emerald-50 text-emerald-700 px-6 py-4 rounded-xl font-bold flex items-center border border-emerald-100 whitespace-pre-line text-left text-sm">
                <CheckCircle className="w-6 h-6 mr-3 text-emerald-600 flex-shrink-0" />
                {success}
              </div>
            )}
            
            {error && (
              <div className="mt-8 bg-rose-50 text-rose-700 px-6 py-4 rounded-xl font-bold flex items-center border border-rose-100 text-sm">
                <AlertCircle className="w-6 h-6 mr-3 text-rose-600" />
                {error}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
