tokens.css: variables only
components.css: reusable components only
landing.css: .landing-* only
workspace.css: .app-*, .analysis-*, .evidence-* only
responsive.css: media queries only
ui-primitives.css: unmodified shadcn 4.8.1 Tailwind primitive utilities, with MIT attribution

The primitive utilities are local source so rendering needs no generator CLI
dependency. Preserve their state variants and animation rules when upgrading
primitives; `production-dependency-surface.spec.ts` pins the copied CSS bytes.
