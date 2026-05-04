import { useState, useEffect } from 'react';
import { Camera, Layers, LibraryBig, KeyRound } from 'lucide-react';
import Scanner from './components/Scanner';
import Collection from './components/Collection';
import Decks from './components/Decks';
import { ToastProvider } from './components/ui/ToastProvider';

// Type declaration for the AI Studio API key methods
declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

type Tab = 'scanner' | 'collection' | 'decks';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('scanner');
  const [hasKey, setHasKey] = useState<boolean>(true); // assume true first so we don't flash, then check
  const [debugKey, setDebugKey] = useState<string>('');

  useEffect(() => {
    async function checkKey() {
      if (window.aistudio) {
        const has = await window.aistudio.hasSelectedApiKey();
        setHasKey(has);
      }
      try {
        // @ts-ignore
        setDebugKey(`env.API_KEY=${!!process.env.API_KEY} env.GEMINI_API_KEY=${!!process.env.GEMINI_API_KEY}`);
      } catch (e: any) {
        setDebugKey(e.message);
      }
    }
    checkKey();
  }, []);

  const handleProvideKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      // Assume success due to race condition with hasSelectedApiKey
      setHasKey(true);
    }
  };

  const handleTabChange = (tab: Tab) => {
    if (activeTab === tab) return;
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        setActiveTab(tab);
      });
    } else {
      setActiveTab(tab);
    }
  };

  if (!hasKey) {
    return (
      <div className="w-full h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center font-sans p-6">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
            <KeyRound className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-100 mb-3">API Key Required</h2>
          <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
            This application uses Gemini 3.1 Pro and Flash models for card scanning and rules judging.
            You must provide your own Google Cloud API key to continue.
          </p>
          <button
            onClick={handleProvideKey}
            className="w-full bg-zinc-100 hover:bg-white text-zinc-900 font-bold py-3.5 px-6 rounded-2xl transition-colors"
          >
            Select API Key
          </button>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="w-full h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-emerald-500/30">
        
        {/* TOP BAR / NOTCH AREA (Safe Area) */}
        <div className="h-safe-top bg-zinc-950 w-full z-50"></div>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 w-full relative overflow-hidden bg-zinc-950">
          <div className={`absolute inset-0 ${activeTab === 'scanner' ? 'z-10' : 'hidden'}`}>
            <Scanner />
          </div>
          <div className={`absolute inset-0 ${activeTab === 'collection' ? 'z-10' : 'hidden'}`}>
            <Collection />
          </div>
          <div className={`absolute inset-0 ${activeTab === 'decks' ? 'z-10' : 'hidden'}`}>
            <Decks />
          </div>
        </main>

        {/* BOTTOM NAVIGATION */}
        <div 
          className="absolute left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm"
          style={{ bottom: 'calc(24px + env(safe-area-inset-bottom))' }}
        >
          <nav className="bg-zinc-900/90 backdrop-blur-xl border border-zinc-800/80 rounded-full flex items-center justify-between px-2 py-2 shadow-[0_0_30px_rgba(0,0,0,0.8)]">
            <button
              onClick={() => handleTabChange('collection')}
              className={`flex-1 flex flex-col items-center justify-center py-2 transition-colors ${
                activeTab === 'collection' ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Layers className={`w-5 h-5 mb-1 ${activeTab === 'collection' ? 'drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]' : ''}`} />
              <span className="text-[11px] uppercase font-bold">Collection</span>
            </button>

            <button
              onClick={() => handleTabChange('scanner')}
              className={`flex-1 flex flex-col items-center justify-center py-2 transition-colors ${
                activeTab === 'scanner' ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Camera className={`w-5 h-5 mb-1 ${activeTab === 'scanner' ? 'drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]' : ''}`} />
              <span className="text-[11px] uppercase font-bold">Scan</span>
            </button>

            <button
              onClick={() => handleTabChange('decks')}
              className={`flex-1 flex flex-col items-center justify-center py-2 transition-colors ${
                activeTab === 'decks' ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <LibraryBig className={`w-5 h-5 mb-1 ${activeTab === 'decks' ? 'drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]' : ''}`} />
              <span className="text-[11px] uppercase font-bold">Decks</span>
            </button>
          </nav>
        </div>
      </div>
    </ToastProvider>
  );
}
