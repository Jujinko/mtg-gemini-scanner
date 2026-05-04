import React, { useState } from 'react';
import { useCollectionStore } from '../store/collectionStore';
import { Trash2, Search, PlusCircle, Folders, ChevronRight, Share, LayoutGrid, List, AlignJustify, ExternalLink, X, Loader2, Scale } from 'lucide-react';
import { useToast } from './ui/ToastProvider';
import ExportDialog from './ExportDialog';
import { Drawer } from 'vaul';
import LazyCardImage from './LazyCardImage';
import { ScryfallCard } from '../services/scryfall';
import JudgeSheet from './JudgeSheet';

type ViewMode = 'grid' | 'list' | 'checklist';

export default function Collection() {
  const { collection, removeFromCollection, restoreCard } = useCollectionStore();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [scryfallDetails, setScryfallDetails] = useState<ScryfallCard | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isJudgeSheetOpen, setIsJudgeSheetOpen] = useState(false);

  // When card is tapped, fetch details from scryfall
  const handleCardTap = async (item: any) => {
    setSelectedCard(item);
    setScryfallDetails(null);
    setLoadingDetails(true);
    try {
      const res = await fetch(`https://api.scryfall.com/cards/${item.card.id}`);
      if (res.ok) {
        const data = await res.json();
        setScryfallDetails(data);
      } else {
        const err = new Error(`Scryfall generic error ${res.status}`);
        showToast('Failed to load card details', 'error', undefined, err);
      }
    } catch (err: unknown) {
      showToast('Failed to load card details', 'error', undefined, err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoadingDetails(false);
    }
  };

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
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input 
              type="search" 
              enterKeyHint="search"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="Search verified cards..." 
              className="w-full pl-10 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-base text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1 shrink-0">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-zinc-800 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}
              aria-label="Grid View"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-zinc-800 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}
              aria-label="List View"
            >
              <List className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setViewMode('checklist')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'checklist' ? 'bg-zinc-800 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}
              aria-label="Checklist View"
            >
              <AlignJustify className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 pb-24">
        {filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="w-20 h-20 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center mb-4">
               <Search className="w-8 h-8 text-zinc-500" />
            </div>
            <h3 className="text-lg font-semibold tracking-tight text-zinc-300 mb-1">No cards found</h3>
            <p className="text-zinc-500 text-sm">Scan some cards to build your collection.</p>
          </div>
        ) : (
          <div className={
            viewMode === 'grid' 
              ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
              : "flex flex-col gap-2"
          }>
            {filtered.map(item => (
              <div 
                key={item.instanceId} 
                onClick={() => handleCardTap(item)}
                className={`bg-zinc-900 border text-left border-zinc-800 rounded-xl overflow-hidden shadow-sm group hover:border-zinc-700 transition cursor-pointer flex ${viewMode === 'grid' ? 'flex-col' : viewMode === 'list' ? 'flex-row' : 'flex-row items-center p-3 gap-3'}`}
              >
                {viewMode !== 'checklist' && (
                  <div className={`${viewMode === 'grid' ? 'aspect-[2.5/3.5] border-b' : 'w-16 h-20 border-r shrink-0'} bg-zinc-950 border-zinc-800 relative transition`}>
                    {item.card.imageUrl ? (
                      <LazyCardImage 
                        src={item.card.imageUrl} 
                        alt={item.card.name} 
                        className={`w-full h-full object-cover opacity-90 group-hover:opacity-100 ${viewMode === 'grid' ? 'group-hover:scale-105 duration-500' : 'duration-300'}`}
                        containerClassName="w-full h-full"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-600 px-4 text-center text-[10px] font-medium uppercase tracking-wider">No Image</div>
                    )}
                    {viewMode === 'grid' && (
                      <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/90 to-transparent">
                          <span className="text-emerald-400 text-xs font-mono font-bold drop-shadow-md">{item.card.priceUsd ? `$${item.card.priceUsd}` : ''}</span>
                      </div>
                    )}
                  </div>
                )}
                
                <div className={`${viewMode === 'grid' ? 'p-3' : viewMode === 'list' ? 'p-3 flex-1 flex flex-col justify-center' : 'flex-1'}`}>
                  <h4 className="text-sm font-bold truncate text-zinc-200" title={item.card.name}>{item.card.name}</h4>
                  <p className="text-xs text-zinc-500 truncate mt-0.5" title={item.card.setName}>{item.card.setName}</p>
                </div>

                {viewMode !== 'grid' && (
                  <div className="px-3 text-right">
                    <span className="text-emerald-400 text-sm font-mono font-bold">{item.card.priceUsd ? `$${item.card.priceUsd}` : ''}</span>
                  </div>
                )}

                <button 
                  onClick={(e) => {
                      e.stopPropagation();
                      removeFromCollection(item.instanceId);
                      showToast(`Removed ${item.card.name}`, 'info', {
                        label: 'Undo',
                        onClick: () => {
                          restoreCard(item);
                        }
                      });
                  }}
                  className={`${viewMode === 'grid' ? 'absolute top-2 right-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 backdrop-blur-sm border-red-500/20 shadow-lg' : 'static mr-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 border-red-500/50'} p-2 bg-red-500/80 text-white rounded-lg transition hover:bg-red-500 border`}
                  aria-label="Remove Card"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
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

      {/* Card Details Bottom Sheet */}
      <Drawer.Root open={!!selectedCard} onClose={() => setSelectedCard(null)} dismissible={true}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70]" />
          <Drawer.Content className="bg-zinc-900 border-t border-zinc-800 flex flex-col rounded-t-3xl h-[85vh] sm:h-[80vh] fixed bottom-0 left-0 right-0 z-[80] shadow-2xl">
            <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-zinc-700 my-4" />
            
            {selectedCard && (
              <>
                <div className="px-6 flex justify-between items-start shrink-0 mb-4">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight mb-1 pr-4">{selectedCard.card.name}</h2>
                    <p className="text-zinc-400 text-xs sm:text-sm">{selectedCard.card.setName}</p>
                  </div>
                  <button onClick={() => setSelectedCard(null)} className="p-2 -mr-2 text-zinc-500 hover:text-white transition rounded-full">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto px-6 pb-6 pt-2">
                  <div className="flex flex-col sm:flex-row gap-6">
                    <div className="w-full sm:w-[200px] shrink-0 mx-auto sm:mx-0">
                      {selectedCard.card.imageUrl ? (
                        <div className="w-full border border-zinc-700 rounded-xl overflow-hidden shadow-2xl">
                          <LazyCardImage src={selectedCard.card.imageUrl} alt={selectedCard.card.name} className="w-full h-auto block" />
                        </div>
                      ) : (
                        <div className="w-full aspect-[2.5/3.5] bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-500 border border-zinc-700">
                          <span className="text-xs uppercase">No Image</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 space-y-6">
                      {loadingDetails ? (
                        <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>
                      ) : scryfallDetails ? (
                        <>
                          {(scryfallDetails.oracle_text || scryfallDetails.flavor_text) && (
                            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                              {scryfallDetails.oracle_text && (
                                <p className="text-sm text-zinc-300 whitespace-pre-line leading-relaxed">{scryfallDetails.oracle_text}</p>
                              )}
                              {scryfallDetails.flavor_text && (
                                <p className="text-sm text-zinc-500 italic mt-3 pt-3 border-t border-zinc-800 leading-relaxed">{scryfallDetails.flavor_text}</p>
                              )}
                            </div>
                          )}
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-zinc-800/50 p-3 rounded-xl border border-zinc-700/50">
                              <p className="text-[10px] uppercase text-zinc-500 mb-1">Market Price (USD)</p>
                              <p className="text-lg font-bold text-emerald-400">{scryfallDetails.prices?.usd ? `$${scryfallDetails.prices.usd}` : 'N/A'}</p>
                            </div>
                            <div className="bg-zinc-800/50 p-3 rounded-xl border border-zinc-700/50">
                              <p className="text-[10px] uppercase text-zinc-500 mb-1">Foil Price (USD)</p>
                              <p className="text-lg font-bold text-emerald-400">{scryfallDetails.prices?.usd_foil ? `$${scryfallDetails.prices.usd_foil}` : 'N/A'}</p>
                            </div>
                          </div>

                          {scryfallDetails.legalities && (
                            <div className="space-y-2">
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Format Legality</h3>
                                <div className="flex flex-wrap gap-2">
                                  {Object.entries(scryfallDetails.legalities)
                                    .filter(([_, status]) => status === 'legal')
                                    .map(([format]) => (
                                      <span key={format} className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[10px] uppercase font-bold tracking-wider">
                                        {format}
                                      </span>
                                    ))
                                  }
                                </div>
                            </div>
                          )}

                          <div className="pt-4 border-t border-zinc-800 flex flex-wrap gap-4 items-center">
                            <a 
                               href={scryfallDetails.scryfall_uri} 
                               target="_blank" 
                               rel="noopener noreferrer"
                               className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 font-bold transition"
                            >
                                View on Scryfall <ExternalLink className="w-4 h-4" />
                            </a>
                            <button
                               onClick={() => {
                                 // We need to keep the bottom sheet open or somehow pass the card.
                                 // Let's just open JudgeSheet. It might render over this drawer.
                                 setIsJudgeSheetOpen(true);
                               }}
                               className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-bold transition hover:bg-emerald-500/20 text-sm"
                            >
                               <Scale className="w-4 h-4" /> Ask Judge
                            </button>
                          </div>
                        </>
                      ) : (
                        <p className="text-zinc-500 text-sm">Failed to load extended card details.</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      <JudgeSheet 
          cards={selectedCard && scryfallDetails ? [scryfallDetails] : []}
          open={isJudgeSheetOpen}
          onOpenChange={setIsJudgeSheetOpen}
      />
    </div>
  );
}
