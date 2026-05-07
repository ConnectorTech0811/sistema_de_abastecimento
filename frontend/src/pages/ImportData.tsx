import { UploadCloud, Loader2, CheckCircle, AlertCircle, FileText, X, SkipForward, RefreshCw } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import { API_URL } from '../config';

type FileStatus = 'pending' | 'already_imported' | 'uploading' | 'success' | 'error' | 'skipped';

interface FileResult {
  file: File;
  status: FileStatus;
  message?: string;
  progress?: number;
  forceImport?: boolean;
}

export const ImportData = ({ custodyId, isModal = false }: { custodyId?: string, isModal?: boolean }) => {
  const [loading, setLoading] = useState(false);
  const [fileResults, setFileResults] = useState<FileResult[]>([]);
  const [importedFiles, setImportedFiles] = useState<Set<string>>(new Set());
  const [checkingFiles, setCheckingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stopQueueRef = useRef(false);

  useEffect(() => {
    fetchImportedFiles();
  }, []);

  const fetchImportedFiles = async () => {
    try {
      setCheckingFiles(true);
      const res = await fetch(`${API_URL}/api/import/imported-files`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (res.status === 401) {
        // Token expired
        console.warn('Sessão expirada ao buscar arquivos importados');
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setImportedFiles(new Set((data.files || []).map((f: string) => f.toLowerCase())));
      }
    } catch {
      // Silent fail
    } finally {
      setCheckingFiles(false);
    }
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(e.target.files || []);
    if (incoming.length === 0) return;

    setFileResults(prev => {
      const existing = new Set(prev.map(r => r.file.name.toLowerCase()));
      const fresh: FileResult[] = incoming
        .filter(f => !existing.has(f.name.toLowerCase()))
        .map(f => ({
          file: f,
          status: importedFiles.has(f.name.toLowerCase()) ? 'already_imported' : 'pending',
          progress: 0,
        }));
      return [...prev, ...fresh];
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (idx: number) => {
    setFileResults(prev => prev.filter((_, i) => i !== idx));
  };

  const toggleForceImport = (idx: number) => {
    setFileResults(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const force = !r.forceImport;
      return { ...r, forceImport: force, status: force ? 'pending' : 'already_imported' };
    }));
  };

  const uploadFile = (result: FileResult, idx: number): Promise<boolean> => {
    return new Promise((resolve) => {
      setFileResults(prev => prev.map((r, i) => i === idx ? { ...r, status: 'uploading', progress: 0 } : r));

      const formData = new FormData();
      formData.append('file', result.file);
      if (custodyId) formData.append('custodyId', custodyId);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_URL}/api/import`, true);
      xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('token')}`);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const pct = Math.min(Math.round((event.loaded / event.total) * 100), 99);
          setFileResults(prev => prev.map((r, i) => i === idx ? { ...r, progress: pct } : r));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const res = JSON.parse(xhr.responseText);
            setFileResults(prev => prev.map((r, i) => i === idx
              ? { ...r, status: 'success', progress: 100, message: res.message || `${res.recordsProcessed || 0} registros processados.` }
              : r
            ));
            setImportedFiles(prev => new Set([...prev, result.file.name.toLowerCase()]));
          } catch {
            setFileResults(prev => prev.map((r, i) => i === idx ? { ...r, status: 'success', progress: 100, message: 'Concluído.' } : r));
          }
          resolve(true);
        } else {
          let msg = 'Erro desconhecido.';
          let isAuthError = false;

          if (xhr.status === 401) {
            msg = 'Token inválido ou sessão expirada. Por favor, faça login novamente.';
            isAuthError = true;
          } else {
            try {
              const err = JSON.parse(xhr.responseText);
              msg = err.error || 'Erro no processamento.';
            } catch {
              msg = 'Erro na requisição.';
            }
          }

          setFileResults(prev => prev.map((r, i) => i === idx ? { ...r, status: 'error', message: msg } : r));
          
          if (isAuthError) {
            stopQueueRef.current = true;
          }
          resolve(false);
        }
      };

      xhr.onerror = () => {
        setFileResults(prev => prev.map((r, i) => i === idx ? { ...r, status: 'error', message: 'Falha na conexão com o servidor.' } : r));
        resolve(false);
      };

      xhr.send(formData);
    });
  };

  const handleStartImport = async () => {
    if (fileResults.length === 0) return;
    setLoading(true);
    stopQueueRef.current = false;

    for (let i = 0; i < fileResults.length; i++) {
      if (stopQueueRef.current) {
        setFileResults(prev => prev.map((r, idx) => (idx >= i && r.status === 'pending') ? { ...r, status: 'error', message: 'Sessão expirada. Pare o processo e faça login novamente.' } : r));
        break;
      }

      const r = fileResults[i];
      if (r.status === 'success' || r.status === 'skipped' || r.status === 'error') continue;

      if (r.status === 'already_imported' && !r.forceImport) {
        setFileResults(prev => prev.map((fr, idx) => idx === i ? { ...fr, status: 'skipped', message: 'Arquivo já importado. Pulado.' } : fr));
        continue;
      }

      await uploadFile(r, i);
    }

    setLoading(false);
  };

  const handleReset = () => {
    setFileResults([]);
    stopQueueRef.current = false;
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const hasFiles = fileResults.length > 0;
  const allDone = hasFiles && fileResults.every(r => ['success', 'error', 'skipped'].includes(r.status));
  const pendingCount = fileResults.filter(r => r.status === 'pending').length;
  const alreadyCount = fileResults.filter(r => r.status === 'already_imported').length;
  const willSkipCount = fileResults.filter(r => r.status === 'already_imported' && !r.forceImport).length;

  const statusIcon = (status: FileStatus) => {
    if (status === 'uploading') return <Loader2 className="w-4 h-4 text-primary-500 animate-spin" />;
    if (status === 'success') return <CheckCircle className="w-4 h-4 text-emerald-500" />;
    if (status === 'error') return <AlertCircle className="w-4 h-4 text-rose-500" />;
    if (status === 'already_imported') return <AlertCircle className="w-4 h-4 text-amber-500" />;
    if (status === 'skipped') return <SkipForward className="w-4 h-4 text-slate-400" />;
    return null;
  };

  const statusColor: Record<FileStatus, string> = {
    pending: 'bg-white',
    already_imported: 'bg-amber-50',
    uploading: 'bg-primary-50/40',
    success: 'bg-emerald-50/40',
    error: 'bg-rose-50/40',
    skipped: 'bg-slate-50',
  };

  return (
    <div className={`space-y-6 w-full mx-auto ${isModal ? '' : 'max-w-3xl'}`}>
      {!isModal && (
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Importação de Dados</h1>
          <p className="text-slate-500 mt-1 font-medium">
            Selecione um ou mais arquivos. Arquivos já importados serão identificados automaticamente.
          </p>
        </div>
      )}

      {!hasFiles && (
        <div
          className={`bg-white ${isModal ? 'p-6' : 'p-10'} flex flex-col items-center justify-center ${isModal ? 'min-h-[240px]' : 'min-h-[300px]'} border-2 border-dashed border-primary-300 rounded-2xl shadow-sm hover:border-primary-500 transition-colors bg-primary-50/30 cursor-pointer`}
          onClick={handleUploadClick}
        >
          {checkingFiles ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
              <p className="text-slate-400 text-sm font-medium">Verificando arquivos importados...</p>
            </div>
          ) : (
            <>
              <div className={`${isModal ? 'w-16 h-16 mb-4' : 'w-20 h-20 mb-5'} rounded-full bg-primary-100 flex items-center justify-center shadow-inner border border-primary-200`}>
                <UploadCloud className={`${isModal ? 'w-8 h-8' : 'w-10 h-10'} text-primary-600`} />
              </div>
              <h3 className={`${isModal ? 'text-lg' : 'text-xl'} font-bold text-slate-800 mb-1 text-center`}>
                Arraste e solte ou clique aqui
              </h3>
              <p className="text-slate-500 mb-4 text-center max-w-sm font-medium text-sm">
                Selecione <span className="text-primary-600 font-bold">um ou mais arquivos</span>. Formatos: .xlsx, .xls, .csv, .txt
              </p>
            </>
          )}
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".xlsx,.xls,.csv,.txt"
        multiple
        onChange={handleFileChange}
      />

      {hasFiles && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-sm font-bold text-slate-700">
                {fileResults.length} arquivo{fileResults.length > 1 ? 's' : ''}
              </p>
              {alreadyCount > 0 && !allDone && (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  <AlertCircle className="w-3 h-3" />
                  {alreadyCount} já importado{alreadyCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            {!loading && (
              <button
                onClick={handleUploadClick}
                className="text-xs text-primary-600 font-bold hover:underline"
              >
                + Adicionar mais
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {fileResults.map((result, idx) => (
              <div key={idx} className={`px-5 py-3 flex items-start gap-3 transition-colors ${statusColor[result.status]}`}>
                <FileText className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{result.file.name}</p>
                  {result.status === 'uploading' && (
                    <div className="mt-1.5">
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div className="bg-primary-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${result.progress || 0}%` }} />
                      </div>
                    </div>
                  )}
                  {result.status === 'already_imported' && (
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <p className="text-xs text-amber-600 font-semibold">⚠️ Já importado</p>
                      <button onClick={() => toggleForceImport(idx)} className="text-xs text-primary-600 underline font-bold">
                        {result.forceImport ? 'Cancelar reimportação' : 'Forçar reimportação'}
                      </button>
                    </div>
                  )}
                  {result.message && <p className={`text-xs mt-0.5 ${result.status === 'error' ? 'text-rose-600' : result.status === 'success' ? 'text-emerald-600' : 'text-slate-400'}`}>{result.message}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                  {statusIcon(result.status)}
                  {!loading && !['success', 'uploading'].includes(result.status) && (
                    <button onClick={() => removeFile(idx)} className="text-slate-200 hover:text-rose-400">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center gap-3 justify-between">
            <button onClick={fetchImportedFiles} disabled={loading || checkingFiles} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
              <RefreshCw className={`w-3 h-3 ${checkingFiles ? 'animate-spin' : ''}`} />
              Atualizar lista
            </button>
            <div className="flex items-center gap-2">
              {!loading && !allDone && (
                <>
                  <button onClick={handleReset} className="px-4 py-2 text-sm font-bold text-slate-500">Cancelar</button>
                  <button onClick={handleStartImport} className="px-6 py-2.5 bg-primary-600 text-white rounded-xl font-bold text-sm shadow-md">
                    Importar {pendingCount} arquivos
                  </button>
                </>
              )}
              {loading && <p className="text-sm text-primary-600 font-bold flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Importando...</p>}
              {allDone && <button onClick={handleReset} className="px-6 py-2.5 bg-slate-700 text-white rounded-xl font-bold text-sm shadow-md">Nova Importação</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
