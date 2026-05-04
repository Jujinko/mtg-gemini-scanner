import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, SwitchCamera, Loader2, X, Zap, ZapOff, Repeat, Scale } from 'lucide-react';
import { identifyCardFromImage } from '../services/gemini';
import { searchScryfallCard, ScryfallCard } from '../services/scryfall';
import { useToast } from './ui/ToastProvider';
import { getStandardCardImage } from '../lib/mtg';
import ScanConfirmDialog from './ScanConfirmDialog';
import JudgeSheet from './JudgeSheet';
import { setAlphaToken, getAlphaToken } from '../lib/judgeFlag';
import { useCollectionStore } from '../store/collectionStore';
import { Drawer } from 'vaul';

export default function Scanner() {
  const webcamRef = useRef<Webcam>(null);
  const { showToast } = useToast();
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [isProcessing, setIsProcessing] = useState(false);
  const [foundCard, setFoundCard] = useState<ScryfallCard | null>(null);
  const [hasPermissionError, setHasPermissionError] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  const [torchSupported, setTorchSupported] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isContinuousMode, setIsContinuousMode] = useState(false);
  const [isJudgeMode, setIsJudgeMode] = useState(false);
  const [judgeCards, setJudgeCards] = useState<ScryfallCard[]>([]);
  const [isJudgeSheetOpen, setIsJudgeSheetOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [alphaTokenInput, setAlphaTokenInput] = useState(getAlphaToken() || '');
  const { addToCollection, removeFromCollection } = useCollectionStore();
  const [focusPoint, setFocusPoint] = useState<{ x: number, y: number } | null>(null);

  const pressTimerRef = useRef<number | null>(null);
  const handlePressStart = () => {
    pressTimerRef.current = window.setTimeout(() => setIsSettingsOpen(true), 1000);
  };
  const handlePressEnd = () => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
  };

  React.useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleUserMediaError = useCallback((error: any) => {
    console.error("Camera access denied or error:", error);
    setHasPermissionError(true);
  }, []);

  const handleUserMedia = useCallback((stream: MediaStream) => {
    const track = stream.getVideoTracks()[0];
    if (track) {
      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      if ((capabilities as any).torch) {
        setTorchSupported(true);
      }
    }
  }, []);

  const toggleTorch = useCallback(async () => {
    const stream = webcamRef.current?.video?.srcObject as MediaStream | undefined;
    if (stream) {
      const track = stream.getVideoTracks()[0];
      if (track) {
        try {
          await track.applyConstraints({
             advanced: [{ torch: !isTorchOn }] as any
          });
          setIsTorchOn(!isTorchOn);
        } catch (err) {
          console.error("Failed to toggle torch", err);
        }
      }
    }
  }, [isTorchOn]);

  const switchCamera = useCallback(() => {
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
    setIsTorchOn(false); // Reset torch state when switching cameras
  }, []);

  const handleVideoTap = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
    const stream = webcamRef.current?.video?.srcObject as MediaStream | undefined;
    const track = stream?.getVideoTracks()[0];
    if (!track) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    setFocusPoint({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setTimeout(() => setFocusPoint(null), 1000);

    try {
      await track.applyConstraints({
         advanced: [{
           pointsOfInterest: [{ x, y }],
           focusMode: 'single-shot',
         }] as any,
      });
    } catch (err) {
      // Capability not supported, fail silently
    }
  }, []);

  const capture = useCallback(async () => {
    if (isProcessing || foundCard) return;
    
    if (isOffline) {
      showToast('You are offline. Please connect to the internet to scan.', 'error', undefined, new Error('Offline'));
      if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
      return;
    }

    const rawImage = webcamRef.current?.getScreenshot();
    if (!rawImage) {
      showToast('Could not access camera frame.', 'error', undefined, new Error('Camera access failed null screenshot'));
      if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
      return;
    }

    if (navigator.vibrate) navigator.vibrate(15);
    setIsProcessing(true);
    showToast('Identifying card...', 'info');

    try {
      const cropToFocalFrame = (dataUrl: string): Promise<string> => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const targetWidth = img.width * 0.75;
            const targetHeight = targetWidth * (4 / 3);
            const safeHeight = Math.min(targetHeight, img.height * 0.95);
            const safeWidth = safeHeight * (3 / 4);
            canvas.width = safeWidth;
            canvas.height = safeHeight;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(
              img,
              (img.width - safeWidth) / 2,
              (img.height - safeHeight) / 2,
              safeWidth,
              safeHeight,
              0, 0, safeWidth, safeHeight
            );
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          };
          img.src = dataUrl;
        });
      };

      const imageSrc = await cropToFocalFrame(rawImage);

      // 1. Identify via Gemini
      const aiResult = await identifyCardFromImage(imageSrc);
      
      if (aiResult.error || !aiResult.name) {
        const errMsg = aiResult.error || 'Could not identify this card.';
        const errObj = aiResult.errorObj || new Error(`Gemini Identification Error: ${errMsg}`);
        showToast(errMsg, 'error', undefined, errObj);
        if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
        setIsProcessing(false);
        return;
      }

      showToast(`Found: ${aiResult.name}. Fetching details...`, 'info');

      // 2. Fetch full details from Scryfall
      const searchResult = await searchScryfallCard(aiResult.name, aiResult.set);
      
      if (!searchResult) {
        showToast(`Could not find details for "${aiResult.name}" in Scryfall.`, 'error', undefined, new Error(`Scryfall Lookup Failed for "${aiResult.name}"`));
        if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
        setIsProcessing(false);
        return;
      }

      if (navigator.vibrate) navigator.vibrate([10, 30, 10]);

      if (isJudgeMode) {
        if (judgeCards.length >= 3) {
          showToast('Max 3 cards for Judge mode. Ask a question or remove a card.', 'error', undefined, new Error(`Judge mode card limit exceeded`));
        } else if (judgeCards.find(c => c.id === searchResult.card.id)) {
          showToast(`Card ${searchResult.card.name} is already added.`, 'info');
        } else {
          setJudgeCards(prev => [...prev, searchResult.card]);
          showToast(`Added ${searchResult.card.name} to Judge tray.`, 'success');
        }
      } else if (isContinuousMode) {
        if (searchResult.matchType === 'exact') {
          const scryCard = searchResult.card;
          const imageUrl = getStandardCardImage(scryCard);
          const savedCard = addToCollection({
            id: scryCard.id,
            name: scryCard.name,
            set: scryCard.set,
            setName: scryCard.set_name,
            imageUrl,
            priceUsd: scryCard.prices?.usd || undefined,
          });
          showToast(`Auto-saved: ${scryCard.name}`, 'success', {
            label: 'Undo',
            onClick: () => {
              removeFromCollection(savedCard.instanceId);
            }
          });
        } else {
          showToast(`Found but couldn't exact match. Tap to save.`, 'info');
          setFoundCard(searchResult.card);
        }
      } else {
        setFoundCard(searchResult.card);
      }

    } catch (err: unknown) {
      console.error(err);
      const errorObj = err instanceof Error ? err : new Error(String(err));
      showToast('An unexpected error occurred.', 'error', undefined, errorObj);
      if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
    } finally {
      setIsProcessing(false);
    }
  }, [webcamRef, isProcessing, showToast, isOffline, isContinuousMode, isJudgeMode, judgeCards, addToCollection, removeFromCollection, foundCard]);

  React.useEffect(() => {
    if (!isContinuousMode || isProcessing || isOffline || foundCard) return;
    
    const cooldown = setTimeout(() => {
      const interval = setInterval(() => {
        if (!isProcessing && !foundCard) {
          capture();
        }
      }, 2500); // Poll every 2.5 seconds
      return () => clearInterval(interval);
    }, 1500); // 1.5 second cooldown after last capture
    return () => clearTimeout(cooldown);
  }, [isContinuousMode, isProcessing, isOffline, foundCard, capture]);

  return (
    <div className="relative w-full h-full bg-zinc-950 flex flex-col overflow-hidden text-zinc-100">
        
        {/* Top Navigation Bar from template */}
        <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-4 sm:px-8 sm:py-6 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
          <div className="flex items-center gap-2 sm:gap-4 pointer-events-auto select-none"
               onPointerDown={handlePressStart}
               onPointerUp={handlePressEnd}
               onPointerLeave={handlePressEnd}
               onContextMenu={(e) => e.preventDefault()}
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700 shadow-md">
                <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-300" />
            </div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-white drop-shadow-md">Scanner</h1>
          </div>
          <div className="flex items-center gap-3">
            {torchSupported && facingMode === 'environment' && (
              <button 
                  onClick={toggleTorch}
                  className={`p-2 rounded-full border pointer-events-auto shadow-md transition-colors ${
                     isTorchOn ? 'bg-zinc-100 text-zinc-900 border-zinc-200' : 'bg-zinc-800/80 text-zinc-400 border-zinc-700/50 hover:text-white'
                  }`}
                  aria-label="Toggle Torch"
              >
                  {isTorchOn ? <Zap className="w-4 h-4 sm:w-4 sm:h-4" /> : <ZapOff className="w-4 h-4 sm:w-4 sm:h-4" />}
              </button>
            )}
            {isOffline && (
              <div className="bg-red-500/20 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-red-500/50 flex items-center gap-2 pointer-events-auto shadow-md">
                <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
                <span className="text-[10px] sm:text-xs font-medium uppercase tracking-widest text-red-500">Offline</span>
              </div>
            )}
            {!isOffline && (
              <div className="bg-zinc-800/80 backdrop-blur-md px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-zinc-700/50 flex items-center gap-2 pointer-events-auto shadow-md">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse"></div>
                <span className="text-[10px] sm:text-xs font-medium uppercase tracking-widest text-zinc-400">Active</span>
              </div>
            )}
          </div>
        </header>

        {/* WEBCAM FEED */}
        <div className="absolute inset-0 z-0 bg-black">
            {hasPermissionError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center bg-zinc-950 z-20">
                    <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4 border border-zinc-800">
                        <Camera className="w-8 h-8 text-zinc-500" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Camera Access Denied</h2>
                    <p className="text-zinc-400 mb-6 max-w-sm">
                        Arcane Scanner needs camera access to identify Magic: The Gathering cards. 
                        Please enable camera access in your device settings.
                    </p>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 w-full max-w-sm text-left">
                        <p className="text-sm text-zinc-300 font-medium mb-1">On iOS (Safari):</p>
                        <p className="text-xs text-zinc-500 mb-3">Settings → Safari → Camera → Allow</p>
                        
                        <p className="text-sm text-zinc-300 font-medium mb-1">On Android (Chrome):</p>
                        <p className="text-xs text-zinc-500 mb-3">Settings → Site Settings → Camera → Allow</p>
                    </div>
                    <button 
                        onClick={() => window.location.reload()}
                        className="mt-6 px-6 py-3 bg-emerald-500 text-zinc-950 font-bold rounded-xl"
                    >
                        Reload Page
                    </button>
                </div>
            ) : (
                <>
                    {/* Background: Camera Feed Simulation if no camera, but we have React Webcam */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-800 via-zinc-900 to-black">
                       <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] pointer-events-none"></div>
                    </div>
                    
                    <div className="absolute inset-0 z-10" onClick={handleVideoTap}>
                      {/* @ts-ignore */}
                      <Webcam
                          audio={false}
                          ref={webcamRef}
                          screenshotFormat="image/jpeg"
                          videoConstraints={{ facingMode }}
                          onUserMediaError={handleUserMediaError}
                          onUserMedia={handleUserMedia}
                          className="w-full h-full object-cover relative pointer-events-none"
                      />
                      {focusPoint && (
                        <div 
                           className="absolute w-12 h-12 border-2 border-emerald-400 rounded-lg pointer-events-none -translate-x-1/2 -translate-y-1/2 animate-ping"
                           style={{ left: focusPoint.x, top: focusPoint.y }}
                        />
                      )}
                    </div>

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
                </>
            )}
        </div>

        {/* SCANNER OVERLAY CONTROLS */}
        <div className="absolute bottom-[140px] left-0 right-0 p-4 flex flex-col items-center justify-between pointer-events-none z-20 gap-6">
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
                
                <button
                    onClick={() => setIsContinuousMode(!isContinuousMode)}
                    className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full border flex items-center justify-center transition-colors shadow-xl relative ${
                       isContinuousMode 
                         ? 'bg-emerald-500 border-emerald-400 text-zinc-950' 
                         : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                    aria-label="Continuous Mode"
                >
                    <Repeat className="w-5 h-5 sm:w-6 sm:h-6" />
                    {isContinuousMode && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-zinc-950 shadow-[0_0_5px_rgba(52,211,153,0.8)]"></div>
                    )}
                </button>
                
                <button
                    onClick={() => {
                        setIsJudgeMode(!isJudgeMode);
                        if (isContinuousMode) setIsContinuousMode(false);
                    }}
                    className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full border flex items-center justify-center transition-colors shadow-xl relative ${
                       isJudgeMode 
                         ? 'bg-purple-500 border-purple-400 text-zinc-950' 
                         : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                    aria-label="Judge Mode"
                >
                    <Scale className="w-5 h-5 sm:w-6 sm:h-6" />
                    {isJudgeMode && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-400 rounded-full border-2 border-zinc-950 shadow-[0_0_5px_rgba(168,85,247,0.8)]"></div>
                    )}
                </button>
            </div>
            
            {/* Judge Tray */}
            {isJudgeMode && (
                <div className="bg-zinc-900/90 backdrop-blur-md rounded-xl p-3 border border-zinc-800/80 w-[90%] max-w-sm pointer-events-auto flex items-center justify-between shadow-2xl">
                    <div className="flex gap-2 min-w-0 flex-1 overflow-x-auto pr-2 pb-1">
                        {judgeCards.length === 0 && <span className="text-sm text-zinc-500 py-1">Scan cards to ask Judge...</span>}
                        {judgeCards.map((c, i) => (
                           <div key={i} className="flex-shrink-0 bg-zinc-800 rounded px-2 py-1 text-xs border border-zinc-700 max-w-[100px] truncate relative group">
                             {c.name}
                             <button 
                               onClick={() => setJudgeCards(prev => prev.filter((_, idx) => idx !== i))}
                               className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center hidden group-hover:flex shadow-sm"
                             >
                                <X className="w-3 h-3" />
                             </button>
                           </div>
                        ))}
                    </div>
                    <button 
                       onClick={() => setIsJudgeSheetOpen(true)}
                       disabled={judgeCards.length === 0}
                       className="bg-emerald-500 text-zinc-950 font-bold px-4 py-2 rounded-lg text-sm flex-shrink-0 disabled:opacity-50"
                    >
                       Ask
                    </button>
                </div>
            )}
        </div>

        <JudgeSheet 
            cards={judgeCards}
            open={isJudgeSheetOpen}
            onOpenChange={setIsJudgeSheetOpen}
        />

        {foundCard && !isJudgeMode && (
            <ScanConfirmDialog 
                scryfallCard={foundCard} 
                onClose={() => setFoundCard(null)} 
                onOverrideCard={(card) => setFoundCard(card)}
            />
        )}

        <Drawer.Root open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
                <Drawer.Content className="bg-zinc-950 border-t border-zinc-800 flex flex-col rounded-t-[20px] fixed bottom-0 left-0 right-0 z-50 text-zinc-100 font-sans shadow-2xl p-5 pb-8">
                    <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-zinc-800 mb-6" />
                    <h3 className="font-bold text-lg mb-4">Settings</h3>
                    
                    <div className="flex flex-col gap-2">
                        <label className="text-sm text-zinc-400">Alpha Access Token</label>
                        <div className="flex gap-2">
                            <input 
                               type="text" 
                               value={alphaTokenInput}
                               onChange={(e) => setAlphaTokenInput(e.target.value)}
                               placeholder="Enter token..."
                               className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm focus:outline-none focus:border-emerald-500/50"
                            />
                            <button 
                               onClick={() => {
                                 const success = setAlphaToken(alphaTokenInput);
                                 if (success) {
                                   showToast('Alpha token initialized', 'success');
                                   setIsSettingsOpen(false);
                                   // Hard reload to let state catch up globally
                                   window.location.reload();
                                 } else {
                                   showToast('Invalid alpha token', 'error', undefined, new Error(`Invalid token: ${alphaTokenInput}`));
                                 }
                               }}
                               className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 rounded-lg font-medium text-sm transition"
                            >
                               Save
                            </button>
                        </div>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    </div>
  );
}
