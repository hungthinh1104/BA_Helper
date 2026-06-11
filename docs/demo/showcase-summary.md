# Showcase Summary

_Draft for social media (LinkedIn / GitHub Discussions / Portfolio)_

🚀 **Public Beta Release: BA Helper - A Requirement-to-Code Impact Analyzer** 🚀

We are incredibly excited to announce the Public Beta of our Requirement-to-Code Impact Analyzer designed specifically for backend teams!

Have you ever asked yourself: _"If this business requirement changes, which backend code paths are impacted, what evidence supports that, and what should QA verify?"_

Generic AI chatbots often fail here because they lack repository-wide context and hallucinate claims without evidence. We set out to fix that by building a deterministic pipeline constrained by a strict **evidence hierarchy**.

**Here's what it actually does:**
1. Secures a static AST snapshot of your repository (TypeScript/NestJS).
2. Performs hybrid semantic retrieval using our curated Domain Packs (like `booking@0.1.0`) as contextual hints.
3. Maps requirement changes to explicitly impacted artifacts.
4. **The Catch:** Every single `EVIDENCED` impact MUST link directly to extracted code. No code excerpt? No claim. It's flagged as an `UNKNOWN` or a `RISK`.

**What we deliberately aren't:**
- We are not a code generator.
- We are not a generic conversational coding agent.
- We do not autonomously finalize reports (human review is a mandatory gate).

This is a developer-focused tool meant to act as a rigorous impact audit for complex backend systems. 

**Want to try it out?** 
The entire Golden Path demo is reproducible locally using a fake deterministic LLM/embedding provider—meaning you don't even need an API key to verify the pipeline runs end-to-end.

```bash
pnpm install
pnpm demo:golden-path
```

Check out our [Public Beta Release Note](public-beta-release-note.md) and [Sample Requirement](sample-requirement-change.md) to dive deeper into the technical trust model!
