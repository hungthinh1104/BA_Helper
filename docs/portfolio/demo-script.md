# BA Helper: 5-7 Minute Interviewer Demo Script

**Objective:** Demonstrate that BA Helper is not a simple AI wrapper, but a stateful, strictly-gated audit workflow that enforces human verification and guarantees an immutable reviewed snapshot.

---

## 1. The Setup (1 Minute)
*(Screen: Dashboard or New Scan Request Page)*

**What to do:**
Show the starting point where a new requirement change request is initiated.

**What to say:**
"The problem we're solving is traceability decay. When a business requirement changes—like 'allow users to cancel paid bookings'—Technical BAs and QA engineers have to manually hunt down every affected file and API in the backend. 
BA Helper automates this heavy lifting. We input a requirement, and the system scans a snapshot of the codebase to extract a precise impact graph. But the key difference here is the workflow: BA Helper doesn't just guess; it forces human review and produces an immutable audit trail."

---

## 2. Evidence-Backed Graph (1.5 Minutes)
*(Screen: Analysis Workspace / Graph View & Evidence Quality Table)*

**What to do:**
Navigate to the active Analysis Workspace. Highlight a specific impacted backend artifact. Open the Evidence Quality Table showing code snippets.

**What to say:**
"Here is the generated impact graph. Every node represents a specific backend artifact—a controller, a service, or a database model. 
Notice that we don't rely on 'black-box AI' summarizations. Every single impact mapped here is strictly tied to physical code. 
If we look at the Evidence Quality Table, you can see the exact line numbers (like `booking.service.ts: L45-60`). If the extraction parser can't find direct evidence, it defaults to flagging an 'Unknown' risk, rather than inventing fake evidence. This grounds the AI purely in reality."

---

## 3. Human Review Workflow (1.5 Minutes)
*(Screen: Review Decisions UI)*

**What to do:**
Interact with the traceability links. Transition a link's status from `NEEDS_REVIEW` to `ACCEPTED`, and another to `REJECTED`.

**What to say:**
"Because we can't blindly trust LLMs, the system acts as a workflow gatekeeper. It forces a human-in-the-loop validation process. 
As an analyst, my job is to review these machine-proposed impacts. For this link, the evidence is correct, so I mark it `ACCEPTED`. For this one, the AI hallucinated or misunderstood a boundary, so I mark it `REJECTED`. 
I am required to make a decision on every single link. The system's deterministic review gate will block the final export until this is 100% complete."

---

## 4. The Immutable Snapshot (1 Minute)
*(Screen: Final Review Gate & Snapshot Action)*

**What to do:**
Click the "Take Snapshot" action. Show the Final Review Gate transitioning to a 'Complete' state.

**What to say:**
"Once my review is complete, I trigger a Snapshot. This is a critical technical boundary. 
The backend performs a deep copy of all my decisions and the exact context at this millisecond, locking it into an append-only `ReviewedReportSnapshot` in Postgres. 
If I go back and try to change a decision now, it will update the live graph, but it will *never* alter the snapshot. This guarantees historical immutability."

---

## 5. The Final Audit Export (1 Minute)
*(Screen: Final Reviewed Report Viewer & Markdown Download)*

**What to do:**
Click to view the Final Reviewed Report. Then click "Download .md".

**What to say:**
"Because the gate criteria are met—0 unreviewed links and a locked snapshot—the system unlocks the Final Export.
This final export pipeline is completely walled off from the AI. There is no LLM running here, and no live vector retrieval. It is a deterministic payload rendered directly from the frozen database snapshot. 
When I download the markdown file, I have a human-reviewed export that QA can use to build acceptance criteria, with zero risk of silent drift or unverified AI hallucinations."

---

## Closing Remarks
"By combining AI's ability to scan code rapidly with a strictly gated, immutable state machine, we turn a messy manual estimation process into a reliable, enterprise-grade audit trail."
