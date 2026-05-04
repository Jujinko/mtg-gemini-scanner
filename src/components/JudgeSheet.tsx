import React, { useState, useEffect } from 'react';
import { Drawer } from 'vaul';
import { X, Send, Scale, User, Clock, AlertCircle } from 'lucide-react';
import { ScryfallCard } from '../services/scryfall';
import { askJudge, JudgeContext } from '../services/judge';
import { logRuling } from '../services/judgeFeedback';
import JudgeRuling from './JudgeRuling';
import { useJudgeQuotaStore } from '../store/judgeQuotaStore';
import { isJudgeEnabled } from '../lib/judgeFlag';

interface JudgeSheetProps {
  cards: ScryfallCard[]; // Up to 3 cards
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Timer({ startTime, endTime }: { startTime: number, endTime: number | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (endTime) return;
    const interval = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(interval);
  }, [endTime]);

  const elapsed = (endTime || now) - startTime;
  return <span>{(elapsed / 1000).toFixed(1)}s</span>;
}

export default function JudgeSheet({ cards, open, onOpenChange }: JudgeSheetProps) {
  const [question, setQuestion] = useState('');
  const [activePlayer, setActivePlayer] = useState<'me' | 'opponent'>('me');
  const [phase, setPhase] = useState<'main' | 'combat' | 'end'>('main');
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [error, setError] = useState<Error | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  
  const [debugMode, setDebugMode] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{
    startTime: number | null;
    rawPrompt: string | null;
    statusLogs: { timestamp: number; msg: string }[];
    endTime: number | null;
    responseObject: any | null;
    errorObject: any | null;
  }>({
    startTime: null,
    rawPrompt: null,
    statusLogs: [],
    endTime: null,
    responseObject: null,
    errorObject: null
  });
  
  const [traceId, setTraceId] = useState<string | null>(null);
  const [response, setResponse] = useState<any>(null);
  
  const quota = useJudgeQuotaStore();

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setQuestion('');
      setResponse(null);
      setError(null);
      setTraceId(null);
      setLoadingStatus('');
      setDebugInfo({
        startTime: null,
        rawPrompt: null,
        statusLogs: [],
        endTime: null,
        responseObject: null,
        errorObject: null
      });
    }
  }, [open]);

  if (!isJudgeEnabled()) return null;

  const handleCancel = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    setLoading(false);
    setLoadingStatus('Canceled');
  };

  const handleSubmit = async () => {
    if (!question.trim()) return;
    
    if (!quota.tryConsume()) {
      setError(new Error("You've reached your daily limit of 20 queries. Try again tomorrow."));
      return;
    }

    setLoading(true);
    setLoadingStatus('Preparing case...');
    setError(null);
    setDebugInfo(prev => ({ ...prev, startTime: Date.now(), statusLogs: [], errorObject: null, responseObject: null, endTime: null, rawPrompt: null }));

    const controller = new AbortController();
    setAbortController(controller);

    const context: JudgeContext = {
      active_player: activePlayer,
      phase,
      free_text: question
    };

    const handleProgress = (msg: string) => {
      setLoadingStatus(msg);
      setDebugInfo(prev => ({ ...prev, statusLogs: [...prev.statusLogs, { timestamp: Date.now(), msg }] }));
    };

    try {
      const { response: res, meta } = await askJudge(cards, question, context, {
        signal: controller.signal,
        onProgress: handleProgress,
        onRequestSent: (prompt) => {
          setDebugInfo(prev => ({ ...prev, rawPrompt: prompt }));
          handleProgress('Prompt sent to Gemini...');
        }
      });
      
      // Async logging
      const request = {
        card_ids: cards.map(c => c.id),
        question,
        context,
        prompt_version: "alpha-v2",
        model: "gemini-2.5-pro"
      };
      
      const tid = logRuling(request, res, meta);
      setTraceId(tid);
      setResponse(res);
      setDebugInfo(prev => ({ ...prev, responseObject: res, endTime: Date.now() }));
      
    } catch (err: any) {
      if (err.name === 'AbortError') {
        handleProgress('Request canceled.');
        setDebugInfo(prev => ({ ...prev, endTime: Date.now(), errorObject: 'Canceled' }));
      } else {
        const errMsg = err instanceof Error ? err.message : String(err);
        const errStack = err instanceof Error ? err.stack : undefined;
        console.error('[JudgeSheet] Error asking judge:', err, errStack);
        
        // Handle invalid API Key natively
        if (errMsg.toLowerCase().includes('api key') && window.aistudio) {
          setError(new Error("Your API Key was invalid. Please select a valid key."));
          setTimeout(() => {
            window.aistudio?.openSelectKey();
          }, 1000);
        } else {
          setError(err instanceof Error ? err : new Error(err?.message || "Failed to get a ruling. Please try again."));
        }
        
        setDebugInfo(prev => ({ ...prev, endTime: Date.now(), errorObject: { message: errMsg, stack: errStack } }));
      }
    } finally {
      if (controller.signal.aborted) {
        // Keep loading false, do nothing
      } else {
        setLoading(false);
        setAbortController(null);
      }
    }
  };

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Drawer.Content className="bg-zinc-950 border-t border-zinc-800 flex flex-col rounded-t-[20px] fixed bottom-0 left-0 right-0 max-h-[90vh] z-50 text-zinc-100 font-sans shadow-2xl">
          
          <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-zinc-800 mt-3 mb-2" />
          
          <div className="flex items-center justify-between px-5 py-2 border-b border-zinc-800/50">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Scale className="w-5 h-5 text-emerald-400" />
              Ask AI Judge
              <span className="bg-emerald-400/20 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Alpha</span>
            </h3>
            <button onClick={() => onOpenChange(false)} className="p-2 -mr-2 text-zinc-400 hover:text-zinc-100 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 overflow-y-auto pb-8 flex-1">
            
            {/* Cards Header */}
            {!response && !loading && (
               <div className="flex flex-wrap gap-2 mb-6">
                 {cards.map(card => (
                   <div key={card.id} className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full text-xs font-medium text-zinc-300">
                     {card.name}
                   </div>
                 ))}
                 {cards.length === 0 && (
                   <div className="text-zinc-500 text-sm">No cards selected</div>
                 )}
               </div>
            )}

            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-4">
                <div className="w-8 h-8 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                <p className="text-zinc-400 text-sm animate-pulse">{loadingStatus || 'Consulting the comprehensive rules...'}</p>
                <div className="max-w-xs text-center text-xs text-zinc-600 italic">"{question}"</div>
                <button 
                  onClick={handleCancel}
                  className="mt-6 text-xs text-zinc-500 hover:text-zinc-300 underline decoration-zinc-500/50 underline-offset-4 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : response && traceId ? (
              <JudgeRuling response={response} traceId={traceId} />
            ) : (
              <div className="flex flex-col gap-5">
                {/* Error Banner */}
                {error && (
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-200 p-3 rounded flex flex-col gap-2 text-sm">
                    <div className="flex gap-2 items-start" style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong>{error.message}</strong>
                        {error.stack && (
                          <div className="mt-2 text-xs bg-rose-950/50 p-2 rounded relative group font-mono overflow-auto max-h-40">
                            <button
                              onClick={() => navigator.clipboard.writeText(error.stack || '')}
                              className="absolute top-1 right-1 bg-rose-500/20 text-rose-200 px-2 py-1 rounded text-[10px] opacity-0 group-hover:opacity-100 transition"
                            >
                              Copy
                            </button>
                            <pre>{error.stack}</pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Input Area */}
                <div className="flex flex-col gap-2 relative">
                  <textarea
                    autoFocus
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder={cards.length > 0 ? "What happens when..." : "Scan cards first to ask a question."}
                    disabled={cards.length === 0}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all resize-none h-24"
                  />
                </div>

                {/* Context Chips (Only if cards > 0) */}
                {cards.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-2 items-center">
                      <User className="w-4 h-4 text-zinc-500" />
                      <div className="flex bg-zinc-900 p-1 rounded-md border border-zinc-800 text-xs">
                        <button 
                          onClick={() => setActivePlayer('me')}
                          className={`px-3 py-1 rounded transition-colors ${activePlayer === 'me' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                          My Turn
                        </button>
                        <button 
                          onClick={() => setActivePlayer('opponent')}
                          className={`px-3 py-1 rounded transition-colors ${activePlayer === 'opponent' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                          Opponent's
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Clock className="w-4 h-4 text-zinc-500" />
                      <div className="flex bg-zinc-900 p-1 rounded-md border border-zinc-800 text-xs">
                        <button 
                          onClick={() => setPhase('main')}
                          className={`px-3 py-1 rounded transition-colors ${phase === 'main' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                          Main
                        </button>
                        <button 
                          onClick={() => setPhase('combat')}
                          className={`px-3 py-1 rounded transition-colors ${phase === 'combat' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                          Combat
                        </button>
                        <button 
                          onClick={() => setPhase('end')}
                          className={`px-3 py-1 rounded transition-colors ${phase === 'end' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                          End
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={!question.trim() || cards.length === 0}
                  className="w-full bg-emerald-500 text-zinc-950 font-bold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
                >
                  <Send className="w-4 h-4" />
                  Ask Judge
                </button>
                <div className="text-center text-[10px] text-zinc-600">
                  {quota.remaining()} queries remaining today
                </div>
              </div>
            )}
            
            {/* Debug UI */}
            <div className="mt-8 border-t border-zinc-800/50 pt-4">
              <button 
                onClick={() => setDebugMode(!debugMode)}
                className="text-xs text-zinc-500 hover:text-zinc-300 underline decoration-zinc-500/50 underline-offset-4 transition-colors mb-4"
              >
                {debugMode ? 'Hide Debug Info' : 'Show Debug Info'}
              </button>
              
              {debugMode && (
                <div className="flex flex-col gap-4 text-xs font-mono bg-zinc-950 p-4 rounded-lg border border-zinc-900 overflow-x-auto">
                  {debugInfo.startTime && (
                    <div className="text-emerald-400">
                      Elapsed Time: <Timer startTime={debugInfo.startTime} endTime={debugInfo.endTime} />
                    </div>
                  )}
                  {debugInfo.statusLogs.map((log, i) => (
                    <div key={i} className="text-zinc-400 border-l-2 border-zinc-800 pl-2">
                       <span className="text-zinc-600">+{((log.timestamp - (debugInfo.startTime || log.timestamp)) / 1000).toFixed(1)}s</span>: {log.msg}
                    </div>
                  ))}
                  {debugInfo.errorObject && (
                    <div className="text-rose-400">
                      <div className="font-bold mb-1">Error:</div>
                      <pre className="whitespace-pre-wrap">{JSON.stringify(debugInfo.errorObject, null, 2)}</pre>
                    </div>
                  )}
                  {debugInfo.rawPrompt && (
                    <div className="text-zinc-300">
                      <div className="font-bold mb-1 text-zinc-500">Raw Prompt Sent:</div>
                      <pre className="whitespace-pre-wrap text-[10px] bg-zinc-900 p-2 rounded">{debugInfo.rawPrompt}</pre>
                    </div>
                  )}
                  {debugInfo.responseObject && (
                    <div className="text-zinc-300">
                      <div className="font-bold mb-1 text-zinc-500">Raw Response:</div>
                      <pre className="whitespace-pre-wrap text-[10px] bg-zinc-900 p-2 rounded">{JSON.stringify(debugInfo.responseObject, null, 2)}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
