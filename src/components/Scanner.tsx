import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, SwitchCamera, Loader2, X } from 'lucide-react';
import { identifyCardFromImage } from '../services/gemini';
import { searchScryfallCard, ScryfallCard } from '../services/scryfall';
import { useToast } from './ui/ToastProvider';
import { getStandardCardImage } from '../lib/mtg';
import ScanConfirmDialog from './ScanConfirmDialog';

export default function Scanner() {
  const webcamRef = useRef<Webcam>(null);
  const { showToast } = useToast();
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [isProcessing, setIsProcessing] = useState(false);
  const [foundCard, setFoundCard] = useState<ScryfallCard | null>(null);

  const switchCamera = useCallback(() => {
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
  }, []);

  const capture = useCallback(async () => {
    if (isProcessing) return;
    
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) {
      showToast('Could not access camera frame.', 'error');
      return;
    }

    setIsProcessing(true);
    showToast('Identifying card...', 'info');

    try {
      // 1. Identify via Gemini
      const aiResult = await identifyCardFromImage(imageSrc);
      
      if (aiResult.error || !aiResult.name) {
        showToast(aiResult.error || 'Could not identify this card.', 'error');
        setIsProcessing(false);
        return;
      }

      showToast(`Found: ${aiResult.name}. Fetching details...`, 'info');

      // 2. Fetch full details from Scryfall
      const scryCard = await searchScryfallCard(aiResult.name, aiResult.set);
      
      if (!scryCard) {
        showToast(`Could not find details for "${aiResult.name}" in Scryfall.`, 'error');
        setIsProcessing(false);
        return;
      }

      setFoundCard(scryCard);

    } catch (err) {
      console.error(err);
      showToast('An unexpected error occurred.', 'error');
    } finally {
      setIsProcessing(false);
    }
  }, [webcamRef, isProcessing, showToast]);

  return (
    <div className="relative w-full h-full bg-zinc-950 flex flex-col overflow-hidden text-zinc-100">
        
        {/* Top Navigation Bar from template */}
        <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-4 sm:px-8 sm:py-6 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700 pointer-events-auto shadow-md">
                <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-300" />
            </div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-white drop-shadow-md">Scanner</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-zinc-800/80 backdrop-blur-md px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-zinc-700/50 flex items-center gap-2 pointer-events-auto shadow-md">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse"></div>
              <span className="text-[10px] sm:text-xs font-medium uppercase tracking-widest text-zinc-400">Active</span>
            </div>
          </div>
        </header>

        {/* WEBCAM FEED */}
        <div className="absolute inset-0 z-0">
            {/* Background: Camera Feed Simulation if no camera, but we have React Webcam */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-800 via-zinc-900 to-black">
               <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] pointer-events-none"></div>
            </div>
            
            <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode, aspectRatio: 3/4 }}
                className="w-full h-full object-cover relative z-10"
            />
            {/* Outline guide */}
            <div className="absolute inset-0 bg-black/40 pointer-events-none z-10"></div>
            
            {/* The Focal Frame */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[75%] max-w-sm aspect-[3/4] z-10 pointer-events-none flex items-center justify-center">
                {/* Corner Accents */}
                <div className="absolute top-0 left-0 w-8 h-8 sm:w-12 sm:h-12 border-t-4 border-l-4 border-emerald-500 rounded-tl-2xl"></div>
                <div className="absolute top-0 right-0 w-8 h-8 sm:w-12 sm:h-12 border-t-4 border-r-4 border-emerald-500 rounded-tr-2xl"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 sm:w-12 sm:h-12 border-b-4 border-l-4 border-emerald-500 rounded-bl-2xl"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 sm:w-12 sm:h-12 border-b-4 border-r-4 border-emerald-500 rounded-br-2xl"></div>
                
                {/* Scanning Line Simulation */}
                {isProcessing && (
                  <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent top-1/2 -translate-y-1/2 opacity-60 shadow-[0_0_15px_rgba(52,211,153,0.8)] animate-pulse"></div>
                )}
            </div>
        </div>

        {/* SCANNER OVERLAY CONTROLS */}
        <div className="absolute bottom-24 left-0 right-0 p-4 flex flex-col items-center justify-between pointer-events-none z-20 gap-6">
            <div className="flex w-full max-w-md justify-between items-center px-8 pointer-events-auto">
                <button
                    onClick={switchCamera}
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors shadow-xl"
                    aria-label="Switch Camera"
                >
                    <SwitchCamera className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>

                <button
                    onClick={capture}
                    disabled={isProcessing}
                    className={`relative group pointer-events-auto ${isProcessing ? 'opacity-80' : ''}`}
                    aria-label="Take Photo"
                >
                    <div className="absolute -inset-2 bg-emerald-500/20 rounded-full blur-lg group-hover:bg-emerald-500/30 transition-colors"></div>
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white flex items-center justify-center bg-transparent">
                      {isProcessing ? (
                         <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-400 animate-spin" />
                      ) : (
                         <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white group-active:scale-90 transition-transform"></div>
                      )}
                    </div>
                </button>
                
                <div className="w-12 h-12 sm:w-14 sm:h-14" /> {/* Spacer for centering alignment */}
            </div>
        </div>

        {foundCard && (
            <ScanConfirmDialog 
                scryfallCard={foundCard} 
                onClose={() => setFoundCard(null)} 
            />
        )}
    </div>
  );
}
