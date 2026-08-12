import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Download, 
  Mic2, 
  RotateCcw, 
  Trash2,
  Activity,
  History,
  CheckCircle2,
  AlertCircle,
  Database,
  Zap,
  Play,
  Volume2,
  Sun,
  Moon
} from 'lucide-react';
import { VOICES } from './constants';
import { useTTSQueue } from './hooks/useTTSQueue';

export default function App() {
  const [text, setText] = useState('');
  const [selectedVoiceId, setSelectedVoiceId] = useState(VOICES[0].id);
  const [speed, setSpeed] = useState(1.0);
  const [pitch, setPitch] = useState(0);
  const [showMonitor, setShowMonitor] = useState(false);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('voxgemini-theme');
      if (saved === 'light' || saved === 'dark') return saved;
      if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light';
    }
    return 'dark';
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      window.localStorage.setItem('voxgemini-theme', next);
      return next;
    });
  };

  const { 
    isProcessing,
    isPreviewing,
    segments, 
    currentId, 
    logs, 
    totalProgress, 
    finalAudioUrl, 
    error,
    startNewSession,
    previewVoice,
    resetAll
  } = useTTSQueue();

  const handlePreviewStatus = (voiceId: string) => {
    if (previewingVoiceId === voiceId) {
      if (audioRef.current) {
        audioRef.current.pause();
        setPreviewingVoiceId(null);
      }
      return;
    }

    const voice = VOICES.find(v => v.id === voiceId);
    if (!voice) return;

    setPreviewingVoiceId(voiceId);
    previewVoice(voice.id, voice.previewText).then(url => {
      if (url) {
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.play();
          audioRef.current.onended = () => setPreviewingVoiceId(null);
        } else {
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.play();
          audio.onended = () => setPreviewingVoiceId(null);
        }
      } else {
        setPreviewingVoiceId(null);
      }
    });
  };

  const handleGenerate = () => {
    if (!text.trim()) return;
    setShowMonitor(true);
    startNewSession(text, {
      voiceId: selectedVoiceId,
      speed,
      pitch
    });
  };

  const handleDownload = () => {
    if (!finalAudioUrl) return;
    const a = document.createElement('a');
    a.href = finalAudioUrl;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `vox-gemini-master-${timestamp}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const completedSegments = segments.filter(s => s.status === 'completed').length;

  return (
    <div data-theme={theme} className="min-h-screen mesh-bg selection:bg-violet-500/30 font-sans p-6 overflow-hidden flex items-center justify-center transition-colors duration-300">
      {/* Decorative Atmosphere */}
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-violet-600/30 blur-[120px] rounded-full translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-cyan-600/20 blur-[100px] rounded-full -translate-x-1/2 translate-y-1/2" />
      </div>

      <div className="w-full max-w-7xl h-full max-h-[900px] flex gap-6 relative z-10 transition-all duration-500">
        
        {/* Sidebar: Voice Selection & Settings */}
        <aside className="w-80 flex flex-col gap-6 h-full shrink-0">
          <div className="glass-card p-6 flex flex-col h-full overflow-hidden min-h-0">
            <header className="flex items-center gap-3 mb-8">
              <motion.div 
                animate={isProcessing ? { rotate: 360 } : {}}
                transition={isProcessing ? { repeat: Infinity, duration: 2, ease: "linear" } : {}}
                className="w-10 h-10 bg-gradient-to-tr from-violet-600 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg shadow-violet-900/20"
              >
                <div className="relative">
                  <Mic2 size={24} className="text-white" />
                  {isProcessing && (
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white/10 rounded-full"
                    />
                  )}
                </div>
              </motion.div>
              <div>
                <h1 className="text-xl font-bold tracking-tight leading-none">VoxGemini</h1>
                <p className="text-[10px] text-faint font-mono uppercase tracking-widest mt-1">v1.2 PRO / Themed</p>
              </div>

              <button 
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
                className="ml-auto w-10 h-10 rounded-xl bg-surface border border-line-soft flex items-center justify-center text-muted hover:text-app hover:bg-surface-strong transition-all"
              >
                {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
              </button>
            </header>

            <div className="flex items-center justify-between mb-4">
              <label className="text-[10px] font-bold text-faint uppercase tracking-widest">Catálogo</label>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span className="text-[9px] font-mono text-muted">ONLINE</span>
              </div>
            </div>

            <div className="space-y-3 overflow-y-auto pr-2 flex-grow min-h-0 custom-scrollbar">
              {VOICES.map((voice) => (
                <div
                  key={voice.id}
                  className={`w-full text-left p-4 rounded-2xl border transition-all relative group flex flex-col gap-2 ${
                    selectedVoiceId === voice.id 
                      ? 'voice-card-active' 
                      : 'bg-surface shadow-[var(--t-card-shadow)] hover:bg-surface-strong border-line-soft opacity-60 grayscale-[0.5] hover:grayscale-0'
                  } ${isProcessing ? 'opacity-20' : ''}`}
                >
                  <div 
                    className="cursor-pointer"
                    onClick={() => !isProcessing && setSelectedVoiceId(voice.id)}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={`font-semibold text-sm ${selectedVoiceId === voice.id ? 'text-app' : 'text-app-soft'}`}>
                        {voice.name}
                      </span>
                      {selectedVoiceId === voice.id && (
                        <div className="w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.5)]" />
                      )}
                    </div>
                    <p className="text-[10px] text-muted truncate mb-1">{voice.style}</p>
                    <p className="text-[9px] text-faint line-clamp-1">{voice.description}</p>
                  </div>

                  <div className="flex items-center justify-end pt-2 mt-1 border-t border-line-soft">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePreviewStatus(voice.id);
                      }}
                      disabled={isProcessing || (isPreviewing && previewingVoiceId !== voice.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-bold tracking-wider border transition-all ${
                        previewingVoiceId === voice.id
                          ? 'bg-violet-500 border-violet-400 text-white shadow-lg shadow-violet-500/20'
                          : 'bg-surface border-line text-muted hover:text-app hover:bg-surface-strong'
                      } disabled:opacity-30 disabled:cursor-not-allowed`}
                    >
                      {previewingVoiceId === voice.id && isPreviewing ? (
                        <RotateCcw size={10} className="animate-spin" />
                      ) : previewingVoiceId === voice.id ? (
                        <Volume2 size={10} />
                      ) : (
                        <Play size={10} />
                      )}
                      {previewingVoiceId === voice.id ? 'REPRODUZINDO' : 'ÁUDIO'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 space-y-6 pt-6 border-t border-line-soft shrink-0">
              <div className="space-y-4">
                <div className="flex justify-between mb-1">
                  <label className="text-[10px] text-faint uppercase tracking-widest font-bold">Velocidade</label>
                  <span className="text-[10px] text-violet-400 font-bold font-mono">{speed.toFixed(2)}x</span>
                </div>
                <input 
                  type="range" 
                  min="0.5" 
                  max="2.0" 
                  step="0.25" 
                  value={speed}
                  disabled={isProcessing}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className={`w-full h-1 custom-slider ${isProcessing ? 'opacity-30' : ''}`}
                />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between mb-1">
                  <label className="text-[10px] text-faint uppercase tracking-widest font-bold">Tom (Pitch)</label>
                  <span className="text-[10px] text-cyan-400 font-bold font-mono">{pitch > 0 ? '+' : ''}{pitch} st</span>
                </div>
                <input 
                  type="range" 
                  min="-10" 
                  max="10" 
                  step="1" 
                  value={pitch}
                  disabled={isProcessing}
                  onChange={(e) => setPitch(parseInt(e.target.value))}
                  className={`w-full h-1 custom-slider ${isProcessing ? 'opacity-30' : ''}`}
                />
              </div>
            </div>
          </div>
        </aside>

        {/* Main Interface */}
        <div className="flex-1 flex flex-col gap-6 h-full min-w-0">
          <main className={`flex flex-col gap-6 transition-all duration-500 ${showMonitor || segments.length > 0 ? 'flex-1 overflow-hidden' : 'h-full'}`}>
            <section className="glass-card p-8 flex flex-col h-full relative overflow-hidden group">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <History size={16} className="text-faint" />
                  <span className="text-sm font-medium text-muted">Roteiro Principal</span>
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setText('')}
                    disabled={isProcessing || !text}
                    className="text-xs text-faint hover:text-app transition-colors disabled:opacity-30 flex items-center gap-1.5"
                  >
                    <Trash2 size={12} />
                    Limpar
                  </button>
                  <span className="text-xs px-2 py-1 bg-surface-strong rounded text-faint font-mono">
                    {text.length.toLocaleString()} CARACTERES
                  </span>
                </div>
              </div>
              
              <textarea 
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={isProcessing}
                className="tts-textarea flex-1 min-h-[340px] outline-none resize-none text-lg md:text-2xl leading-loose text-app-soft font-light custom-scrollbar"
                placeholder="Insira um texto longo. O sistema irá dividi-lo e processá-lo automaticamente em blocos otimizados..."
              />
              
              <div className="mt-8 flex gap-4 shrink-0">
                {segments.length > 0 && !isProcessing && (
                  <button 
                    onClick={resetAll}
                    className="h-16 px-8 rounded-2xl bg-surface text-muted hover:text-app hover:bg-surface-strong transition-all flex items-center justify-center gap-3 border border-line"
                  >
                    <RotateCcw size={20} />
                    RESET
                  </button>
                )}
                <button 
                  onClick={handleGenerate}
                  disabled={isProcessing || !text.trim()}
                  className={`flex-1 h-16 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-3 relative overflow-hidden group/btn ${
                    isProcessing || !text.trim()
                      ? 'btn-generate-disabled'
                      : 'btn-premium cursor-pointer'
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>PROCESSANDO FILA...</span>
                    </>
                  ) : (
                    <>
                      <Zap size={20} fill="currentColor" />
                      <span>INICIAR GERAÇÃO OTIMIZADA</span>
                    </>
                  )}
                </button>
              </div>
            </section>
          </main>

          {/* Smart Monitor Panel */}
          <AnimatePresence>
            {(showMonitor || segments.length > 0) && (
              <motion.section 
                initial={{ opacity: 0, y: 50, height: 0 }}
                animate={{ opacity: 1, y: 0, height: '40%' }}
                exit={{ opacity: 0, y: 50, height: 0 }}
                className="glass-card overflow-hidden flex flex-col shrink-0"
              >
                <div className="p-4 border-b border-line-soft bg-panel flex items-center justify-between sticky top-0 z-10">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <Activity size={16} className={isProcessing ? "text-violet-400" : "text-muted"} />
                        <h3 className="font-bold text-xs tracking-tight">ENGINE MONITOR</h3>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-[9px] text-faint font-bold uppercase">Queue</p>
                      <p className="font-mono text-[10px] font-bold text-violet-400">
                        {completedSegments} / {segments.length} BLOCKS
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-faint font-bold uppercase">Progress</p>
                      <p className="font-mono text-[10px] font-bold text-cyan-400">
                        {Math.round(totalProgress)}%
                      </p>
                    </div>
                    <button 
                      onClick={() => setShowMonitor(!showMonitor)}
                      className="text-faint hover:text-app px-2 py-1 rounded hover:bg-surface-strong transition-colors"
                    >
                      {showMonitor ? "Hide Details" : "Show Details"}
                    </button>
                  </div>
                </div>

                {showMonitor && (
                  <div className="grid grid-cols-[1fr_250px] flex-1 overflow-hidden">
                    {/* Progress Visualizer */}
                    <div className="p-4 overflow-y-auto custom-scrollbar bg-panel">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {segments.map((seg, idx) => (
                          <div 
                            key={seg.id}
                            className={`p-2 rounded-xl border text-[9px] transition-all ${
                              seg.id === currentId 
                                ? 'bg-violet-500/20 border-violet-500/50 scale-[1.02]' 
                                : seg.status === 'completed'
                                ? 'bg-green-500/10 border-green-500/20 opacity-80'
                                : 'bg-surface border-line-soft opacity-40'
                            }`}
                          >
                            <div className="flex justify-between items-center mb-0.5">
                              <span className="font-mono font-bold text-faint">#{idx + 1}</span>
                              {seg.id === currentId ? (
                                <div className="w-1 h-1 rounded-full bg-violet-400 animate-pulse" />
                              ) : seg.status === 'completed' ? (
                                <CheckCircle2 size={10} className="text-green-500" />
                              ) : null}
                            </div>
                            <p className="line-clamp-1 text-app-soft italic opacity-80">{seg.text}</p>
                          </div>
                        ))}
                      </div>

                      {finalAudioUrl && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-6 p-4 glass-card bg-violet-500/5 border-violet-500/20"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 shrink-0">
                                <CheckCircle2 size={24} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[9px] font-bold text-app mb-1 uppercase">MASTER FILE READY</p>
                                <audio src={finalAudioUrl} controls className={`w-full h-8 ${theme === 'dark' ? 'filter invert hue-rotate-180 brightness-200' : ''}`} />
                              </div>
                            </div>
                            <button 
                              onClick={handleDownload}
                              className="h-10 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 font-bold text-[10px] flex items-center gap-2 shadow-lg shadow-violet-900/40 shrink-0"
                            >
                              <Download size={14} />
                              COMPLETE MP3
                            </button>
                          </div>
                        </motion.div>
                      )}

                      {error && (
                        <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3">
                          <AlertCircle size={16} />
                          <p className="text-[10px] font-medium">{error}</p>
                        </div>
                      )}
                    </div>

                    {/* Simple Real-time Logs */}
                    <div className="border-l border-line-soft bg-panel flex flex-col">
                      <div className="p-2 border-b border-line-soft bg-panel flex items-center gap-2 text-[9px] font-bold text-faint uppercase">
                        <Database size={10} />
                        Sync Logs
                      </div>
                      <div className="flex-1 overflow-y-auto p-3 font-mono text-[9px] space-y-1.5 flex flex-col-reverse custom-scrollbar">
                        {logs.map((log, i) => (
                          <div key={i} className="text-faint border-l border-line-soft pl-2 py-0.5">
                            {log}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--t-scroll);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: var(--t-scroll-strong);
        }
        audio::-webkit-media-controls-panel {
          background-color: transparent !important;
        }
      `}</style>
    </div>
  );
}
