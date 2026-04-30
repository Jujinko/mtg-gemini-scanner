import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CardData {
  id: string;
  name: string;
  set: string;
  setName: string;
  imageUrl?: string;
  priceUsd?: string;
}

export interface SavedCard {
  instanceId: string; // Unique ID for this specific physical card in the collection
  card: CardData;
  dateAdded: number;
}

export interface Deck {
  id: string;
  name: string;
  cards: SavedCard[];
}

interface CollectionState {
  collection: SavedCard[];
  decks: Deck[];
  addToCollection: (card: CardData) => SavedCard;
  removeFromCollection: (instanceId: string) => void;
  restoreCard: (card: SavedCard) => void;
  createDeck: (name: string) => void;
  deleteDeck: (deckId: string) => void;
  addToDeck: (deckId: string, card: CardData) => SavedCard;
  removeFromDeck: (deckId: string, instanceId: string) => void;
  restoreToDeck: (deckId: string, card: SavedCard) => void;
}

export const useCollectionStore = create<CollectionState>()(
  persist(
    (set) => ({
      collection: [],
      decks: [],

      addToCollection: (card) => {
        const newCard: SavedCard = { instanceId: crypto.randomUUID(), card, dateAdded: Date.now() };
        set((state) => ({
          collection: [...state.collection, newCard],
        }));
        return newCard;
      },

      removeFromCollection: (instanceId) =>
        set((state) => ({
          collection: state.collection.filter((c) => c.instanceId !== instanceId),
        })),
        
      restoreCard: (card) =>
        set((state) => ({
          collection: [...state.collection, card],
        })),

      createDeck: (name) =>
        set((state) => ({
          decks: [
            ...state.decks,
            { id: crypto.randomUUID(), name, cards: [] },
          ],
        })),

      deleteDeck: (deckId) =>
        set((state) => ({
          decks: state.decks.filter((d) => d.id !== deckId),
        })),

      addToDeck: (deckId, card) => {
        const newCard: SavedCard = { instanceId: crypto.randomUUID(), card, dateAdded: Date.now() };
        set((state) => ({
          decks: state.decks.map((deck) =>
            deck.id === deckId
              ? {
                  ...deck,
                  cards: [...deck.cards, newCard],
                }
              : deck
          ),
        }));
        return newCard;
      },

      removeFromDeck: (deckId, instanceId) =>
        set((state) => ({
          decks: state.decks.map((deck) =>
            deck.id === deckId
              ? {
                  ...deck,
                  cards: deck.cards.filter((c) => c.instanceId !== instanceId),
                }
              : deck
          ),
        })),

      restoreToDeck: (deckId, card) =>
        set((state) => ({
          decks: state.decks.map((deck) =>
            deck.id === deckId
              ? {
                  ...deck,
                  cards: [...deck.cards, card],
                }
              : deck
          ),
        })),
    }),
    {
      name: 'mtg-collection-storage',
    }
  )
);
