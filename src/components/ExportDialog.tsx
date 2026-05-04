import React, { useState } from 'react';
import { Copy, Check, X, Share } from 'lucide-react';
import { SavedCard } from '../store/collectionStore';
import { useToast } from './ui/ToastProvider';

interface ExportDialogProps {
  title: string;
  cards: SavedCard[];
  onClose: () => void;
}

export default function ExportDialog({ title, cards, onClose }: ExportDialogProps) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);

  const generateExportText = (format: 'arena' | 'plain') => {
    const grouped = new Map<string, number>();
    cards.forEach(c => {
      const key = format === 'arena' ? `${c.card.name} (${c.card.set.toUpperCase()})` : c.card.name;
      grouped.set(key, (grouped.get(key) || 0) + 1);
    });
    
    let result = '';
    // Sort alphabetically for convenience
    const sortedKeys = Array.from(grouped.keys()).sort();
    sortedKeys.forEach((key) => {
      result += `${grouped.get(key)} ${key}\n`;
    });
    return result.trim();
  };

  const handleCopy = (format: 'arena' | 'plain') => {
    const text = generateExportText(format);
    if (!text) {
      showToast('No cards to export', 'error');
      return;
    }

    navigator.clipboard.writeText(text).then(() => {
      setCopied(format);
      showToast('Copied to clipboard!', 'success');
      setTimeout(() => setCopied(null), 2000);
    }).catch((err) => {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      showToast('Failed to copy', 'error', undefined, errorObj);
    });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-sm overflow-hidden text-left flex flex-col shadow-2xl">
        <div className="p-5 border-b border-zinc-800 flex justify-between items-start shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white leading-tight">Export {title}</h2>
            <p className="text-zinc-400 text-sm">{cards.length} cards</p>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 -mt-2 text-zinc-500 hover:text-white transition rounded-full">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 flex flex-col gap-4">
          <button 
             onClick={() => handleCopy('plain')}
             className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-white font-bold rounded-2xl flex items-center justify-between px-6 transition group"
          >
            <div className="flex flex-col items-start gap-1">
              <span>Plain Text</span>
              <span className="text-[10px] text-zinc-400 group-hover:text-zinc-300 font-normal uppercase tracking-widest">e.g. 4 Brainstorm</span>
            </div>
            {copied === 'plain' ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5 text-zinc-400" />}
          </button>

          <button 
             onClick={() => handleCopy('arena')}
             className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-white font-bold rounded-2xl flex items-center justify-between px-6 transition group"
          >
             <div className="flex flex-col items-start gap-1">
              <span>MTG Arena / Moxfield</span>
              <span className="text-[10px] text-zinc-400 group-hover:text-zinc-300 font-normal uppercase tracking-widest">e.g. 4 Brainstorm (STA)</span>
            </div>
            {copied === 'arena' ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5 text-zinc-400" />}
          </button>

          {navigator.share && (
            <button 
               onClick={() => {
                 const text = generateExportText('arena');
                 navigator.share({
                   title: `Export ${title}`,
                   text: text,
                 }).catch(console.error);
               }}
               className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-white font-bold rounded-2xl flex items-center justify-between px-6 transition group"
            >
               <div className="flex flex-col items-start gap-1">
                <span>Share via Device...</span>
                <span className="text-[10px] text-zinc-400 group-hover:text-zinc-300 font-normal uppercase tracking-widest">Messages, Notes, Discord</span>
              </div>
              <Share className="w-5 h-5 text-zinc-400" />
            </button>
          )}
        </div>

        <div className="p-5 border-t border-zinc-800 bg-zinc-950">
            <button 
               onClick={onClose}
               className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-2xl transition"
            >
              Done
            </button>
        </div>
      </div>
    </div>
  );
}
