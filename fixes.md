# MTG Scanner — Post-Implementation Corrections

A sequenced fix list addressing the issues found in the implementation review of the 35-item batch plan. Items are grouped by urgency: ship blockers first, then type-system debt, then spec gaps where the implementation works but doesn't match the original intent.

Each item names the file(s) to touch, the exact problem, and the proposed fix.

---

## Phase 1 — Ship blockers

These are bugs that affect users right now. Fix before any further feature work.

### 1.1 Inline "Create new deck" flow saves to nowhere
- **Severity:** Critical
- **Where:** `src/components/ScanConfirmDialog.tsx`, `src/store/collectionStore.ts`
- **Problem:** When a user opens the destination picker, types a new deck name, and hits "Select", the code sets `selectedDeck = 'new_deck'` (a placeholder string) and closes the picker. On Save, the resolution branch — `if (showDeckPicker && newDeckName.trim())` — never fires because `showDeckPicker` is already false. The placeholder ID flows into `addToDeck('new_deck', ...)`, which silently no-ops because no deck with that ID exists. The card gets added to the master collection but **never to the new deck**. As a secondary issue, even if that branch did fire, it both calls `createDeck()` AND does its own `useCollectionStore.setState(...)` with a different `crypto.randomUUID()`, so two decks would be created where one was intended. The inline `setState` also writes a `lastUpdated` field that doesn't exist on the `Deck` interface.
- **Fix:**
  1. Update `createDeck` in the store to return the new deck's ID:
     ```ts
     createDeck: (name) => {
       const newDeck = { id: crypto.randomUUID(), name, cards: [] };
       set((state) => ({ decks: [...state.decks, newDeck] }));
       return newDeck.id;
     }
     ```
     Update the `CollectionState` type signature accordingly: `createDeck: (name: string) => string`.
  2. In `ScanConfirmDialog.tsx`, store the new deck name in state when "Select" is pressed (not a placeholder ID), and resolve it in `handleSave`:
     ```ts
     const handleSave = () => {
       let finalDeckId = selectedDeck;
       if (selectedDeck === 'new_deck' && newDeckName.trim()) {
         finalDeckId = createDeck(newDeckName.trim());
       }
       // …rest of handleSave uses finalDeckId
     };
     ```
  3. Remove the inline `useCollectionStore.setState(...)` call entirely.
  4. Remove `lastUpdated` from the inline state write (or, if persistence of last-edit time is wanted, add `lastUpdated?: number` to the `Deck` interface in the store and update both `createDeck` and `addToDeck` to set it).

### 1.2 PWA manifest points at icon files that don't exist
- **Severity:** Critical
- **Where:** `public/`
- **Problem:** `public/manifest.json` references `icon-192.png` and `icon-512.png`. `index.html` references `icon-192.png` as the apple-touch-icon. Neither file exists in `public/` — the directory contains only `manifest.json`. iOS will fall back to a screenshot of the page as the home-screen icon (low quality, often illegible). Android Chrome's "Add to Home Screen" install prompt **will not fire at all** without a 192×192 icon, defeating the entire purpose of Batch 2. Lighthouse PWA audit will flag this as a hard fail.
- **Fix:**
  1. Generate two PNGs: a 192×192 and a 512×512 app icon. Use the existing emerald accent over zinc-950 background to match the app theme. The icon should be square with the safe-zone interior content, since Android may apply a circle/rounded mask.
  2. Place them at `public/icon-192.png` and `public/icon-512.png`.
  3. Optionally also generate a 180×180 `apple-touch-icon.png` (iOS standard size) and update the `<link rel="apple-touch-icon">` href accordingly.
  4. Add a `purpose: "any maskable"` entry to the manifest icons so Android handles the safe zone correctly:
     ```json
     { "src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
     ```
  5. Verify by running Chrome DevTools → Application → Manifest, then triggering "Add to Home Screen". The install prompt should now appear.

### 1.3 Aspect ratio constraint removed without client-side crop fallback
- **Severity:** Critical
- **Where:** `src/components/Scanner.tsx`, `src/services/gemini.ts`
- **Problem:** The original audit flagged that `videoConstraints` hard-coded `aspectRatio: 3/4`, which some Android browsers reject silently. The fix was to drop the constraint AND crop client-side to the focal frame's dimensions. The implementation only did the first half: `videoConstraints={{ facingMode }}` no longer constrains aspect ratio, but `webcamRef.current?.getScreenshot()` returns the full raw camera frame — often 16:9 on Android, with the card occupying ~30% of the image and the dimmed background filling the rest. **This may reduce Gemini's identification accuracy below pre-fix levels** because the card is now a smaller portion of the input image.
- **Fix:** Crop the screenshot to the focal frame region before sending to Gemini. The focal frame is `top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[75%] aspect-[3/4]`, so it's the centered 75%-wide × (75%×4/3 = 100% if landscape, but actually clamped) region. Implementation sketch:
  ```ts
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
  ```
  Then in `capture()`:
  ```ts
  const rawImage = webcamRef.current?.getScreenshot();
  if (!rawImage) { /* error */ return; }
  const imageSrc = await cropToFocalFrame(rawImage);
  ```
  This also reduces upload size to Gemini, lowering latency and cost.

---

## Phase 2 — Type-system debt

These don't break the app at runtime but mislead anyone editing the code. Fix during the next refactor pass.

### 2.1 `ScryfallCard` interface missing fields used by Collection detail sheet
- **Severity:** Medium
- **Where:** `src/services/scryfall.ts`
- **Problem:** `Collection.tsx` accesses `scryfallDetails.oracle_text`, `scryfallDetails.flavor_text`, `scryfallDetails.legalities`, `scryfallDetails.scryfall_uri`, and `scryfallDetails.prices.usd_foil`. None of these are declared on the `ScryfallCard` interface. The code only compiles because `tsconfig.json` lacks `"strict": true`. Anyone refactoring `ScryfallCard` will not see these dependencies and may break the detail sheet without realizing it.
- **Fix:** Update the interface to match what the code actually reads:
  ```ts
  export interface ScryfallCard {
    id: string;
    name: string;
    set: string;
    set_name: string;
    image_uris?: { normal: string; small: string };
    card_faces?: Array<{ image_uris?: { normal: string } }>;
    prices: {
      usd: string | null;
      usd_foil?: string | null;
    };
    oracle_text?: string;
    flavor_text?: string;
    legalities?: Record<string, 'legal' | 'not_legal' | 'restricted' | 'banned'>;
    scryfall_uri?: string;
  }
  ```

### 2.2 Enable TypeScript strict mode
- **Severity:** Medium
- **Where:** `tsconfig.json`
- **Problem:** Without `"strict": true`, TypeScript silently accepts undefined property accesses and missing-field interfaces (which is how 2.1 went unnoticed). Cost of fixing now is small; cost grows linearly with codebase size.
- **Fix:** Add to `compilerOptions`:
  ```json
  "strict": true,
  "noUncheckedIndexedAccess": true
  ```
  Then run `npm run lint` (which is `tsc --noEmit`) and fix the errors that surface. Most will be in `ScanConfirmDialog.tsx` (the `searchResults.map(card => ...)` where `card` may be partial) and the `useCollectionStore.setState` shape mismatches called out in 1.1.

### 2.3 `Deck` interface missing `lastUpdated`
- **Severity:** Low
- **Where:** `src/store/collectionStore.ts`, `src/components/ScanConfirmDialog.tsx`
- **Problem:** Inline `setState` in `ScanConfirmDialog` writes a `lastUpdated: Date.now()` field to deck records, but the `Deck` interface declares no such field. Currently this is dead data because the field is never read. After fixing 1.1 the offending write disappears, but it's worth deciding whether to add the field intentionally for sorting decks by recency.
- **Fix:** Either:
  - Add `lastUpdated?: number` to the `Deck` interface and update `createDeck`, `addToDeck`, and `removeFromDeck` to set it. Useful for sorting decks "most recently edited first".
  - OR: confirm 1.1's fix removes the orphan write and don't add the field.

### 2.4 Dead import in ScanConfirmDialog
- **Severity:** Low
- **Where:** `src/components/ScanConfirmDialog.tsx` line 2
- **Problem:** `searchScryfallCard` is imported but never called — the in-dialog search calls `fetch` directly instead of the helper.
- **Fix:** Either remove the import, or refactor the search to use `searchScryfallCard` with a new signature that returns multiple candidates (currently it returns the first match only). The latter is cleaner and removes the duplicated Scryfall URL string.

---

## Phase 3 — Spec gaps

The feature exists and works, but the original spec called for more. Prioritize based on user feedback.

### 3.1 Continuous mode is auto-confirm, not continuous capture
- **Severity:** High (for power users)
- **Where:** `src/components/Scanner.tsx`
- **Problem:** When continuous mode is on, matches auto-save without the confirm dialog (good), but the user **still has to tap the shutter for each card**. The spec's vision was "scan a binder of 100 cards in ~90 seconds": match → auto-save → camera re-engages and waits → next card moves into frame → auto-capture. The current implementation halves the friction (1 tap per card vs. 2) but doesn't 10× it as intended.
- **Fix:** When continuous mode is on, after a successful save, start a 1.5-second cooldown then poll the camera frame on a 500ms interval. Use a lightweight motion detector or simply a "frame has changed significantly since last successful match" heuristic to trigger the next capture automatically. Implementation sketch:
  ```ts
  useEffect(() => {
    if (!isContinuousMode || isProcessing) return;
    const cooldown = setTimeout(() => {
      const interval = setInterval(() => {
        if (!isProcessing && hasNewCardInFrame()) {
          capture();
        }
      }, 500);
      return () => clearInterval(interval);
    }, 1500);
    return () => clearTimeout(cooldown);
  }, [isContinuousMode, isProcessing]);
  ```
  `hasNewCardInFrame()` can compare the current frame's pixel histogram to the last-captured frame using a downsampled canvas. Alternatively, use simple edge-detection: if the average pixel variance in the focal frame region exceeds a threshold, assume a new card is present.

  Add a confidence threshold gate to prevent garbage saves: only auto-save if the Scryfall lookup found an exact match (not a fuzzy fallback). The current `searchScryfallCard` doesn't expose which attempt succeeded — refactor it to return `{ card, matchType: 'exact' | 'fuzzy' | 'general' }` and only auto-save on `'exact'`.

### 3.2 Tap-to-focus on the camera feed
- **Severity:** Medium
- **Where:** `src/components/Scanner.tsx`
- **Problem:** Spec for 5.1 called for both torch AND tap-to-focus. Torch was implemented; tap-to-focus was not. Glossy MTG cards near the edge of the focal frame can stay blurry, particularly under indoor lighting where autofocus hunts.
- **Fix:** Add a click/touch handler on the video element. On click, get the click coordinates relative to the video, normalize to 0–1, and call `applyConstraints` with a points-of-interest constraint:
  ```ts
  const handleVideoTap = async (e: React.MouseEvent<HTMLDivElement>) => {
    const stream = webcamRef.current?.video?.srcObject as MediaStream;
    const track = stream?.getVideoTracks()[0];
    if (!track) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    try {
      await track.applyConstraints({
        advanced: [{
          pointsOfInterest: [{ x, y }],
          focusMode: 'single-shot',
        }] as any,
      });
      // Show a brief focus indicator at the tap location
    } catch (err) {
      // Capability not supported, fail silently
    }
  };
  ```
  Render a brief focus-square animation at the tap location so the user gets feedback even when the underlying API is a no-op.

### 3.3 "Add from Collection" is single-tap-add, not multi-select
- **Severity:** High (for deck builders)
- **Where:** `src/components/Decks.tsx`
- **Problem:** Each tap on a card in the "Add from Collection" sheet immediately fires `addToDeck` and shows a toast. Adding 60 cards to a Commander deck = 60 individual taps and 60 toast notifications stacking up. The spec called for "multi-select view" — pick all the cards you want, then commit once.
- **Fix:**
  1. Add a `Set<string>` of selected `instanceId`s to local state in the picker.
  2. On card tap, toggle membership in the set instead of calling `addToDeck` immediately.
  3. Show a checkmark badge on selected cards (top-right corner of the card thumbnail).
  4. Show a sticky bottom bar with "Add N cards" button that fires when tapped, loops through the set, calls `addToDeck` for each, and closes the sheet with a single toast: "Added N cards to {deckName}".
  5. Bonus: visually mark cards already in the deck with a muted overlay and an "Already in deck" badge, fed by `selectedDeck.cards.map(c => c.card.id)`. Cards already added shouldn't be selectable again unless the user explicitly enables an "allow duplicates" toggle (legitimate for cards like basic lands).

### 3.4 Offline scans are rejected, not queued
- **Severity:** Low
- **Where:** `src/components/Scanner.tsx`, `src/services/gemini.ts`
- **Problem:** Spec for 4.3 called for queuing scans in IndexedDB when offline. Implementation only blocks scans with a toast. Reasonable in practice — without network, Gemini can't run anyway, so queueing the *image* doesn't help unless we also defer the AI call. Fully implementing the queue means storing the JPEG blob in IndexedDB, listening for `online` events, replaying the queue, and surfacing the results in some kind of "pending scans" UI.
- **Fix (optional, only if user feedback warrants it):** Add an IndexedDB-backed queue. Use the `idb` library or vanilla `indexedDB.open`. On capture while offline, store `{ id, image: blob, timestamp }` instead of the early-return. On `online` event, drain the queue: for each entry, run the existing identify → Scryfall → save pipeline and surface a summary toast ("3 queued scans saved"). Out of scope unless real users complain about losing scans on the train.

### 3.5 Viewport zoom-prevention works by accident
- **Severity:** Low
- **Where:** `index.html`, `src/index.css`
- **Problem:** iOS Safari auto-zooms when an input with font-size <16px is focused. The app currently avoids this because all text inputs use Tailwind's `text-base` (16px). But this is implicit — anyone adding a `text-sm` (14px) input will reintroduce the bug.
- **Fix:** Add a defensive rule to `src/index.css`:
  ```css
  @layer base {
    input, select, textarea {
      font-size: max(16px, 1rem);
    }
  }
  ```
  This pins the minimum to 16px on iOS but lets desktop browsers honor any larger value.

### 3.6 Tab transitions use browser default cross-fade
- **Severity:** Low
- **Where:** `src/App.tsx`, `src/index.css`
- **Problem:** `document.startViewTransition` is wired up, but no `::view-transition-*` CSS customizations exist, so transitions use the browser default cross-fade. Doesn't feel directional like a real native tab swap. The `motion` library is in `package.json` but unused.
- **Fix:** Add CSS for directional slide transitions. Tag each tab view with a `view-transition-name`, then animate them:
  ```css
  ::view-transition-old(scanner-view),
  ::view-transition-new(scanner-view) {
    animation-duration: 250ms;
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
  ::view-transition-old(scanner-view) {
    animation-name: slide-out-right;
  }
  ::view-transition-new(scanner-view) {
    animation-name: slide-in-left;
  }
  /* etc. for each tab */
  ```
  Alternative: drop the unused `motion` dependency to slim the bundle if directional transitions aren't pursued.

### 3.7 "Wrong card?" search uses heavy endpoint
- **Severity:** Low
- **Where:** `src/components/ScanConfirmDialog.tsx`
- **Problem:** Spec for 6.2 mentioned Scryfall's autocomplete API specifically (designed for typeahead, returns lightweight name strings). Implementation uses the full `cards/search` endpoint, which is slower and returns full card objects. Functionally it works, but on slow connections the typeahead feels laggy.
- **Fix:** Use a two-stage approach:
  1. As the user types (debounced 200ms), call `https://api.scryfall.com/cards/autocomplete?q=...` — returns up to 20 lightweight name strings.
  2. When the user picks a name, call `https://api.scryfall.com/cards/named?exact={name}` to fetch the full card.
  Reduces latency and API load.

---

## Suggested rollout

Phase 1 should ship as a single PR — these are bugs, not features. Phase 2 should be a follow-up PR within the same week, paired with enabling `strict: true` so future regressions are caught at compile time. Phase 3 items can be picked up individually based on user feedback; 3.1 and 3.3 are the most impactful for the actual use cases (binder cataloging and deck building) and should be prioritized over the polish items.

| Phase | Title | Items | Effort | Risk if skipped |
|-------|-------|-------|--------|-----------------|
| 1 | Ship blockers | 3 | M | Users hit broken flows |
| 2 | Type-system debt | 4 | S | Future regressions |
| 3 | Spec gaps | 7 | L | Original UX intent unmet |

**Total: 14 corrections.** All are well-scoped, file-level changes — no architectural rewrites required.