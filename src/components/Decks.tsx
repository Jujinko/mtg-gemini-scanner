import React, { useState, useRef, useEffect } from 'react';
import { useCollectionStore } from '../store/collectionStore';
import { Trash2, Plus, LibraryBig, LayoutGrid, ChevronLeft, Share, Search } from 'lucide-react';
import { useToast } from './ui/ToastProvider';
import ExportDialog from './ExportDialog';
import LazyCardImage from './LazyCardImage';
import { Drawer } from 'vaul';

export default function Decks() {
  const { decks, createDeck, deleteDeck, removeFromDeck, restoreToDeck } = useCollectionStore();
  const { showToast } = useToast();
  const [newDeckName, setNewDeckName] = useState('');
  const [viewingDeck, setViewingDeck] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [deckToDelete, setDeckToDelete] = useState<string | null>(null);
  
  const [addFromCollectionOpen, setAddFromCollectionOpen] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const { collection, addToDeck } = useCollectionStore();

  const formRef = useRef<HTMLFormElement>(null);

  const handleCreateDeck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeckName.trim()) return;
    createDeck(newDeckName.trim());
    showToast(`Created deck: ${newDeckName}`, 'success');
    setNewDeckName('');
  };

  const handleInputFocus = () => {
    // Scroll element into view with a slight delay to let iOS keyboard present
    setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
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
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white line-clamp-2 max-w-[200px] sm:max-w-xs">
                {selectedDeck.name}
            </h1>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <span className="hidden sm:inline-block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-zinc-400 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full leading-none">{selectedDeck.cards.length} cards</span>
            <button 
                onClick={() => setAddFromCollectionOpen(true)}
                className="p-1.5 sm:p-2 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-full transition"
                title="Add from Collection"
            >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button 
                onClick={() => setExportOpen(true)}
                className="p-1.5 sm:p-2 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-full transition"
                title="Export Deck"
            >
                <Share className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 pb-24">
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
                                <LazyCardImage src={item.card.imageUrl} alt={item.card.name} className="w-12 h-16 object-cover rounded-md flex-shrink-0 opacity-90 hover:opacity-100 transition" containerClassName="w-12 h-16 shrink-0" />
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
                                    showToast(`Removed from deck`, 'info', {
                                        label: 'Undo',
                                        onClick: () => {
                                            restoreToDeck(selectedDeck.id, item);
                                        }
                                    });
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
        <form ref={formRef} onSubmit={handleCreateDeck} className="relative flex gap-2">
          <input 
            type="text" 
            enterKeyHint="done"
            placeholder="New deck name..." 
            className="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-base text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all outline-none"
            value={newDeckName}
            onChange={(e) => setNewDeckName(e.target.value)}
            onFocus={handleInputFocus}
          />
          <button 
             type="submit"
             aria-label="Create deck"
             disabled={!newDeckName.trim()}
             className="px-4 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 rounded-xl font-bold flex items-center transition"
          >
             <Plus className="w-5 h-5" />
          </button>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 pb-24">
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
                            setDeckToDelete(deck.id);
                        }}
                        className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition"
                      >
                          <Trash2 className="w-4 h-4" />
                      </button>
                  </div>
                  <div className="flex items-center text-xs font-bold uppercase tracking-widest text-zinc-500 gap-2 mb-4">
                      <LayoutGrid className="w-4 h-4" />
                      <span>{deck.cards.length} Cards</span>
                  </div>
                  
                  {/* Miniature standard card display */}
                  <div className="flex justify-center items-center h-32 w-full mt-auto bg-zinc-950/50 p-2 border border-zinc-800/50 rounded-lg overflow-hidden pl-4">
                      {deck.cards.slice(0, 5).map((item, i) => (
                          <div 
                             key={item.instanceId} 
                             className="w-16 h-full shrink-0 rounded overflow-hidden shadow-[0_0_10px_rgba(0,0,0,0.5)] -ml-4 first:ml-0 transition group-hover:-translate-y-1"
                             style={{ zIndex: 10 - i, transform: i > 0 ? `rotate(${i * 2}deg) translateY(${i * 2}px)` : '' }}
                          >
                              {item.card.imageUrl ? (
                                  <LazyCardImage src={item.card.imageUrl} className="w-full h-full object-cover object-top opacity-90" containerClassName="w-full h-full" />
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

      <Drawer.Root open={addFromCollectionOpen} onClose={() => setAddFromCollectionOpen(false)}>
        <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70]" />
            <Drawer.Content className="bg-zinc-900 border-t border-zinc-800 flex flex-col rounded-t-3xl h-[85vh] sm:h-[80vh] fixed bottom-0 left-0 right-0 z-[80] shadow-2xl">
              <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-zinc-700 my-4" />
              
              <div className="px-6 flex justify-between items-start shrink-0 mb-4 border-b border-zinc-800 pb-4">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight mb-1 pr-4">Add from Collection</h2>
                    <p className="text-zinc-400 text-xs sm:text-sm">Select cards to add to the deck</p>
                  </div>
              </div>
              
              <div className="px-6 mb-4">
                  <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                      <input 
                          type="search" 
                          placeholder="Search your collection..." 
                          className="w-full pl-10 pr-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-base text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all outline-none"
                          value={addSearch}
                          onChange={(e) => setAddSearch(e.target.value)}
                      />
                  </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 pb-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {collection
                    .filter(c => !addSearch.trim() || c.card.name.toLowerCase().includes(addSearch.toLowerCase()))
                    .map(item => (
                      <button
                        key={item.instanceId}
                        onClick={() => {
                          if (viewingDeck) {
                            addToDeck(viewingDeck, item.card);
                            showToast(`Added ${item.card.name} to deck`, 'success');
                          }
                        }}
                        className="bg-zinc-800 border text-left border-zinc-700 rounded-xl overflow-hidden shadow-sm group hover:border-emerald-500 transition relative"
                      >
                         <div className="aspect-[2.5/3.5] bg-zinc-950 border-b border-zinc-800 relative transition">
                            {item.card.imageUrl ? (
                              <LazyCardImage src={item.card.imageUrl} alt={item.card.name} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 duration-300" containerClassName="w-full h-full" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-600 px-4 text-center text-xs font-medium uppercase tracking-wider">No Image</div>
                            )}
                         </div>
                         <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex flex-col items-center justify-center transition opacity-0 group-hover:opacity-100">
                             <div className="bg-emerald-500 text-zinc-950 rounded-full p-2 shadow-lg drop-shadow-md">
                                 <Plus className="w-6 h-6" />
                             </div>
                         </div>
                      </button>
                  ))}
                </div>
              </div>
            </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      {deckToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-sm overflow-hidden text-left flex flex-col shadow-2xl">
            <div className="p-6">
              <h2 className="text-xl font-bold text-white mb-2">Delete Deck</h2>
              <p className="text-zinc-400 text-sm">
                This will delete the deck completely. The cards will remain in your collection. Are you sure you want to proceed?
              </p>
            </div>
            <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex flex-row gap-3">
              <button 
                 onClick={() => setDeckToDelete(null)}
                 className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-2xl transition"
              >
                Cancel
              </button>
              <button 
                 onClick={() => {
                   deleteDeck(deckToDelete);
                   setDeckToDelete(null);
                   showToast('Deck deleted', 'info');
                 }}
                 className="flex-1 py-3 bg-red-500/90 hover:bg-red-500 text-white font-bold rounded-2xl transition"
              >
                Delete Deck
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
