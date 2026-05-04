# "AI Judge" & Rules Interaction Feature: Comprehensive Exploration Report

## 1. Executive Summary
The proposed "AI Judge" feature aims to resolve one of the most persistent pain points in Magic: The Gathering (MTG): understanding complex rules interactions, stack resolutions, and edge cases. By leveraging the existing scanner infrastructure, MTG's Comprehensive Rules, Gatherer rulings, and an LLM (like Gemini), the app can act as a pocket judge.

This report explores the feasibility, user expectations, potential pitfalls, and implementation pathways for integrating a rules-resolution engine into the MTG Scanner app.

---

## 2. User Desires & Core Use Cases

### The Problem
MTG is famously Turing-complete and possesses a rulebook exceeding 250 pages. Commander (EDH), the most popular format, involves multiple players and disparate mechanics from 30+ years of history, leading to highly complex board states.

### What Users Want
1. **Instant Adjudication:** "I control X, my opponent plays Y, I respond with Z. What happens?"
2. **Scan-to-Ask:** The ability to scan two interacting cards on the table and ask, "Does this combo work?" or "If this attacks, what triggers?"
3. **Card-Specific Rulings:** Quick access to the Gatherer/Oracle rulings for a specific card without parsing the whole Scryfall page.
4. **Keyword Definitions:** "What exactly does *Banding* or *Mutate* do in this context?"
5. **Neutral Third Party:** A definitive, unbiased answer to settle table disputes quickly so the game can continue.

### Target Personas
* **The New Player:** Needs basic keyword explanations and phase order.
* **The Commander Player:** Trying to figure out if their 4-card jank combo actually works.
* **The Kitchen Table Group:** Needs a quick dispute resolution without a real judge present.

---

## 3. User Concerns & Risks

### The "Hallucination" Problem (Critical)
If an AI gives a mathematically wrong answer to a coding question, the code fails. If an AI gives a rules-wrong answer in MTG, it ruins the integrity of the game. MTG players are extremely precise about rules. **If the AI hallucinates a ruling once, the playgroup will never trust it again.**

### Specific Concerns
1. **Confidence in Inaccuracy:** LLMs sound highly confident even when incorrectly resolving layers (e.g., Blood Moon vs. Magus of the Moon) or stack ordering.
2. **Outdated Rules:** MTG rules change (e.g., the Cascade rule change, Planeswalker redirection rule). The model must know the *current* Comprehensive Rules, not just its pre-training data.
3. **Ambiguity:** Users are bad at describing board states. "If he attacks me with his 3/3 and I have a 2/2..." (Does it have flying? First strike? Triggers?). The AI might assume details or give an answer that is technically correct for the prompt but wrong for the actual board state.
4. **Tournament Legality:** Users might try to use this in a sanctioned event, which is strictly against MTG Tournament Rules (using electronic devices for outside assistance).

---

## 4. Proposed Architecture: The Agentic Legal Pipeline

To mitigate the hallucination risk and the user-ambiguity problem, a single zero-shot LLM pass is insufficient. Instead, an **Agentic, Multi-Stage LLM Pipeline** is highly recommended. This approach uses specialized models for specific tasks, keeping speed high, costs manageable, and accuracy paramount.

### The 4-Step Resolution Pipeline

**Step 1: Ingestion & Extraction (Vision + Heavy Model)**
* **User Action:** The user snaps 1-3 photos of the board state (or specific interacting cards) and types/speaks a question (e.g., "If I cast X, does Y trigger twice?").
* **Process:** A multimodal LLM processes the images, identifies the specific MTG cards, and extracts the user's core question.
* **Data Fetching:** The app silently pings the Scryfall API to retrieve the exact Oracle text and official rulings for the identified cards.

**Step 2: State Alignment & Confirmation (The UX Innovation)**
* **The Problem Solved:** Users often omit crucial details (e.g., "Oh, wait, I have a *Panharmonicon* in play").
* **Process:** The system presents a low-friction UI summarizing its understanding *before* making a ruling.
  * *AI:* "I see you are asking about casting **[Card A]** while controlling **[Card B]**. Is there anything else on the battlefield affecting triggers?"
* **User Action:** The user confirms the state or quickly adjusts/adds context. This essentially guarantees the AI is answering the *actual* board state, not an assumed one.

**Step 3: Categorization & Retrieval (Lite Model)**
* **Process:** Once the state is locked, the confirmed state + card data is sent to a fast, "Lite" LLM (e.g., Gemini 1.5 Flash).
* **Task:** This model acts as a librarian. It scans the provided data against an index of the Comprehensive Rules, identifying exactly which rules are relevant (e.g., "This involves Rule 614: Replacement Effects and Rule 603: Handling Triggered Abilities").
* **Output:** A curated packet of the exact Comprehensive Rule texts necessary to solve the interaction.

**Step 4: The Final Adjudication (Heavy Model)**
* **Process:** The final packet (Confirmed Context + Scryfall Rulings + Exact Comprehensive Rules) is fed to a sophisticated reasoning LLM (e.g., Gemini Pro).
* **Task:** The prompt strictly restricts the model to logic based *only* on the provided rules payload.
* **Output:** The model generates the final ruling, structured specifically for the MTG audience (see Output UI below).

---

## 5. Output UI: Multi-Layered Rulings

MTG players have different needs depending on the situation. The output must cater to both the "quick answer" and the "deep dive," while also providing a space for accountability.

* **Layer 1: The TL;DR (Simplified)**
  * A clear, bold, 1-2 sentence answer at the very top.
  * *Example:* "Yes. Because you control Yarok, the Desecrated, target opponent will lose 4 life instead of 2."
  * *Goal:* Get the players back to playing the game immediately.

* **Layer 2: The Judge's Breakdown (Complex)**
  * An expandable section detailing the step-by-step stack resolution.
  * Explicit citations of the Comprehensive Rules and Scryfall rulings.
  * *Example:* "1. When [Card A] enters the battlefield, Rule 603.1 applies... 2. Due to the replacement effect in [Card B] (Rule 614.1), the event is modified..."
  * *Goal:* Settle disputes permanently by showing the unquestionable "math" behind the ruling.

* **Layer 3: Community Consensus & Discussion**
  * A section attached to every ruling where users can upvote/downvote accuracy and leave comments.
  * *Goal:* Empower knowledgeable players to validate or correct edge-case rulings, establishing a community-checked database of highly specific interactions.

---

## 6. The "Feedback Flywheel": Utilizing Community Verification

A major barrier to AI adoption in MTG is skepticism. The most effective way to organically cultivate trust and constantly improve the system's edge-case accuracy is to turn power users (especially certified Judges or experienced players) into active participants.

### 1. Peer Review & Corrective Context
When the AI generates a ruling, users should be presented with a low-friction way to assess it. If a knowledgeable player spots a layer priority error or a missed trigger, they can flag the ruling and provide a corrective comment (e.g., "The AI missed the Timestamp interaction between these two continuous effects").

### 2. The Community-Sourced RAG Database
Once a specific interaction (e.g., Card A + Card B) is queried, adjudicated by the AI, and subsequently validated, debated, or corrected by the community, it becomes a "known case." This case is saved into a **Community Interaction Index**.

### 3. Surfacing Comparable Situations
When a future user queries the same (or a functionally identical) interaction, Step 3 of the pipeline (Retrieval) pulls this community-verified context alongside the official rules. 
* **The UX Benefit:** The final ruling isn't just an AI's best guess; it's presented with social proof: *"This interaction's ruling was verified by the community."* Top player comments are presented underneath the AI’s answer as "Community Notes."
* **Result:** Rather than fighting against experienced players, the app leverages their knowledge. The system gets smarter, faster, and safer over time, transforming from an isolated "black box" into a collaborative, living judge wiki.

---

## 7. Proposed UX/UI Integration

The feature should be integrated seamlessly into the existing Scanner and Collection flows.

### 1. "Ask a Judge" Mode in Scanner
* Add a "Judge" toggle next to "Continuous" in the Scanner.
* User scans a card. Instead of just saving it, it pins to the bottom of the screen.
* User scans a second card. It pins next to the first.
* A chat input appears: "Ask about these cards..."
* **Example:** Scan *Painter's Servant* + *Grindstone*. Ask: "How does this win the game?"

### 2. Contextual Card Actions
* When tapping a card in the Collection or Deck view, add an "Ask Judge" button next to Oracle Text.
* Opens a bottom-sheet chat contextually loaded with that card's data.

### 3. Citations & Transparency
* **Crucial UI Requirement:** Every AI response **must** include citations.
* "According to Rule 704.5f..." or "As per the Scryfall ruling on 2021-06-18..."
* *Why?* Players will accept an AI's answer if it points them to the exact rule defending the logic.

---

## 8. Recommendations & Phased Rollout

**Do Not Deploy a Raw Chatbot.** It will fail the community trust test immediately upon its first hallucination regarding replacement effects or timestamps.

### Phase 1: Guided Rulings (The Safe Bet)
* Implement an "Ask Judge" feature that strictly operates via **Option A**.
* When a user selects 1-3 cards, fetch their explicit Scryfall rulings.
* System prompt the LLM to simply summarize the official rulings in plain English and apply them to the user's specific question.
* Include a strict disclaimer: "AI judgements are unofficial. In a tournament, call a real judge."

### Phase 2: RAG Integration
* Download the TXT version of the Comprehensive Rules.
* Build a lightweight semantic search (using Gemini Embeddings).
* When a user asks a mechanics question (e.g., "Does Deathtouch work with Trample?"), the AI retrieves Rule 702.2b and quotes it directly in the explanation.

### Phase 3: Visual Stack Resolution
* Allow users to scan multiple cards and ask stack-order questions. The LLM outputs a step-by-step resolution list (First, X resolves. Then Y triggers...).

### Phase 4: The Community Index (Feedback Flywheel)
* Introduce the Layer 3 commenting system on generated rulings.
* Begin saving upvoted/verified rulings into a vector database.
* Integrate this database into the RAG pipeline so the LLM references prior community corrections when judging comparable future interactions.

## Conclusion
An "AI Judge" is a killer feature for a mobile MTG companion app, but it carries a high "trust risk." By rigorously constraining the LLM with Scryfall's API and the official Comprehensive Rules, and enforcing UI patterns that highlight citations, the MTG Scanner can deliver a highly requested feature without compromising the integrity of the game.
