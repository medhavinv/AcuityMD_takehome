# PRD: Defending Against General-Purpose AI
**Wedding planning collaboration platform · draft for iteration**

---

## 1. Context
- We sell collaboration software to wedding planners: guest lists, seating charts, to-do tracking. Revenue is annual per-planner licensing *(assumption)*.
- Usage is declining; interviews confirm planners are shifting core planning jobs to general-purpose AI.
- The CEO wants a structural response, not a me-too chatbot. We defend only where our advantage over AI is strongest, rather than competing everywhere *(assumption)*.

## 2. Target user and stakeholders
**Primary user:** the planner running large, complex weddings *(assumption: most complexity, richest data)*. They are the buyer and the repeat-revenue source; their job is to deliver more weddings faster while looking great to the couple.

**Stakeholders:** the couple and family (consume the output; want visible progress) and guests (RSVP and logistics; also leaking to AI, but out of V1 scope).

## 3. Use-case landscape → scoping decision
General AI has intelligence but no access to a specific wedding's data or workflow. There are two moats we can build against it, plus one signal of urgency:

- **Workflow-efficiency moat** — solving the job is meaningfully faster in our tool than in a chatbot, because we unify the data they'd otherwise paste in from scattered sources and give them a visual, manipulable surface instead of a chat transcript. **Stops the leak, but copyable** — a competitor could build the same.
- **Proprietary-data moat** — solving the job lets us leverage non-replicable aggregate data a chatbot can never get. **Durable** — compounds as we grow and can't be reproduced.
- **Losing to AI today** — how much of this job is already leaking to chatbots. The urgency signal, not a moat.

**Strategy:** close the efficiency gap first on the jobs actively leaking to AI — it stops the usage bleed fastest and needs no new data. Then build the durable proprietary-data moat by adding a budgeting feature. *(Assumptions: data exists at sufficient depth; build cost is broadly comparable, so we sequence on strategy, not effort.)*

| Planner job | What we observe planners doing *(assumption)* | AI displacement risk | Efficiency moat (if built) | Data moat (if built) | Build |
|---|---|---|---|---|---|
| **Who sits where** | *Existing core surface.* Describes guest relationships and constraints to a chatbot, asks it to suggest table groupings, then transcribes the layout into our canvas | **HIGH** — AI produces the whole layout, so the full job leaves our product | **STRONG** — guest data already unified here; a visual floor plan is impossible in chat | **WEAK** — relationships are the couple's own and uploadable | **1st** |
| **Understand budget** | *No surface today.* Asks AI for ballpark spend; tracks actuals in spreadsheets | **MEDIUM** — greenfield; we're not losing an existing workflow, but AI owns the job by default | **MEDIUM** — real numbers in a tracking dashboard beat chatbot-plus-spreadsheet | **STRONG** — real aggregate spend data is non-replicable | **2nd** |
| **Planning to-do list** | *Existing core surface.* Generates a checklist in chat, then re-enters it into our tracker | **MEDIUM** — only the thinking leaks; the planner must return to our tracker to log and manage it | **MEDIUM** — a tracked list beats re-pasting, but it's close to what chat can do | **WEAK** — an experienced planner already knows the sequence | **3rd** |
| **Guest list / RSVPs** | *Existing core surface.* Managed directly in our product | **LOW** — AI was never part of this workflow | **STRONG** — fully in-product already | **WEAK** — the couple's own list | **Maintain** |

**Out of scope:** date selection, vendor sourcing, and design. No efficiency or data moat to build on, and design is squarely AI's strength — concede, and embed a model for design rather than compete.

**Seating is the strongest V1:** it reclaims work already leaving the product, using surface area and data we already own, without making planners adopt anything new.

## 4. Roadmap
We build in two phases, sequenced by the strategy in Section 3:

- **Phase 1 — Stop the leak (seating, 1st):** add constraint-aware AI to the existing seating canvas to close the efficiency gap and retain planners in the short term.
- **Phase 2 — Build the durable moat (budget, 2nd):** build a budgeting feature powered by our proprietary cross-wedding spend data, creating an advantage AI cannot replicate.
- **Phase 3 — Close remaining gaps (to-do, 3rd):** AI-generated planning to-do lists inside our existing tracker.

Design and open-ended advice are conceded to AI — no moat to build there.

## 5. Build 1st: constraint-aware seating

**Problem.** Our product has no intelligence to help planners arrange seating *(assumption)*, so they take the couple's messy real-world constraints to a chatbot and transcribe the result back. That's inefficient for the planner and risks churn for us.

**Approach.** V1 is constraint-aware collaboration, not generic AI generation. The planner enters the couple's real constraints — *"divorced parents apart, college friends near the bar, elderly away from speakers, vegetarian meals near service, don't seat Uncle Rob next to Aunt Lisa"* — and the product drafts a chart, flags conflicts, and explains tradeoffs. The planner edits on the canvas and approves. Since we don't capture relationships today, constraint input is a new, first-class surface.

**Justification.** Seating first stops the leak; the budget data moat comes next. Capturing constraints also builds a mini-moat: as structured data in our system, it doesn't export cleanly elsewhere, raising switching cost even though the raw facts are the couple's own.

**Requirements** *(V1 = bare-bones core)*

*Must-have*
- Capture constraints — relationship tags, meal needs, accessibility, and planner notes — entered in descriptive form.
- Generate a seating draft from the guest list, RSVP status, table capacities, and captured constraints.
- Explain placement rationale and flag unresolved conflicts and tradeoffs.
- Drag-and-drop edits directly on the canvas.
- Require planner approval before sharing.

*Should-have*
- Learn from planner edits within the wedding, so regenerations respect changes.
- Import constraints from CSV / notes.
- Save constraint templates (family separation, VIP proximity, kids table, accessibility).
- Compare draft versions.

*Later*
- Third-party integrations.
- Cross-wedding recommendations.
- Couple-facing approval flow.

## 6. Success metrics
- **North Star:** share of planning work done inside the product vs. outside — measures whether we're reclaiming work from AI.
- **Supporting:** weekly active weddings; seating charts generated then published.
- **Guardrail:** planner edit rate on drafts. Too high = poor quality; near-zero = rubber-stamping. A middle band proves human-in-the-loop works.

## 7. Risks
- **Budget data depth:** the data moat assumes real spend data at sufficient depth. If thin or skewed, it's weaker than claimed — the key thing to validate.
- **Provider integrations:** if a model provider ships native planning integrations, the efficiency moat erodes; the proprietary data moat and embedded workflow remain the defense.
- **Guest leak:** guests using AI is left to V1+ — acceptable, since the planner is the buyer and the wedge.
