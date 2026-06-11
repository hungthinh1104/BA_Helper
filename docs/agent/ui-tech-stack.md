## Setup & Architecture
- **Next.js:** Use for routing, route groups, SSR/metadata, app layout, API client integration, deployment. Do not build custom routing/layout systems.
- **Tailwind v4:** Use for spacing, grid/flex, responsive, state hover/focus, utility classes. Customizations must use CSS variables/tokens, not hardcoded colors.
- **shadcn/ui:** Use as the UI primitive foundation (Button, Input, Textarea, Select, Tabs, Dialog, Sheet, DropdownMenu, Tooltip, Command, Table, ScrollArea, Badge, Separator, Sonner/Toast). Do not rebuild accessibility, keyboard navigation, or dialog/dropdown behavior.
- **CSS Variables:** The absolute source of truth for colors, radius, shadow, font, surfaces, status colors.

## Custom vs. Generic

**Must Custom Build (Core Product UX):**
- **Brand / Visual Identity:** Color tokens, light/dark theme, landing style, workspace style, status colors, evidence/code surfaces. shadcn defaults are not distinct enough.
- **App Layout:** AppShell, Sidebar, Topbar, ImpactAnalysisWorkspace, EvidenceInspector, ArtifactList, InsightCard, TraceabilityMatrix, GeneratedReportView. (Do NOT use generic admin layouts or dashboard templates).
- **Product-Specific Components:** EvidenceCard, CodeEvidenceBlock, AffectedArtifactCard, UnknownInsightCard, BAQuestionList, QAScenarioList, CommitSnapshotBadge, ReviewActionPanel, ImpactGraphPanel.
- **Domain-Specific UI Labels:** Risk labels, question templates, QA scenario sections, report sections, domain glossary display (Dynamic based on DomainProfile).
- **RAG / Evidence UX (The Moat):** Retrieval results, evidence ranking, file path + line range, confidence, confirmed/inferred/unknown, traceability links.

**Do NOT Custom Build (Use shadcn):**
- Dialog behavior, Dropdown behavior, Keyboard navigation, Toast system, Tabs accessibility, Command palette primitive, Table primitive, Form primitive.

**Do NOT Use:**
- shadcn dashboard template, generic admin layouts, default shadcn theme, generic SaaS styling, random gradient sections.

**Golden Rule:**
If it is generic UI behavior → use shadcn.
If it is BA impact/evidence/review workflow → custom.
