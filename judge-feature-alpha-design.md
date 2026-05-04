# AI Judge — Closed Alpha POC Design

A deliberately minimal version of the AI Judge feature that ships entirely through AI Studio Build, reuses the existing client-side Gemini pattern, and **takes specific named shortcuts** to keep scope tight. This is not the production architecture — it is the smallest thing that proves the feature is worth building, plays nice with the existing app, and can be put in front of 10–50 trusted users in 2–3 weeks of focused work.

The previous plan answered "how do we build this right?" This document answers "how do we build the smallest version that lets us learn whether to build it right?"

---

## 1. What this POC is and isn't

### What it IS

- A new "Ask Judge" entry point on existing card detail screens
- A bottom-sheet chat surface where users ask MTG rules questions about 1–3 cards
- A single-call Gemini Pro pipeline that returns a TL;DR + reasoning + citations
- A built-in feedback widget (👍 / 👎 + free text) that writes to a Firestore collection
- An invite-only flag gate so only ~50 testers see it
- Shipped through AI Studio Build, deployed alongside the current app, with **no new backend services**

### What it ISN'T

- Production-ready, secure, or cost-controlled
- A full RAG system with the Comprehensive Rules
- A multi-card stack visualizer
- Available to the public
- Built to pass the eval harness from the production plan
- Long-lived: the explicit assumption is that the alpha runs for 4–8 weeks, then either advances to the production architecture or is killed

The POC's job is to learn three things:
1. **Demand:** Do users actually use it? (Telemetry: % of card detail opens that tap "Ask Judge")
2. **Quality bar:** What % of rulings do testers rate as "correct" or "useful"? (Telemetry: thumbs ratings)
3. **Failure modes:** Where does the simple pipeline obviously break? (Telemetry: thumbs-down comments)

If those three answers don't justify the production plan's effort, we kill the feature and have spent 2 weeks instead of 6 months learning that.

---

## 2. Shortcuts — taken deliberately and named

These are the trade-offs the POC makes vs. the production plan. Each one is consciously accepted with an exit plan if the alpha graduates.

| # | Production says | Alpha does | Cost of shortcut | Exit when |
|---|-----------------|------------|------------------|-----------|
| 1 | Server-side Gemini calls | Client-side, same as current scanner | API key keeps leaking; alpha-key burn risk | Production Phase 0.2 |
| 2 | Vector DB with full CR corpus | No corpus — model uses training-data rules + Scryfall context | Hallucinations more likely; no rule-existence validation | Production Phase 2 |
| 3 | 7-stage pipeline | 1 call to Gemini 2.5 Pro | Higher per-query cost; longer single timeout; no refusal-on-low-confidence | Production Phase 2 |
| 4 | Firebase Auth + rate limits | No auth; localStorage device-ID; client-side daily count | A motivated user can blow through quotas | Production Phase 0.3 |
| 5 | BigQuery telemetry pipeline | Firestore collection, manually queried | No SQL aggregation; manual review | Production Phase 0.6 |
| 6 | Validation layer (Stage 6) | Loose JSON schema check only | Hallucinated rule numbers can ship to user | Production Phase 2 |
| 7 | State elicitation matrix | Free-text input + 3 hardcoded "context chips" | Worse rulings on board-state questions | Production Phase 2 |
| 8 | Continuous eval harness | 30 hand-tested questions in a markdown file, run manually | Quality regressions only caught by user reports | Production Phase 0.6 |
| 9 | CR ingestion CI/CD | Skipped — no corpus | n/a | Production Phase 0.5 |
| 10 | Tournament-mode disclaimer | Static text disclaimer | n/a | Acceptable — disclaimer covers it |

The biggest risk these shortcuts create together is **a confidently wrong ruling shown to a tester who tells their playgroup the app is bad.** Mitigation: closed alpha with explicit framing — "this is an experiment, please rate every answer, we are looking for failure cases."

---

## 3. Architecture — what actually ships

```
┌─────────────────────────────────────────────────────────────┐
│  Existing SPA (AI Studio Build → Cloud Run)                 │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  New components                                       │  │
│  │  • src/components/JudgeSheet.tsx  (bottom sheet UI)   │  │
│  │  • src/components/JudgeRuling.tsx (renders response)  │  │
│  │  • src/services/judge.ts          (Gemini call)       │  │
│  │  • src/services/judgeFeedback.ts  (Firestore writes)  │  │
│  │  • src/lib/judgeFlag.ts           (invite gate)       │  │
│  │  • src/store/judgeQuotaStore.ts   (client rate limit) │  │
│  └───────────────────────────────────────────────────────┘  │
│                          │                                  │
│         ┌────────────────┼─────────────────┐                │
│         ▼                ▼                 ▼                │
│  ┌────────────┐   ┌────────────┐   ┌────────────────────┐   │
│  │ Gemini API │   │ Scryfall   │   │ Firestore (web SDK)│   │
│  │ direct     │   │ rulings    │   │ feedback writes    │   │
│  │ (leaks key)│   │ endpoint   │   │ anon, rules-locked │   │
│  └────────────┘   └────────────┘   └────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Three external dependencies, all called directly from the browser:**

1. **Gemini API** — same `@google/genai` client the scanner already uses. Same key, same key-leak. New model (`gemini-2.5-pro`).
2. **Scryfall `/cards/{id}/rulings`** — public endpoint, no auth.
3. **Firestore (web SDK)** — for feedback storage. Configured with security rules that allow append-only writes from an anon Firebase Auth user, no reads from clients.

No backend service. No deploy beyond AI Studio Build's existing pipeline. No DNS changes. No new IAM roles beyond the Firebase project setup (one-time, ~30 min).

---

## 4. The pipeline (single call)

This is intentionally simpler than the production 7-stage pipeline. One Gemini Pro call, one validation pass, one render.

```
[ User question + 1–3 card IDs + free-text context ]
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│ STEP 1: Fetch Scryfall rulings                         │
│ ──────────────────────────────                         │
│ For each card_id, call /cards/{id} (cached 1h locally) │
│ Get: oracle_text, name, type_line, rulings[]           │
│ Time: ~300ms parallel                                  │
└────────────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│ STEP 2: Build prompt                                   │
│ ──────────────────────────                             │
│ Stuff EVERYTHING into one prompt:                      │
│  - System prompt with refusal rules                    │
│  - All cards' oracle text                              │
│  - All cards' Scryfall rulings (no truncation)         │
│  - User's free-text context                            │
│  - Quick-tap chips selected (Phase, Active player)     │
│  - User's question                                     │
│ Token count: 2k–8k input depending on cards            │
└────────────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│ STEP 3: Call Gemini 2.5 Pro                            │
│ ──────────────────────                                 │
│ - structured JSON output via responseMimeType          │
│ - temperature 0.1 for consistency                      │
│ - 6s timeout (fall through to "try again" UI on hit)   │
│ Time: 3–5s typical, 8s p95                             │
└────────────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│ STEP 4: Loose validation                               │
│ ─────────────────────                                  │
│ - JSON shape matches expected schema (zod)             │
│ - tldr present and ≤300 chars                          │
│ - At least 1 citation OR insufficient=true             │
│ - NO existence check on rule numbers (shortcut #6)     │
│ - On invalid: render generic error + log to Firestore  │
└────────────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│ STEP 5: Render + log                                   │
│ ──────────────────                                     │
│ - TL;DR rendered as bold lead                          │
│ - Reasoning steps in expandable section                │
│ - Citations rendered as quoted blocks (rules quoted    │
│   from the model — not validated against a corpus)     │
│ - Sticky disclaimer banner                             │
│ - Thumbs widget below ruling                           │
│ - Trace logged to Firestore /judgeRulings/{id}         │
└────────────────────────────────────────────────────────┘
```

Total latency: 3–6 seconds typical, 8s p95. Slower than the production 7-stage pipeline's P50 (because we're using the heavier model for everything instead of routing) but acceptable for an alpha.

### The single prompt

Stored at `src/prompts/judge-alpha.ts`, loaded at runtime, version-tagged in telemetry. The deliberate design choice is **context bloat is OK** — we paste full Scryfall rulings without summarization, accept the 2k–8k input tokens per query, and let the model sort it out.

```
You are an MTG rules adjudicator helping a player resolve a question.

CRITICAL CONSTRAINTS:
1. Use ONLY the card oracle text and Scryfall rulings provided below.
   You may use your training knowledge of the Comprehensive Rules to
   reason about how those rulings interact, but DO NOT cite specific
   rule numbers (like "702.2b") unless you are confident they are
   correct as of the latest CR.
2. If you cannot answer confidently, set insufficient=true. Do not guess.
3. If the question is about cards or interactions not represented in
   the data below, set insufficient=true.
4. Rulings printed before 2020 may have been superseded by later CR
   changes. Prefer the most recent ruling when they conflict.
5. End every answer with this disclaimer: "This is an unofficial AI
   ruling. For tournaments, call a real judge."

OUTPUT (strict JSON):
{
  "tldr": "1–2 sentences, plain language",
  "steps": [
    {"ordinal": 1, "description": "...", "rule_ref": "702.2b" | null}
  ],
  "citations": [
    {"type": "ruling" | "oracle", "card": "Card Name",
     "text": "the quoted ruling or oracle line"}
  ],
  "insufficient": false,
  "model_confidence": 0.0-1.0,
  "disclaimer": "This is an unofficial AI ruling..."
}

CARDS IN PLAY:
[Card 1: Yarok, the Desecrated]
Oracle text: If a permanent entering the battlefield causes a triggered
ability of a permanent you control to trigger, that ability triggers
an additional time.
Rulings:
- 2019-08-23: Yarok's effect doubles enter-the-battlefield triggered
  abilities of permanents you control.
- 2019-08-23: Yarok's ability triggers itself on entry — only once...
[...]

[Card 2: Panharmonicon]
Oracle text: ...
Rulings: ...

USER CONTEXT:
- Active player: me
- Turn phase: main
- Free text: "Both Yarok and Panharmonicon are on the battlefield.
  I cast Mulldrifter for its evoke cost. How many cards do I draw?"

Return only the JSON. No markdown fences.
```

The prompt is intentionally permissive about citing rule numbers — the alpha **doesn't validate them** against a corpus, so we ask the model to be conservative. This is a known shortcut that will be addressed in production via Stage 6 validation.

---

## 5. Frontend integration (the bulk of the work)

### 5.1 New components

**`src/components/JudgeSheet.tsx`** — the entry-point bottom sheet. Reuses the existing `vaul` Drawer pattern from `ScanConfirmDialog.tsx`. Three states:

- **Compose:** card chips at top, free-text input, quick-tap context chips ("My turn / Their turn", "Main / Combat / End step"), Ask button
- **Loading:** skeleton with the question echoed back, spinner, "Reasoning..." text
- **Result:** renders `<JudgeRuling />` with the response, plus thumbs widget

**`src/components/JudgeRuling.tsx`** — renders the structured response. TL;DR in bold lead, expandable "Show reasoning" section with the steps array, citations as quoted card-name → text blocks, sticky disclaimer, thumbs widget.

**`src/components/JudgeFeedbackWidget.tsx`** — thumbs up / thumbs down + optional free-text "what's wrong?" input on thumbs-down. Fires `judgeFeedback.ts` writes.

**`src/services/judge.ts`** — mirrors `gemini.ts` exactly. Lazy-init the `GoogleGenAI` client, single `askJudge(cards, question, context)` function. Returns the parsed-and-validated `JudgeResponse` or throws.

**`src/services/judgeFeedback.ts`** — Firebase web SDK calls. Two functions: `logRuling(traceId, request, response)` writes the full trace, `logFeedback(traceId, rating, comment)` updates with user feedback.

**`src/lib/judgeFlag.ts`** — checks if the current user is in the alpha cohort. Implementation: hardcoded list of opaque tokens, set in localStorage by the user pasting an invite code into a settings screen. See section 6.

**`src/store/judgeQuotaStore.ts`** — Zustand store with persist. Tracks `{ usedToday: number, dayKey: string }`. Reset at midnight. Hard cap: 20 queries per device per day.

### 5.2 Entry points

**Card detail bottom sheet** (existing, in `Collection.tsx`): adds an "Ask Judge" button next to "View on Scryfall". Opens `<JudgeSheet />` pre-loaded with the current card.

**Scanner tab:** new "Judge mode" toggle, third position next to existing Continuous mode. When active, scanned cards pin to a tray at the bottom (max 3) instead of opening the save dialog. Tapping "Ask" on the tray opens `<JudgeSheet />` with all tray cards.

That's it. **Two entry points.** No new tab, no new global navigation, no settings UI beyond the invite-code paste field.

### 5.3 The invite gate

```typescript
// src/lib/judgeFlag.ts
const ALPHA_TOKENS = new Set([
  // 50 random tokens generated once and distributed manually
  'arcane-judge-7k2m',
  'arcane-judge-9p4q',
  // ...
]);

export function isJudgeEnabled(): boolean {
  const token = localStorage.getItem('mtg-judge-alpha-token');
  return token !== null && ALPHA_TOKENS.has(token);
}

export function setAlphaToken(token: string): boolean {
  if (ALPHA_TOKENS.has(token)) {
    localStorage.setItem('mtg-judge-alpha-token', token);
    return true;
  }
  return false;
}
```

A new "Settings" screen (or just a hidden gesture — long-press the app title) reveals an "Alpha access code" input. Type a valid code, the Judge UI unlocks for that device. Tokens are bundled in the JS — anyone reading the source code can find them and bypass the gate. **This is fine.** The gate is a friction signal, not a security boundary. We expect a couple of curious devs to find it; the cohort is small enough that we'd notice anomalies in feedback volume.

If someone shares a token outside the alpha, we revoke it by removing it from the array in the next deploy. Cost: re-deploying the SPA (~2 minutes via AI Studio).

### 5.4 Quota enforcement (client-side)

```typescript
// src/store/judgeQuotaStore.ts
const DAILY_LIMIT = 20;

export const useJudgeQuotaStore = create<QuotaState>()(
  persist(
    (set, get) => ({
      usedToday: 0,
      dayKey: todayKey(),
      
      tryConsume: () => {
        const today = todayKey();
        const state = get();
        
        // Reset on new day
        if (state.dayKey !== today) {
          set({ usedToday: 1, dayKey: today });
          return true;
        }
        
        if (state.usedToday >= DAILY_LIMIT) return false;
        set({ usedToday: state.usedToday + 1 });
        return true;
      },
      
      remaining: () => Math.max(0, DAILY_LIMIT - get().usedToday),
    }),
    { name: 'judge-quota' }
  )
);
```

A motivated user can clear localStorage and reset their quota. We don't care — the closed alpha is 50 trusted testers, total traffic is small, and the budget alarm in GCP is the real backstop.

### 5.5 Frontend total scope estimate

- 4 new React components, ~600 lines total
- 2 new services, ~150 lines total
- 1 new store, ~50 lines
- ~10 lines of integration into existing Collection/Scanner components
- 1 new prompt file, ~50 lines

**Total: under 1,000 LoC of new code.** Achievable in 1–2 weeks of focused work.

---

## 6. Telemetry — Firestore-only

Since there's no backend, telemetry has to write directly from the browser. Firebase web SDK + a Firestore project with locked-down security rules.

### 6.1 Firestore schema

```
/judgeRulings/{rulingId}
  trace_id: string (uuid v4)
  device_id: string (random uuid stored in localStorage)
  alpha_token: string (the token the user is using)
  timestamp: timestamp
  
  request:
    card_ids: string[]
    question: string
    context: { active_player, phase, free_text }
    prompt_version: string
    model: string ("gemini-2.5-pro")
  
  response:
    tldr: string
    steps: array
    citations: array
    insufficient: bool
    model_confidence: number
  
  meta:
    latency_ms: number
    input_tokens: number
    output_tokens: number
    error: string | null
  
  feedback: (added later when user rates)
    rating: "up" | "down" | null
    comment: string | null
    rated_at: timestamp
```

**One collection, flat schema, every ruling is one document.** No relational joins, no subcollections. Aggregation is "open the Firestore console and filter."

For ad-hoc queries during the alpha, we export the collection to BigQuery via the official Firebase extension (one-click setup) — but only if we actually need SQL aggregation. For the first few weeks, scrolling the Firestore console is fine.

### 6.2 Security rules

```
match /judgeRulings/{rulingId} {
  allow create: if request.auth != null
                && request.auth.token.firebase.sign_in_provider == 'anonymous'
                && request.resource.data.alpha_token in [TOKEN_LIST]
                && request.resource.data.device_id is string;
  
  allow update: if request.auth != null
                && request.auth.uid == resource.data.device_id  // only feedback by same device
                && request.resource.data.diff(resource.data).affectedKeys()
                     .hasOnly(['feedback']);
  
  allow read: if false;  // only via admin SDK from console / BigQuery
  allow delete: if false;
}
```

The token list is duplicated in the security rules (it's not a secret). Updates are restricted to the `feedback` field by the original device. Reads are off — only admins via the Firebase console.

### 6.3 What we actually look at

A simple checklist run weekly during the alpha:

- **Volume:** total rulings/week, rulings/active user/week
- **Quality proxy:** thumbs-up rate, thumbs-down rate, % rated at all
- **Failure cases:** every thumbs-down comment, read by hand
- **Cost proxy:** total input + output tokens × Gemini Pro pricing
- **Insufficient rate:** % of rulings where `insufficient=true` (high = good refusal behavior; very high = pipeline is too conservative)
- **Latency:** p50, p95 from `latency_ms`

A 30-minute weekly review session by one engineer is enough. Findings are written to a shared doc and inform whether the production plan moves forward, what to adjust, or whether to kill the feature.

---

## 7. Cost envelope for the alpha

50 testers × ~10 queries/week (optimistic) = 500 queries/week.

| Component | Per query | Per week |
|-----------|-----------|----------|
| Gemini 2.5 Pro (single call, ~5k input + 800 output tokens) | ~$0.010 | $5 |
| Scryfall (free) | $0 | $0 |
| Firebase Auth (free at this volume) | $0 | $0 |
| Firestore writes (~1 doc/query, free tier 20k/day) | $0 | $0 |
| Cloud Run for SPA (existing) | n/a | $0 |

**Total alpha cost: under $30/month.** Easily expensable, no budget approval needed.

A motivated abuser bypassing the client quota can max out the daily Firestore free-tier write quota (20k writes/day) before doing any meaningful damage to Gemini spend, since each query writes exactly one document. Worst case they generate ~20k Pro queries/day = $200/day = $6k/month. **Set a GCP budget alert at $100/month** for the project. If it fires, kill the alpha and rotate the API key. This is the actual safety net for the leaked-key problem during the alpha.

---

## 8. Build & ship plan (3 sprints, ~3 weeks)

### Sprint 1 — Plumbing (4–5 days)

- Add Firebase to the project (`firebase` SDK, anonymous auth bootstrap)
- Create Firestore project, deploy security rules
- Generate 50 alpha tokens, wire `judgeFlag.ts`
- Add hidden settings entry for token paste
- Wire `judgeQuotaStore.ts`
- Stub `judge.ts` and `judgeFeedback.ts` services (no Gemini call yet, return dummy data)
- Set GCP budget alert at $100/month
- Manual smoke test: token unlocks UI, quota counts down

**Gate:** an engineer can open the alpha UI on their device, see the empty Judge sheet, and the feedback writer produces a Firestore doc.

### Sprint 2 — Pipeline (5–6 days)

- Implement `judge.ts` with the real Gemini Pro call
- Author the prompt (`src/prompts/judge-alpha.ts`)
- Build `<JudgeSheet />` compose state (cards, question input, context chips)
- Build loading state with skeleton
- Build `<JudgeRuling />` result rendering (TL;DR, expandable steps, citations, disclaimer)
- Wire entry points: Card detail "Ask Judge" button, Scanner Judge mode toggle
- Hand-test the 30-question eval set, log results to a markdown file

**Gate:** an engineer asks "Does Yarok double Panharmonicon ETB triggers?" and gets a sensible answer with citations in <8 seconds. Eval pass rate above 70% on standard tier (lenient — this is the alpha).

### Sprint 3 — Feedback loop & polish (3–4 days)

- Build `<JudgeFeedbackWidget />`
- Wire feedback to update the Firestore ruling doc
- Add the disclaimer banner above the input
- Add quota-exhausted state ("You've used 20/20 — try again tomorrow")
- Add network-error fallback ("Couldn't reach the judge — try again")
- Recruit 50 testers (Discord / Reddit MTG community / personal network)
- Distribute alpha tokens via DM
- Soft launch

**Gate:** 5 testers log in on day 1, generate ≥1 ruling each, leave at least 1 thumbs rating each.

### Post-launch (4–8 weeks)

- Weekly 30-minute review of telemetry
- Direct communication with testers (a Discord channel for the alpha)
- Decide at week 4: does the data justify production work?
  - Yes → start Phase 0 of the production plan
  - No → kill the feature, document learnings, redirect engineering to other priorities

---

## 9. What graduating to production looks like

If the alpha succeeds, the production plan in `mtg-judge-implementation-plan-v2.md` is what we build. The mapping from alpha to production:

| Alpha component | Production fate |
|-----------------|-----------------|
| `src/services/judge.ts` (client-side) | Deleted; replaced with `fetch('/api/judge')` |
| Gemini Pro single call | Stage 5 of the 7-stage pipeline |
| Single-prompt template | Stays as Stage 5 prompt; new prompts added for Stages 1, 4 |
| Free-text + 2 chips context | State elicitation matrix per intent |
| 50-token alpha gate | Replaced with Firebase Auth (real signup) |
| Firestore-only telemetry | Adds BigQuery streaming inserts |
| 30-question manual eval | Becomes 150-question CI-gated harness |
| `<JudgeSheet />` UI | Mostly preserved; layout extended for stack visualization |
| `<JudgeRuling />` rendering | Mostly preserved; adds community notes section |
| Daily quota | Replaced with server-side rate limiting |

**The user-facing UI is mostly forwards-compatible.** The bulk of the throw-away is in the service layer (`judge.ts` becomes a fetch call) and the prompt (which expands from one to three).

That's the whole point of the alpha shortcut list: take cuts where they're cheap to reverse, **don't** take cuts that lock in bad UI patterns. The user-visible bits we'd keep, the infrastructure bits we'd replace.

---

## 10. Decision points before starting

These are the questions the team should answer before sprint 1 begins. Each has a recommended default:

1. **Tester recruitment:** where do we get 50 trusted MTG players willing to give honest feedback?
   *Recommend: personal networks + a single targeted post in r/mtgrules with explicit "alpha tester" framing. Avoid cmdr or Magic main subs to keep volume low.*

2. **Disclaimer copy:** what exactly does the legal-style disclaimer say?
   *Recommend: "This is an experimental AI ruling assistant. Answers may be wrong. Do not use in tournaments. For real games, ask a judge or call a knowledgeable friend."*

3. **Card scope:** do we limit testers to specific cards/formats, or open to all?
   *Recommend: all cards. Restricting doesn't reduce hallucination risk and adds UX friction.*

4. **Firestore region:** which region should the new Firebase project live in?
   *Recommend: `europe-west` to match the existing Cloud Run region. Latency from EU testers matters; US testers will eat 100ms extra, acceptable.*

5. **Kill criteria:** what telemetry numbers, after 4 weeks, mean we don't proceed to production?
   *Recommend: kill if (a) <30% of rulings get rated, (b) thumbs-up rate <50%, or (c) any single tester reports 3+ confidently-wrong rulings that broke trust. Any one of those triggers the kill conversation.*

6. **Comms channel:** Discord, Slack, email thread?
   *Recommend: Discord — async, threaded, MTG players already live there.*

---

## 11. What this alpha will and won't tell us

### Will tell us

- Whether players actually use the feature when it's available
- Whether the single-call pipeline is good enough for simple questions
- Where the simple pipeline obviously breaks (anything multi-card with state)
- Whether players will read citations or ignore them
- Realistic per-query latency on typical mobile devices in the wild
- Whether the existing UI patterns (vaul bottom sheet, etc.) accommodate this feature

### Won't tell us

- What the production-quality bar is — we're aiming for "good enough to learn", not "good enough to ship"
- Whether the production cost model is sustainable — alpha cost is 100x lower per user
- Whether the community feedback flywheel works — we're not building it
- How the feature performs at scale — 50 users tells us nothing about 50,000

That's fine. The alpha's job is to make a confident go/no-go decision on the production plan, not to validate the production plan's details. Those validations come in the production phases themselves, gated by their own evals.