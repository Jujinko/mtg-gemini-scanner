import { useState } from 'react';
import { Camera, Layers, LibraryBig } from 'lucide-react';
import Scanner from './components/Scanner';
import Collection from './components/Collection';
import Decks from './components/Decks';
import { ToastProvider } from './components/ui/ToastProvider';

type Tab = 'scanner' | 'collection' | 'decks';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('scanner');

  return (
    <ToastProvider>
      <div className="w-full h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-emerald-500/30">
        
        {/* TOP BAR / NOTCH AREA (Safe Area) */}
        <div className="h-safe-top bg-zinc-950 w-full z-50"></div>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 w-full relative overflow-hidden bg-zinc-950">
          {activeTab === 'scanner' && <Scanner />}
          {activeTab === 'collection' && <Collection />}
          {activeTab === 'decks' && <Decks />}
        </main>

        {/* BOTTOM NAVIGATION */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 pb-safe w-[90%] max-w-sm">
          <nav className="bg-zinc-900/90 backdrop-blur-xl border border-zinc-800/80 rounded-full flex items-center justify-between px-2 py-2 shadow-[0_0_30px_rgba(0,0,0,0.8)]">
            <button
              onClick={() => setActiveTab('collection')}
              className={`flex-1 flex flex-col items-center justify-center py-2 transition-colors ${
                activeTab === 'collection' ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Layers className={`w-5 h-5 mb-1 ${activeTab === 'collection' ? 'drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]' : ''}`} />
              <span className="text-[9px] uppercase font-bold tracking-tighter">Collection</span>
            </button>

            <button
              onClick={() => setActiveTab('scanner')}
              className={`flex-1 flex flex-col items-center justify-center py-2 transition-colors ${
                activeTab === 'scanner' ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Camera className={`w-5 h-5 mb-1 ${activeTab === 'scanner' ? 'drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]' : ''}`} />
              <span className="text-[9px] uppercase font-bold tracking-tighter">Scan</span>
            </button>

            <button
              onClick={() => setActiveTab('decks')}
              className={`flex-1 flex flex-col items-center justify-center py-2 transition-colors ${
                activeTab === 'decks' ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <LibraryBig className={`w-5 h-5 mb-1 ${activeTab === 'decks' ? 'drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]' : ''}`} />
              <span className="text-[9px] uppercase font-bold tracking-tighter">Decks</span>
            </button>
          </nav>
        </div>
      </div>
    </ToastProvider>
  );
}
