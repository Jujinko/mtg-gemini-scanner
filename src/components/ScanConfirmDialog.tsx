import React, { useState } from 'react';
import { ScryfallCard, searchScryfallCard } from '../services/scryfall';
import { getStandardCardImage } from '../lib/mtg';
import { useCollectionStore } from '../store/collectionStore';
import { useToast } from './ui/ToastProvider';
import { X, Check, ChevronDown, Search, Plus, Minus, Loader2 } from 'lucide-react';
import { Drawer } from 'vaul';

interface ScanConfirmDialogProps {
  scryfallCard: ScryfallCard;
  onClose: () => void;
  onOverrideCard: (card: ScryfallCard) => void;
}

export default function ScanConfirmDialog({ scryfallCard, onClose, onOverrideCard }: ScanConfirmDialogProps) {
  const { addToCollection, decks, addToDeck, createDeck } = useCollectionStore();
  const { showToast } = useToast();
  const [selectedDeck, setSelectedDeck] = useState<string>('collection');
  const [quantity, setQuantity] = useState(1);
  const [showDeckPicker, setShowDeckPicker] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ScryfallCard[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const imageUrl = getStandardCardImage(scryfallCard);

  const handleSave = () => {
    let finalDeckId = selectedDeck;
    if (showDeckPicker && newDeckName.trim()) {
      createDeck(newDeckName.trim());
      // Find the newly created deck ID? Our store createDeck doesn't return the ID.
      // So we might need to modify the store, or just rely on the latest deck.
      // Actually if they create it inline, it's easier to just save to it...
      // Let's modify handleSave for inline deck creation:
      const newDeckId = crypto.randomUUID();
      useCollectionStore.setState((state) => ({
        decks: [{ id: newDeckId, name: newDeckName.trim(), cards: [], lastUpdated: Date.now() }, ...state.decks]
      }));
      finalDeckId = newDeckId;
    }

    for (let i = 0; i < quantity; i++) {
        const cardData = {
            id: scryfallCard.id,
            name: scryfallCard.name,
            set: scryfallCard.set,
            setName: scryfallCard.set_name,
            imageUrl,
            priceUsd: scryfallCard.prices?.usd || undefined,
        };

        if (finalDeckId === 'collection') {
            addToCollection(cardData);
        } else {
            addToCollection(cardData);
            addToDeck(finalDeckId, cardData);
        }
    }

    const deckName = decks.find(d => d.id === finalDeckId)?.name || newDeckName || 'Collection';
    showToast(`Added ${quantity}x ${scryfallCard.name} to ${finalDeckId === 'collection' ? 'Collection' : deckName}`, 'success');
    onClose();
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(searchQuery.trim())}`).then(r => r.json());
      if (results.data) {
        setSearchResults(results.data.slice(0, 10));
      } else {
        setSearchResults([]);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <Drawer.Root open={true} onClose={onClose} dismissible={true}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70]" />
        <Drawer.Content className="bg-zinc-900 border-t border-zinc-800 flex flex-col rounded-t-3xl h-[90vh] sm:h-[80vh] mt-24 fixed bottom-0 left-0 right-0 z-[80] shadow-2xl">
          <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-zinc-700 my-4" />
          
          <div className="p-4 sm:p-5 flex justify-between items-start shrink-0 pt-0">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest">Match Found</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight mb-1 pr-4">{scryfallCard.name}</h2>
              <p className="text-zinc-400 text-xs sm:text-sm italic">{scryfallCard.set_name} • {scryfallCard.set.toUpperCase()}</p>
            </div>
            <button onClick={onClose} className="p-2 -mr-2 text-zinc-500 hover:text-white transition rounded-full">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-y-contain px-4 sm:px-6 pb-6 flex flex-col gap-5">
            {showSearch ? (
              <div className="flex flex-col h-full gap-4">
                <form onSubmit={handleSearch} className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <input
                    type="search"
                    autoFocus
                    placeholder="Search for correct card..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-base text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all outline-none"
                  />
                </form>
                <div className="flex-1 overflow-y-auto space-y-2">
                  {isSearching ? (
                    <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 text-emerald-500 animate-spin" /></div>
                  ) : searchResults.map(card => (
                    <button
                      key={card.id}
                      onClick={() => onOverrideCard(card)}
                      className="w-full p-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-xl text-left border border-zinc-800 flex gap-3 items-center"
                    >
                      {getStandardCardImage(card) ? (
                        <div className="w-12 h-16 bg-zinc-900 rounded overflow-hidden flex-shrink-0">
                          <img src={getStandardCardImage(card)} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-12 h-16 bg-zinc-900 rounded flex-shrink-0" />
                      )}
                      <div>
                        <p className="font-bold text-white text-sm">{card.name}</p>
                        <p className="text-xs text-zinc-400">{card.set_name}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <button 
                  onClick={() => setShowSearch(false)}
                  className="py-3 text-sm font-bold text-zinc-400 hover:text-white"
                >
                  Cancel Search
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                <div className="flex flex-row gap-4 sm:gap-6">
                  <div className="w-[120px] sm:w-[150px] shrink-0 flex flex-col justify-start">
                    {imageUrl ? (
                      <div className="w-full border border-zinc-700 rounded-xl overflow-hidden shadow-inner relative">
                        <img 
                            src={imageUrl} 
                            alt={scryfallCard.name}
                            className="w-full h-auto block" 
                        />
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/10 via-transparent to-black/30 pointer-events-none"></div>
                      </div>
                    ) : (
                      <div className="w-full aspect-[2.5/3.5] bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-500 border border-zinc-700">
                          <span className="text-[10px] uppercase text-center px-2">No Image</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col gap-3">
                    <div className="p-3 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
                      <p className="text-[10px] uppercase text-zinc-500 mb-0.5">Market Price</p>
                      <p className="text-lg font-bold text-emerald-400 leading-none">{scryfallCard.prices?.usd ? `$${scryfallCard.prices.usd}` : 'N/A'}</p>
                    </div>

                    <Drawer.NestedRoot open={showDeckPicker} onOpenChange={setShowDeckPicker}>
                      <Drawer.Trigger asChild>
                        <button className="p-3 bg-zinc-800/50 hover:bg-zinc-800 transition rounded-xl border border-zinc-700/50 flex-1 flex flex-col relative group text-left">
                          <p className="text-[10px] uppercase text-zinc-500 mb-1">Save Destination</p>
                          <p className="w-full bg-transparent border-none text-white text-base font-bold pr-6 truncate">
                            {selectedDeck === 'collection' ? 'Collection' : decks.find(d => d.id === selectedDeck)?.name || 'Unknown Deck'}
                          </p>
                          <ChevronDown className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 absolute right-3 bottom-3.5 pointer-events-none transition" />
                        </button>
                      </Drawer.Trigger>
                      <Drawer.Portal>
                        <Drawer.Overlay className="fixed inset-0 bg-black/60 z-[90]" />
                        <Drawer.Content className="bg-zinc-900 border-t border-zinc-800 flex flex-col rounded-t-3xl h-[70vh] fixed bottom-0 left-0 right-0 z-[100] shadow-2xl">
                          <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-zinc-700 my-4" />
                          <div className="px-6 pb-2">
                            <h3 className="text-lg font-bold text-white">Select Destination</h3>
                          </div>
                          <div className="flex-1 overflow-y-auto px-6 pb-6 pt-2 space-y-2">
                            <button
                              onClick={() => { setSelectedDeck('collection'); setShowDeckPicker(false); }}
                              className={`w-full p-4 rounded-xl text-left font-bold transition flex justify-between items-center ${selectedDeck === 'collection' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-zinc-800 text-zinc-300 border border-zinc-700/50 hover:bg-zinc-700'}`}
                            >
                              Collection
                              {selectedDeck === 'collection' && <Check className="w-5 h-5" />}
                            </button>
                            {decks.map(deck => (
                              <button
                                key={deck.id}
                                onClick={() => { setSelectedDeck(deck.id); setShowDeckPicker(false); }}
                                className={`w-full p-4 rounded-xl text-left font-bold transition flex justify-between items-center ${selectedDeck === deck.id ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-zinc-800 text-zinc-300 border border-zinc-700/50 hover:bg-zinc-700'}`}
                              >
                                {deck.name}
                                {selectedDeck === deck.id && <Check className="w-5 h-5" />}
                              </button>
                            ))}
                            
                            <div className="pt-4 border-t border-zinc-800 mt-4">
                              <p className="text-xs font-bold uppercase text-zinc-500 mb-2">Create New Deck</p>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={newDeckName}
                                  onChange={(e) => setNewDeckName(e.target.value)}
                                  placeholder="Deck name..."
                                  className="flex-1 px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white outline-none focus:border-emerald-500"
                                />
                                <button
                                  disabled={!newDeckName.trim()}
                                  onClick={() => {
                                      // Logic to create deck inline will be in handleSave
                                      // For now, let's just select a special temporary ID
                                      setSelectedDeck('new_deck');
                                      setShowDeckPicker(false);
                                  }}
                                  className="px-4 py-2 bg-emerald-500 text-zinc-950 font-bold rounded-xl disabled:opacity-50"
                                >
                                  Select
                                </button>
                              </div>
                            </div>
                          </div>
                        </Drawer.Content>
                      </Drawer.Portal>
                    </Drawer.NestedRoot>

                    {/* Quantity Stepper */}
                    <div className="p-3 flex items-center justify-between bg-zinc-800/50 rounded-xl border border-zinc-700/50">
                      <p className="text-[10px] uppercase text-zinc-500">Quantity</p>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => setQuantity(Math.max(1, quantity - 1))}
                          className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-white"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="text-lg font-bold w-6 text-center text-white">{quantity}</span>
                        <button 
                          onClick={() => setQuantity(Math.min(99, quantity + 1))}
                          className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-white"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 flex justify-center">
                  <button 
                    onClick={() => setShowSearch(true)}
                    className="text-sm text-zinc-400 hover:text-emerald-400 underline underline-offset-4 transition"
                  >
                    Not the right card?
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 sm:p-5 border-t border-zinc-800 bg-zinc-950 flex flex-row gap-3 shrink-0">
            <button 
               onClick={onClose}
               className="px-4 py-3 sm:py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-2xl transition whitespace-nowrap"
            >
              Cancel
            </button>
            <button 
               onClick={handleSave}
               className="flex-1 py-3 sm:py-4 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-2xl flex items-center justify-center gap-2 transition"
            >
              <Check className="w-5 h-5" />
              <span>Save {quantity > 1 ? `${quantity} Cards` : 'Card'}</span>
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
