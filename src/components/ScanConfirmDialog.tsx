import React, { useState } from 'react';
import { ScryfallCard } from '../services/scryfall';
import { getStandardCardImage } from '../lib/mtg';
import { useCollectionStore } from '../store/collectionStore';
import { useToast } from './ui/ToastProvider';
import { X, Check, ChevronDown } from 'lucide-react';

interface ScanConfirmDialogProps {
  scryfallCard: ScryfallCard;
  onClose: () => void;
}

export default function ScanConfirmDialog({ scryfallCard, onClose }: ScanConfirmDialogProps) {
  const { addToCollection, decks, addToDeck } = useCollectionStore();
  const { showToast } = useToast();
  const [selectedDeck, setSelectedDeck] = useState<string>('collection');

  const imageUrl = getStandardCardImage(scryfallCard);
  const cardData = {
    id: scryfallCard.id,
    name: scryfallCard.name,
    set: scryfallCard.set,
    setName: scryfallCard.set_name,
    imageUrl,
    priceUsd: scryfallCard.prices?.usd || undefined,
  };

  const handleSave = () => {
    if (selectedDeck === 'collection') {
      addToCollection(cardData);
      showToast(`Added ${cardData.name} to Collection`, 'success');
    } else {
      addToCollection(cardData);
      addToDeck(selectedDeck, cardData);
      const deckName = decks.find(d => d.id === selectedDeck)?.name || 'Deck';
      showToast(`Added ${cardData.name} to ${deckName} & Collection`, 'success');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md max-h-[85vh] overflow-hidden text-left flex flex-col shadow-2xl">
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex justify-between items-start shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest">Match Found</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight mb-1 pr-4">{scryfallCard.name}</h2>
            <p className="text-zinc-400 text-xs sm:text-sm italic">{scryfallCard.set_name} • {scryfallCard.set.toUpperCase()}</p>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 -mt-2 text-zinc-500 hover:text-white transition rounded-full">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-5">
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
              <div className="p-3 bg-zinc-800/50 hover:bg-zinc-800 transition rounded-xl border border-zinc-700/50 flex-1 flex flex-col relative group">
                <p className="text-[10px] uppercase text-zinc-500 mb-1">Save Destination</p>
                <select 
                    className="w-full bg-transparent border-none text-white text-sm font-bold appearance-none outline-none mt-auto cursor-pointer z-10"
                    value={selectedDeck}
                    onChange={(e) => setSelectedDeck(e.target.value)}
                >
                    <option value="collection" className="bg-zinc-800">Collection</option>
                    {decks.length > 0 && (
                        <optgroup label="Decks" className="bg-zinc-800 text-zinc-400">
                            {decks.map(deck => (
                                <option key={deck.id} value={deck.id} className="bg-zinc-800 text-white">{deck.name}</option>
                            ))}
                        </optgroup>
                    )}
                </select>
                <ChevronDown className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 absolute right-3 bottom-3.5 pointer-events-none transition" />
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 border-t border-zinc-800 bg-zinc-950 flex flex-row gap-3 shrink-0">
          <button 
             onClick={onClose}
             className="px-4 py-3 sm:py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-2xl transition whitespace-nowrap"
          >
            Discard
          </button>
          <button 
             onClick={handleSave}
             className="flex-1 py-3 sm:py-4 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-2xl flex items-center justify-center gap-2 transition"
          >
            <Check className="w-5 h-5" />
            <span>Save Card</span>
          </button>
        </div>
      </div>
    </div>
  );
}
