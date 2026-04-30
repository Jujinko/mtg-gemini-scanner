import React, { useState } from 'react';
import { useCollectionStore } from '../store/collectionStore';
import { Trash2, Search, PlusCircle, Folders, ChevronRight, Share } from 'lucide-react';
import { useToast } from './ui/ToastProvider';
import ExportDialog from './ExportDialog';

export default function Collection() {
  const { collection, removeFromCollection } = useCollectionStore();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [exportOpen, setExportOpen] = useState(false);

  const sortedCollection = [...collection].sort((a, b) => b.dateAdded - a.dateAdded);
  const filtered = sortedCollection.filter(c => 
    c.card.name.toLowerCase().includes(search.toLowerCase()) ||
    c.card.setName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-full h-full flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden">
      <div className="bg-zinc-950 px-4 py-4 sm:py-6 border-b border-zinc-800 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Folders className="w-6 h-6 text-emerald-500" /> My Collection
          </h1>
          <button 
            onClick={() => setExportOpen(true)}
            className="p-2 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition"
            title="Export Collection"
          >
            <Share className="w-5 h-5" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Search verified cards..." 
            className="w-full pl-10 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24">
        {filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="w-20 h-20 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center mb-4">
               <Search className="w-8 h-8 text-zinc-500" />
            </div>
            <h3 className="text-lg font-semibold tracking-tight text-zinc-300 mb-1">No cards found</h3>
            <p className="text-zinc-500 text-sm">Scan some cards to build your collection.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filtered.map(item => (
              <div key={item.instanceId} className="bg-zinc-900 border text-left border-zinc-800 rounded-xl overflow-hidden shadow-sm group hover:border-zinc-700 transition">
                <div className="aspect-[2.5/3.5] bg-zinc-950 border-b border-zinc-800 relative group-hover:block transition">
                  {item.card.imageUrl ? (
                    <img 
                      src={item.card.imageUrl} 
                      alt={item.card.name} 
                      className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition duration-500"
                      loading="lazy"
                    />
                  ) : (
                     <div className="w-full h-full flex items-center justify-center text-zinc-600 px-4 text-center text-sm font-medium uppercase tracking-wider">No Image</div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/90 to-transparent">
                      <span className="text-emerald-400 text-xs font-mono font-bold drop-shadow-md">{item.card.priceUsd ? `$${item.card.priceUsd}` : ''}</span>
                  </div>
                  <button 
                    onClick={() => {
                        removeFromCollection(item.instanceId);
                        showToast(`Removed ${item.card.name}`, 'info');
                    }}
                    className="absolute top-2 right-2 p-2 bg-red-500/80 text-white rounded-lg opacity-0 group-hover:opacity-100 transition shadow-lg hover:bg-red-500 backdrop-blur-sm border border-red-500/20"
                    aria-label="Remove Card"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-3">
                  <h4 className="text-sm font-bold truncate text-zinc-200" title={item.card.name}>{item.card.name}</h4>
                  <p className="text-xs text-zinc-500 truncate mt-0.5" title={item.card.setName}>{item.card.setName}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {exportOpen && (
        <ExportDialog 
           title="Collection" 
           cards={collection} 
           onClose={() => setExportOpen(false)} 
        />
      )}
    </div>
  );
}
