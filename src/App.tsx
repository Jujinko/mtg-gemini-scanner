import { useState } from 'react';
import { Camera, Layers, LibraryBig } from 'lucide-react';
import Scanner from './components/Scanner';
import Collection from './components/Collection';
import Decks from './components/Decks';
import { ToastProvider } from './components/ui/ToastProvider';

type Tab = 'scanner' | 'collection' | 'decks';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('scanner');

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
