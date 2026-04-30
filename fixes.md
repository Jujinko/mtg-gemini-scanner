# MTG Scanner — Mobile UX Improvement Batches

A sequenced, ship-one-at-a-time plan covering all 27 mobile UX issues from the audit. Batches are ordered by ROI (impact ÷ effort) and grouped so each one can be merged independently without breaking anything else. Every item retains its full description, severity, and proposed fix from the audit.

---

## Batch 1 — Touch target fixes (the "make it work on touch" pass)

**Why first:** These are bugs, not enhancements. The app currently has interactions that are literally invisible or inaccessible to touch users. One short PR fixes the most embarrassing issues.

### 1.1 Hover-only trash buttons on collection cards
- **Severity:** Critical
- **Where:** `Collection.tsx` (card grid), `Decks.tsx` (deck list cards)
- **Problem:** The remove button uses `opacity-0 group-hover:opacity-100`. On touch devices, there is no hover. The button only becomes visible on hover, which means on mobile it's either invisible or always-shown depending on browser. Touch users either can't find it or have it stuck on. Same issue applies to the deck delete button on the deck list cards.
- **Fix:** Use a long-press to enter "edit mode" (iOS pattern) or always show the button at reduced opacity on touch devices via `@media (hover: none)`. Better: swipe-left-to-reveal trash (native iOS list pattern).

### 1.2 Card removal has no confirmation, no undo
- **Severity:** High
- **Where:** `Collection.tsx`, `Decks.tsx`
- **Problem:** Tap trash → card is gone forever. No "Are you sure?", no undo toast (the toast just says "Removed X"). On a touch device with tightly packed cards, accidental taps are inevitable.
- **Fix:** Add an "Undo" button to the toast. Keep the removed card in a 5-second buffer before final deletion.

### 1.3 `window.confirm()` for deck deletion
- **Severity:** High
- **Where:** `Decks.tsx`
- **Problem:** Native `window.confirm` is jarring on mobile — it's a top-of-screen system dialog that completely breaks the visual language of the app. On some PWAs/Cloud Run configs it's even blocked.
- **Fix:** Use the same in-app modal pattern as `ScanConfirmDialog`. Bonus: explain consequences ("This will delete X cards from this deck. The cards will remain in your collection.").

### 1.4 Search input doesn't trigger search-style keyboard
- **Severity:** Medium
- **Where:** `Collection.tsx`
- **Problem:** The search uses a generic `text` type, which on iOS surfaces the alphabet keyboard. `inputMode` and `autocomplete` attributes are absent; `type="search"` isn't used so there's no clear-X button on iOS.
- **Fix:** `type="search"` with `enterKeyHint="search"` and `autoCapitalize="none"`. Adds the iOS clear button automatically.

### 1.5 Deck name input lacks autofocus and accessible label
- **Severity:** Medium
- **Where:** `Decks.tsx`
- **Problem:** The form does submit on Enter (form `onSubmit` is wired up), but the `autoFocus` is missing on the input, and the submit button doesn't show a clear "Add" or "Create" affordance — it's just a Plus icon. Screen readers can't tell what it does.
- **Fix:** Add `autoFocus` when the input becomes visible (or on a "+ New deck" tap). `aria-label="Create deck"` on the submit button. `enterKeyHint="done"` on the input.

---

## Batch 2 — PWA fundamentals (the "make it installable" pass)

**Why next:** A camera-based scanner is the textbook PWA use case. Until this lands, every session starts with "open Safari, type/find URL, accept camera prompt again". Three of the four items here are pure plumbing — fast to implement.

### 2.1 No PWA manifest — can't be added to home screen
- **Severity:** Critical
- **Where:** Repo root, `index.html`
- **Problem:** A camera-based scanner is the textbook PWA use case, but there's no `manifest.json`, no service worker, no theme color, no `apple-touch-icon`. Users have to open Safari/Chrome and navigate to the URL every single time. The page title is even still "My Google AI Studio App".
- **Fix:** Add `manifest.json` with `display: standalone`, proper icons, theme color `#09090B` (zinc-950). Add `apple-touch-icon` and `apple-mobile-web-app-capable` meta tags.

### 2.2 No status bar styling
- **Severity:** Low
- **Where:** `index.html`
- **Problem:** In standalone PWA mode, iOS would use a default white status bar over the zinc-950 background — illegible. `apple-mobile-web-app-status-bar-style` is missing.
- **Fix:** Add `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">` once the PWA manifest exists.

### 2.3 Viewport meta tag missing zoom-prevention strategy
- **Severity:** Medium
- **Where:** `index.html`
- **Problem:** The current viewport meta is `width=device-width, initial-scale=1.0` only. On iOS, when a user taps an input that has font-size below 16px, Safari auto-zooms in. Several inputs use `text-zinc-100` with no explicit font-size beyond Tailwind's default `text-base` — but the textareas and selects don't.
- **Fix:** Either add `maximum-scale=1, user-scalable=no` (controversial — hurts accessibility), OR ensure all inputs have `font-size: 16px` minimum (the right answer).

### 2.4 Pull-to-refresh hijacks the page
- **Severity:** Low
- **Where:** Global CSS / scrollable containers in each view
- **Problem:** No `overscroll-behavior: contain` on the scrollable areas. On Chrome Android, pulling down at the top of the collection triggers the browser's reload, not anything app-specific.
- **Fix:** `overscroll-behavior-y: contain` on the main scroll containers. Optionally implement actual pull-to-refresh that re-fetches Scryfall prices.

---

## Batch 3 — Bottom nav & safe area (the "stop fighting the OS chrome" pass)

**Why next:** All these issues compound — the nav is too small, too close to the home indicator, and conflicts with the toast and the shutter. Fixing them together is cheaper than separately because you'll be touching the same layout math repeatedly.

### 3.1 Bottom nav labels are 9px — below WCAG and platform minimums
- **Severity:** High
- **Where:** `App.tsx` (bottom nav)
- **Problem:** `text-[9px] uppercase font-bold tracking-tighter` for COLLECTION / SCAN / DECKS. iOS Human Interface Guidelines specify 11pt minimum for tab labels. 9px tracking-tighter is genuinely hard to read for users over 40 or with any visual impairment.
- **Fix:** 11px minimum, normal tracking. The nav has plenty of space — 90% width × max-w-sm gives ~344px for 3 labels.

### 3.2 Floating bottom nav is not safe-area-aware
- **Severity:** High
- **Where:** `App.tsx`
- **Problem:** `App.tsx` uses `bottom-6` (24px) and `pb-safe`, but `pb-safe` is set on the wrapper, not the nav itself. On iPhones with home indicators, the nav can sit too close to the bottom gesture bar — users will swipe up to "go home" while trying to tap the nav, or vice versa.
- **Fix:** Move `pb-safe` directly onto the nav element. Increase bottom offset to `bottom-8` or use `calc(24px + env(safe-area-inset-bottom))`.

### 3.3 Toasts position conflicts with the bottom nav and shutter
- **Severity:** High
- **Where:** `ToastProvider.tsx`
- **Problem:** Toasts appear at `bottom-24` (96px from bottom). The bottom nav is at `bottom-6` (24px) and is ~64px tall. So toasts appear above the nav (good), but during a scan, the scanner's overlay controls (capture button) are at `bottom-24` too — exact same position. The toast can occlude the capture button mid-scan.
- **Fix:** Detect active tab and position toasts higher in scanner mode, or always position toasts at the top of the screen on the scanner tab.

### 3.4 Capture button blocks bottom nav with overlap risk
- **Severity:** Critical
- **Where:** `Scanner.tsx`
- **Problem:** The shutter sits at `bottom-24` (96px from bottom) and the floating tab bar is at `bottom-6` (24px from bottom) with its own height. On smaller phones (iPhone SE, ~568pt height), the 80–96px shutter and the 56px nav stack within ~120px of each other — close enough that thumbs hit the wrong target. There's no haptic separation either.
- **Fix:** Either hide the bottom nav while in scanner mode, or move the shutter up further. iOS standard puts shutter at ~140px above safe area in camera apps.

---

## Batch 4 — Scanner reliability (the "stop the camera from breaking" pass)

**Why next:** These are the failure modes that turn a successful identification into a dead end. Critical to fix before investing in the higher-effort scanner UX work in Batch 5.

### 4.1 No camera permission denied state
- **Severity:** Critical
- **Where:** `Scanner.tsx`
- **Problem:** `react-webcam` silently fails if the user denies permission — they see a black screen with no explanation, no "open settings" guidance, and no retry button. First-time users on iOS Safari are likely to deny by accident.
- **Fix:** Use the `onUserMediaError` callback. Show an explicit empty state with the OS-specific path to enable camera access ("Settings → Safari → Camera").

### 4.2 Capture aspect ratio is fixed at 3:4
- **Severity:** High
- **Where:** `Scanner.tsx`
- **Problem:** `videoConstraints` hard-codes `aspectRatio: 3/4`. On older Android phones and some browsers this constraint is rejected, falling back to the default (often 4:3 or 16:9), which means the focal frame guide doesn't match the captured frame — users have a card "in" the green frame but cropped out of the actual screenshot.
- **Fix:** Don't constrain aspect ratio. Crop client-side to the focal frame's dimensions before sending to Gemini. This also reduces upload size.

### 4.3 No offline state — silently fails when offline
- **Severity:** Medium
- **Where:** `Scanner.tsx`, `services/gemini.ts`, `services/scryfall.ts`
- **Problem:** Scryfall calls and Gemini calls both fail with generic "An unexpected error occurred". On the subway with spotty connection, users get cryptic errors instead of "You're offline — your scan is queued".
- **Fix:** Listen to `navigator.onLine`. Queue scans in IndexedDB when offline. Show a persistent "Offline" badge.

---

## Batch 5 — Scanner UX upgrade (the "feel like a real camera app" pass)

**Why next:** With the scanner stable from Batch 4, this batch transforms it from "barely usable" to "a tool you actually want to use". The continuous scan mode in particular is the single biggest unlock for the real use case.

### 5.1 No torch / flashlight control
- **Severity:** Critical
- **Where:** `Scanner.tsx`
- **Problem:** MTG cards are glossy and reflective. Indoor lighting often produces glare, shadows, or low contrast that breaks Gemini identification. There is no torch toggle, no exposure compensation, no tap-to-focus.
- **Fix:** Use the `MediaTrack getCapabilities` API to expose torch when supported. Add a tap-to-focus listener on the video element that calls `applyConstraints` with `focusDistance`.

### 5.2 No haptic feedback on capture
- **Severity:** High
- **Where:** `Scanner.tsx`, `ToastProvider.tsx`
- **Problem:** The shutter has no `navigator.vibrate()`. Real camera apps give a tactile thunk on capture — its absence makes the app feel unresponsive especially when Gemini takes 2–4 seconds and the only feedback is a small spinner.
- **Fix:** `navigator.vibrate(15)` on capture; `navigator.vibrate([10,30,10])` on successful match; `navigator.vibrate([50,50,50])` on error.

### 5.3 No batch / continuous scan mode
- **Severity:** High
- **Where:** `Scanner.tsx`, `ScanConfirmDialog.tsx`
- **Problem:** Scanning a binder of 100+ cards means 100+ taps through the confirm dialog. There's no "rapid mode" where matches auto-confirm and the camera stays live. **This is the #1 friction point for the actual use case.**
- **Fix:** Add a toggle that auto-saves matches above a confidence threshold and shows an undo toast. Keep camera active between scans.

### 5.4 Switch-camera button is asymmetric / unbalanced
- **Severity:** Medium
- **Where:** `Scanner.tsx`
- **Problem:** The shutter row uses a switch-camera button on the left and an empty 12×12 spacer on the right "for centering alignment". This visually unbalanced layout violates standard camera UI conventions where the right slot typically holds gallery/last-shot or settings.
- **Fix:** Use the right slot for a "scan history" peek (last 3 scans) or torch toggle. Don't waste valuable thumb-zone real estate.

---

## Batch 6 — Scan confirm dialog overhaul

**Why next:** The dialog is on the critical path of every successful scan. These four fixes together turn it from a mandatory speed bump into a smooth confirmation step.

### 6.1 Native select dropdown for deck destination
- **Severity:** Critical
- **Where:** `ScanConfirmDialog.tsx`
- **Problem:** The Save Destination uses a native `<select>`, which on iOS opens the system picker wheel — a heavy modal that obscures the card preview. With many decks it becomes a tiny scroll list. Worse: there's no "Create new deck" option inside the picker, forcing users to bail out of scanning to create a deck first.
- **Fix:** Custom bottom sheet picker with deck thumbnails, search, and a "+ New deck" option inline.

### 6.2 No "Wrong card?" / re-scan affordance
- **Severity:** High
- **Where:** `ScanConfirmDialog.tsx`
- **Problem:** If Gemini misidentifies a card (very common on alt-art, foreign-language, or worn cards), the only recourse is Discard → restart the scan. There's no "search for a different card", no manual override, no "did you mean...?" alternative matches from Scryfall.
- **Fix:** Add a small "Not the right card?" link that opens a search input below the preview. Use Scryfall's autocomplete API.

### 6.3 No quantity selector at save time
- **Severity:** Medium
- **Where:** `ScanConfirmDialog.tsx`
- **Problem:** If you just opened a booster pack and got 3 of the same common, you scan the same card 3 times. A "+ Qty: 1 –" stepper at save time would 3× the throughput on bulk additions.
- **Fix:** Add a stepper next to the save destination. Default 1, allow 1–99.

### 6.4 Discard / Save buttons not weighted by safety
- **Severity:** Medium
- **Where:** `ScanConfirmDialog.tsx`
- **Problem:** Save is the green primary CTA on the right; Discard is a smaller secondary on the left. iOS convention is destructive-on-left (✓), but Discard isn't actually destructive here — it just closes the dialog without saving. The visual weight is correct, but Discard is the wrong word — it implies the scan data is lost forever, when actually the user might just want to "cancel" and try again.
- **Fix:** Rename "Discard" to "Cancel". Reserve "Discard" for actual destructive actions.

### 6.5 Modal uses items-end on mobile but no drag-to-dismiss
- **Severity:** Low
- **Where:** `ScanConfirmDialog.tsx`
- **Problem:** The dialog snaps to the bottom on mobile (good — bottom sheet pattern), but doesn't have the expected drag handle or swipe-down-to-dismiss gesture that users now expect from bottom sheets.
- **Fix:** Add a drag handle and use a library like `vaul` or `react-spring` for the swipe gesture.

---

## Batch 7 — Collection browsing improvements

**Why next:** Now that the scan loop works well, collections will grow large fast. Browsing them needs to scale.

### 7.1 2-column grid wastes mobile real estate for browsing
- **Severity:** High
- **Where:** `Collection.tsx`
- **Problem:** On a 390px-wide phone, 2 columns means each card is ~180px wide — too small to read text at the bottom (set name truncates to "Theros Beyond Death..."), but too big to scan a 200-card collection. There's no list view toggle, no compact view, no way to see more cards at once.
- **Fix:** Add a view toggle: grid (current), compact list (image thumb + name + price), text-only checklist.

### 7.2 Cards in collection are not tappable
- **Severity:** Medium
- **Where:** `Collection.tsx`
- **Problem:** Tapping a card image does nothing. There's no detail view, no full-size image, no oracle text. The only interactions are "remove" and "look at it". For a collection app, this is a major dead-end — users can't do anything productive once a card is in their collection.
- **Fix:** Tap → bottom sheet with full Scryfall data: oracle text, prices across printings, format legalities, similar cards.

### 7.3 No loading skeletons — only spinners or empty states
- **Severity:** High
- **Where:** `Collection.tsx`, `Decks.tsx` (deck detail card list)
- **Problem:** When the collection is large, the grid renders all images at once with `loading="lazy"`. On slow networks the grid jumps as images pop in. No skeleton placeholders, no aspect-ratio reservation issues (those are handled), but the perceptual flicker is significant.
- **Fix:** Show a zinc-800 skeleton with the card aspect ratio while the image loads. Use IntersectionObserver for true lazy-load.

### 7.4 Scroll position not preserved between tab switches
- **Severity:** Low
- **Where:** `App.tsx`
- **Problem:** Switch from Collection to Scanner and back, and the collection scrolls back to top. Component unmounts because of conditional rendering in `App.tsx`.
- **Fix:** Hide tabs with `display: none` instead of unmounting, or persist scroll position in the store.

---

## Batch 8 — Decks workflow improvements

**Why next:** Decks are the second-class citizen in this app. These changes make deck building viable, especially the "add from collection" flow which is currently impossible.

### 8.1 No way to add cards to a deck from existing collection
- **Severity:** High
- **Where:** `Decks.tsx`, `collectionStore.ts`
- **Problem:** Decks can only be filled by scanning. If a user already has a collection and wants to build a deck from it, they have to re-scan every card. There's no "Add from collection" button on the deck detail screen.
- **Fix:** Add a "+" button on the deck detail screen that opens a multi-select view of the collection.

### 8.2 Deck name truncates aggressively at max-w-[150px]
- **Severity:** Medium
- **Where:** `Decks.tsx`
- **Problem:** In the deck detail header, the deck name truncates at 150px on mobile. "Modern Yawgmoth Combo Edition" becomes "Modern Yawgmot...". This is a header — there's room to wrap to two lines or scroll horizontally.
- **Fix:** Use a 2-line clamp instead of single-line truncation, or shrink the header font to fit.

### 8.3 Deck preview "fan" overlaps -ml-6 — only first card visible at small sizes
- **Severity:** Low
- **Where:** `Decks.tsx`
- **Problem:** The fan preview uses `-ml-6` between 64px-wide cards, meaning each card only reveals ~16px of the next. On small screens this collapses to "you can see one card and a bunch of slivers" — not a useful preview.
- **Fix:** Use `-ml-3` (less aggressive overlap), or rotate cards slightly for a true fan effect like a hand of cards.

### 8.4 No keyboard avoidance on the deck creation form
- **Severity:** Low
- **Where:** `Decks.tsx`
- **Problem:** When the iOS keyboard appears, the form doesn't scroll into view. The user can be typing into an input that's hidden behind the keyboard.
- **Fix:** `scrollIntoView` on focus, or use the new VirtualKeyboard API where supported.

---

## Batch 9 — Polish (the "feels native" pass)

**Why last:** None of these block any other work. They're the difference between "competent web app" and "feels like an iOS app".

### 9.1 Tab switch is a hard cut — no transition
- **Severity:** Medium
- **Where:** `App.tsx`
- **Problem:** `activeTab === 'X'` renders the entire view via conditional. There's no slide animation, no fade. On mobile this feels janky compared to native tab transitions. The `motion` library is already a dependency — it's unused.
- **Fix:** Wrap tab content in `motion.div` with an exit animation. Or use CSS view transitions API for a near-native feel.

### 9.2 Export dialog uses a button-with-icon but no Web Share API
- **Severity:** Low
- **Where:** `ExportDialog.tsx`
- **Problem:** Mobile users often want to share the deck list to Discord, Notes, or Messages. Clipboard works, but Web Share API would be more natural — "Share to..." gives the OS share sheet.
- **Fix:** Add a third option using `navigator.share({ text: deckList, title: deckName })`.

---

## Suggested rollout sequence

| Batch | Title | Issues | Effort | Impact |
|-------|-------|--------|--------|--------|
| 1 | Touch target fixes | 5 | S | Critical |
| 2 | PWA fundamentals | 4 | S | High |
| 3 | Bottom nav & safe area | 4 | S | High |
| 4 | Scanner reliability | 3 | M | High |
| 5 | Scanner UX upgrade | 4 | L | Critical |
| 6 | Scan confirm dialog overhaul | 5 | M | High |
| 7 | Collection browsing | 4 | M | Medium |
| 8 | Decks workflow | 4 | M | Medium |
| 9 | Polish | 2 | S | Low |

**Total: 35 distinct fixes across 9 shippable batches.** (Some original audit items got split when they hit multiple files; e.g. trash button fix needs touching both `Collection.tsx` and `Decks.tsx`.)

Each batch is designed to merge independently — no batch depends on a later batch landing first. Within a batch, items can usually be done in any order, with the exception of Batch 2 (the manifest must land before the status bar style does anything).