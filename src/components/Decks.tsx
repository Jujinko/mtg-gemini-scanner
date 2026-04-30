import React, { useState } from 'react';
import { useCollectionStore } from '../store/collectionStore';
import { Trash2, Plus, LibraryBig, LayoutGrid, ChevronLeft, Share } from 'lucide-react';
import { useToast } from './ui/ToastProvider';
import ExportDialog from './ExportDialog';

export default function Decks() {
  const { decks, createDeck, deleteDeck, removeFromDeck } = useCollectionStore();
  const { showToast } = useToast();
  const [newDeckName, setNewDeckName] = useState('');
  const [viewingDeck, setViewingDeck] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const handleCreateDeck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeckName.trim()) return;
    createDeck(newDeckName.trim());
    showToast(`Created deck: ${newDeckName}`, 'success');
    setNewDeckName('');
  };

  const selectedDeck = decks.find(d => d.id === viewingDeck);

  if (selectedDeck) {
    return (
      <div className="w-full h-full flex flex-col bg-zinc-950 text-zinc-100">
        <div className="bg-zinc-950 px-4 py-4 sm:py-6 border-b border-zinc-800 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
                onClick={() => setViewingDeck(null)}
                className="p-2 -ml-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-full transition"
            >
                <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white truncate max-w-[150px] sm:max-w-xs">
                {selectedDeck.name}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-zinc-400 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full leading-none">{selectedDeck.cards.length} cards</span>
            <button 
                onClick={() => setExportOpen(true)}
                className="p-1.5 sm:p-2 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-full transition"
                title="Export Deck"
            >
                <Share className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 pb-24">
            {selectedDeck.cards.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500">
                    <LayoutGrid className="w-12 h-12 text-zinc-700 mb-4" />
                    <p>This deck is empty.</p>
                    <p className="text-sm">Scan a card to add one.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {selectedDeck.cards.map((item) => (
                        <div key={item.instanceId} className="flex items-center gap-3 bg-zinc-900 p-3 rounded-xl border border-zinc-800 shadow-sm transition hover:border-zinc-700">
                            {item.card.imageUrl ? (
                                <img src={item.card.imageUrl} alt={item.card.name} className="w-12 h-16 object-cover rounded-md flex-shrink-0 opacity-90 hover:opacity-100 transition" />
                            ) : (
                                <div className="w-12 h-16 bg-zinc-800 border border-zinc-700 rounded-md flex items-center justify-center flex-shrink-0">
                                    <LayoutGrid className="w-4 h-4 text-zinc-600" />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-zinc-200 truncate">{item.card.name}</h3>
                                <p className="text-xs text-zinc-500 truncate">{item.card.setName}</p>
                            </div>
                            <div className="font-mono text-xs font-bold text-emerald-400 px-2 drop-shadow-sm">
                                {item.card.priceUsd ? `$${item.card.priceUsd}` : ''}
                            </div>
                            <button
                                onClick={() => {
                                    removeFromDeck(selectedDeck.id, item.instanceId);
                                    showToast(`Removed from deck`, 'info');
                                }}
                                className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition shrink-0"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {exportOpen && (
          <ExportDialog 
             title={selectedDeck.name} 
             cards={selectedDeck.cards} 
             onClose={() => setExportOpen(false)} 
          />
        )}
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden">
      <div className="bg-zinc-950 px-4 py-4 sm:py-6 border-b border-zinc-800 shrink-0">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 mb-4">
           <LibraryBig className="w-6 h-6 text-emerald-500" /> My Decks
        </h1>
        <form onSubmit={handleCreateDeck} className="relative flex gap-2">
          <input 
            type="text" 
            placeholder="New deck name..." 
            className="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all outline-none"
            value={newDeckName}
            onChange={(e) => setNewDeckName(e.target.value)}
          />
          <button 
             type="submit"
             disabled={!newDeckName.trim()}
             className="px-4 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 rounded-xl font-bold flex items-center transition"
          >
             <Plus className="w-5 h-5" />
          </button>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24">
        {decks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="w-20 h-20 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center mb-4">
               <LibraryBig className="w-8 h-8 text-zinc-500" />
            </div>
            <h3 className="text-lg font-semibold tracking-tight text-zinc-300 mb-1">No decks yet</h3>
            <p className="text-zinc-500 text-sm">Create a deck to start organizing your cards.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {decks.map(deck => (
              <div 
                  key={deck.id} 
                  className="bg-zinc-900 border px-4 py-5 font-left border-zinc-800 rounded-xl shadow-sm hover:border-zinc-700 transition cursor-pointer flex flex-col group relative"
                  onClick={() => setViewingDeck(deck.id)}
              >
                  <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-bold text-white truncate pr-8">{deck.name}</h3>
                      <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('Delete this deck?')) {
                                deleteDeck(deck.id);
                                showToast('Deck deleted', 'info');
                            }
                        }}
                        className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition"
                      >
                          <Trash2 className="w-4 h-4" />
                      </button>
                  </div>
                  <div className="flex items-center text-xs font-bold uppercase tracking-widest text-zinc-500 gap-2 mb-4">
                      <LayoutGrid className="w-4 h-4" />
                      <span>{deck.cards.length} Cards</span>
                  </div>
                  
                  {/* Miniature standard card display */}
                  <div className="flex gap-1 h-32 w-full mt-auto bg-zinc-950/50 p-2 border border-zinc-800/50 rounded-lg overflow-hidden">
                      {deck.cards.slice(0, 5).map((item, i) => (
                          <div 
                             key={item.instanceId} 
                             className="w-16 h-full shrink-0 rounded overflow-hidden shadow-[0_0_10px_rgba(0,0,0,0.5)] -ml-6 first:ml-0"
                             style={{ zIndex: 10 - i }}
                          >
                              {item.card.imageUrl ? (
                                  <img src={item.card.imageUrl} className="w-full h-full object-cover object-top opacity-90" />
                              ) : (
                                  <div className="w-full h-full bg-zinc-800 border border-zinc-700" />
                              )}
                          </div>
                      ))}
                      {deck.cards.length === 0 && <div className="w-full h-full flex items-center justify-center italic text-xs text-center text-zinc-600">Empty</div>}
                  </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
