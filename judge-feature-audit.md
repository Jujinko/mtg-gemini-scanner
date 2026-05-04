# AI Judge Feature: Technical & Rules Audit

**Auditor Profile:** Senior Full-Stack Developer & Certified MTG Judge (L2+)
**Goal:** Identify inconsistencies, missing aspects, points of friction, and evaluate the feasibility of the proposed "AI Judge" pipeline to prepare for a concrete implementation plan.

---

## 1. Rules Accuracy & Game Mechanics (The Judge Perspective)
The report correctly identifies the difficulty of rules interactions (e.g., layers, timestamps), but it underestimates the invisible game state required to accurately judge a scenario. A photo of the board is often insufficient.

*   **Missing Essential State Variables:** The pipeline configures the AI to ask "Is there anything else?" (Step 2). However, users often omit details because they *don't know* they are relevant. The system must explicitly prompt for invisible parameters:
    *   **APNAP Order (Active Player, Non-Active Player):** To resolve simultaneous triggers, the AI must know whose turn it is. 
    *   **Timestamps:** For continuous effects interacting in the same layer (e.g., *Blood Moon* vs *Urborg, Tomb of Yawgmoth*), the AI must explicitly ask which card entered the battlefield first.
    *   **Choices Made:** Cards like *Clone* or *Cavern of Souls* have choices made as they enter or cast. The AI cannot see this from a picture.
    *   **Targets:** If a spell or ability is on the stack, the AI must establish what it is targeting.
*   **Incomplete Rules Data Base:** Indexing *only* the Comprehensive Rules (CR) is insufficient. Many complex edge cases are explained in per-set **Release Notes** and card-specific **Gatherer Rulings**. A successful RAG database must include the CR, Gatherer rulings, and official Release Notes.
*   **Hierarchical CR Cross-Referencing:** The CR is highly referential (e.g., "See rule 701.4a"). Standard semantic chunking for the Vector DB might sever these connections, leading the RAG to pull a broad rule but miss the crucial exception in the sub-rule.

## 2. Architecture & Feasibility (The Developer Perspective)
While the 4-Step Agentic Pipeline is theoretically sound, it faces severe real-world technical constraints.

*   **Latency Friction:** Stringing together three API calls (Heavy Vision -> Lite RAG -> Heavy Reasoning) plus Scryfall API fetches and Vector DB queries will likely take 8–15 seconds altogether. If the user also has to intervene at Step 2 (State Confirmation), the total time spent could approach 20-30 seconds. This is nearing the limit of acceptable "mid-game dispute" interruption time.
*   **Cost Scaling:** Running heavy multimodal and reasoning models for every query is expensive. If the feature goes viral, API costs will skyrocket. The implementation plan must budget for aggressive caching and optimized "Lite" model routing where possible.
*   **CR Versioning & CI/CD:** The MTG Comprehensive Rules update with almost every major set release. The architecture needs an automated pipeline to ingest, parse, and re-embed the new CR immediately upon release to avoid ruling based on deprecated rules.
*   **Inconsistency in the Report:** Phase 1 in the rollout section correctly suggests starting with 'Option A' (Guided Rulings based only on Scryfall text), but the core Architecture section jumps straight to the 4-Step RAG pipeline. The implementation plan must clearly delineate that Phase 1 skips steps 3 and 4 of the architectural pipeline.

## 3. UX & Interaction Points of Friction
*   **The "Confirmation" Bottleneck:** Step 2 presents the user with a summary and expects them to adjust/add context. Expecting users to type out missing board state on a mobile keyboard adds massive friction. 
    *   *Fix:* The UI needs quick-tap context modifiers or smart chips: "Whose turn is it? -> [Mine] [Theirs]", "Who controls the target? -> [Me] [Opponent]".
*   **Visual Stack Resolution Apprehension:** Phase 3 implies users will scan multiple cards and ask stack questions. Capturing 4-5 cards in a single photo, or distinct photos, then assigning them to the stack is a UX nightmare. The UI must elegantly handle assigning cards as "Spell A", "Trigger B", and mapping their targets visually instead of purely textually.

## 4. Community Verification & The Feedback Flywheel
The "Feedback Flywheel" (Layer 3 / Phase 4) is a brilliant concept for scaling content, but it opens vectors for systemic failure.

*   **The "Confidently Incorrect" Problem:** Crowdsourcing MTG rulings is notoriously unreliable. Confident players frequently upvote incorrect but intuitive answers. 
*   **Validation Mechanism:** The system cannot rely on pure upvotes. How do we weight votes? (e.g., Can users link their Judge Academy/Judge Foundry profiles for higher weight? Or will there be human-in-the-loop moderation for the "Community Index"?)
*   **Poisoning the RAG:** If a wrong ruling gets highly upvoted and ingested back into the vector DB, the AI will confidently repeat this error in future comparable situations, severely damaging trust.

---

## 5. Summary & Next Steps for the Implementation Plan

**Overall Feasibility:** MODERATE TO HIGH. The concept is highly viable, but the execution needs tighter data pipeline constraints and a more guided UX for state collection.

**Requirements for the Implementation Plan:**
1.  **Define the CR Document Parsing Strategy:** Detail how the CR, Gatherer, and Release Notes will be chunked so cross-references are preserved.
2.  **Design the 'State Clarification' UI:** Create a flow for prompting the user for Timestamps, APNAP, and targets using low-friction UI components (toggles, chips) rather than free-text input.
3.  **Establish Latency Budgets:** Outline fallback UIs (e.g., skeleton loaders, progressive disclosure of steps) to keep the user engaged during the 8-15s pipeline execution.
4.  **Define Community Moderation Constraints:** Set requirements for entering a resolved case into the RAG database to prevent bad-actor or incorrect data poisoning.
