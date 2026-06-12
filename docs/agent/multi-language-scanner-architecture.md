# Multi-Language Scanner Architecture

This document outlines the architecture and contract for multi-language scanning capabilities within the BA Helper project. It serves as a foundational guide for understanding current capabilities and implementing future language support.

## Core Problem and Goals
The project utilizes static code analysis to extract architectural components (e.g., controllers, services, entities, tests) and determine their impact paths. Before extending support beyond the initial strong TypeScript/NestJS path, we need a formalized `ScannerAdapter` contract. 

This contract ensures that all future and existing language scanners:
- Produce consistent artifacts and dependency edges.
- Provide explicit capability metadata (`STABLE`, `PARTIAL`, `EXPERIMENTAL`).
- Safely define support boundaries without overclaiming capabilities.
- Emit bounded diagnostics representing their capabilities (`SCANNER_CAPABILITY_SUMMARY`).

## Scanner Adapter Contract
The fundamental building block for any language parser is the `ScannerAdapter` interface (located in `packages/analyzer/src/scanner/scanner.types.ts`).

```typescript
export type ScannerAdapter = {
  adapterId: string;
  adapterVersion: string;
  language: SupportedLanguage;
  framework?: SupportedFramework;
  capability: ScannerCapabilityProfile;

  canScan(input: ScanAdapterInput): boolean;
  scan(input: ScanAdapterInput): Promise<ScanAdapterResult>;
};
```

All adapters must delegate to their respective parser implementations and normalize the output to the standard `ScanAdapterResult`, providing uniform arrays of artifacts, diagnostics, and dependency edges.

## Capability Matrix

Every adapter exposes a `ScannerCapabilityProfile`. This metadata explicitly dictates what the scanner *can* and *cannot* do.

### TypeScript / NestJS (Strongest Path)
- **Adapter**: `TypeScriptNestJsAdapter`
- **Status**: `STABLE`
- **Confidence**: `HIGH`
- **Supported Patterns**: Controllers, Services, Modules, Providers, DTOs, Prisma Models, method/class artifacts.

### Java / Spring (Pilot/Partial)
- **Adapter**: `JavaSpringAdapter`
- **Status**: `PARTIAL`
- **Confidence**: `MEDIUM`
- **Supported Patterns**: Basic Spring controllers, basic HTTP method annotations (including `@PatchMapping`), simple `@RequestMapping` with method/value/path, class-level + method-level route joining, class/method artifacts, bounded Java excerpts.
- **Unsupported/Partial Patterns**: Complex composed annotations, dynamic route construction, advanced dependency injection graph, Spring Data repository query derivation, XML config, Kotlin Spring.
- **Diagnostics Emitted**: `SPRING_COMPOSED_MAPPING_UNSUPPORTED`, `SPRING_DYNAMIC_ROUTE_UNSUPPORTED`, `SPRING_MULTI_ROUTE_MAPPING_UNSUPPORTED`, `SPRING_HTTP_METHOD_UNKNOWN`, `SPRING_REQUEST_MAPPING_FORM_UNSUPPORTED`, `SPRING_UNSUPPORTED_PATTERN`.

> **Note on Public Wording**: TypeScript/NestJS remains the strongest scanner path. Java/Spring must strictly be considered a partial/pilot implementation. The Java/Spring scanner uses a regex-based approach that is intentionally bounded. This means unsupported patterns explicitly emit bounded diagnostics and do not fabricate endpoint artifacts. Future expansion of Java/Spring support requires rigorous evaluation against these bounds before any public support claims can be made.
>
> **Validation Strategy**: Java/Spring capability is actively verified using a deterministic lexical retrieval smoke evaluation (`java-spring-impact-smoke.spec.ts`). This ensures the parsed artifacts consistently align with downstream impact analysis without invoking real LLMs.

## Scanner Adapter Registry

The `ScannerAdapterRegistry` (`scanner-adapter.registry.ts`) manages adapter selection via a deterministic resolution strategy.

**Selection Rules:**
1. A combination of language + framework determines the target adapter (e.g., `typescript` + `nestjs` -> `TypeScriptNestJsAdapter`).
2. Legacy uppercase identifiers (`TYPESCRIPT`, `NESTJS`) are normalized automatically.
3. If an unknown language or framework is provided, the registry will throw a controlled error or return `null` via `tryGetAdapter`. **It will never silently fall back to TypeScript**.

## Artifact Key Stability Rules

Stability of artifact keys (IDs) is crucial for incremental scans, drift detection, and impact tracking. Regardless of the underlying language, all generated artifact keys must strictly adhere to the following rules:

1. **Deterministic**: Scanning the exact same source twice must produce the exact same set of artifact keys.
2. **No Absolute Paths**: Keys must only use relative paths from the repository root to ensure environment agnosticism.
3. **No Unstable Identifiers**: Line numbers, file contents, and volatile excerpts must **not** be used as identity discriminators.
4. **Normalized APIs**: Endpoint keys must normalize HTTP methods (e.g., `GET`) and path routes to a canonical format.
5. **Class/Method Keys**: Keys should combine the normalized relative file path with the specific symbol name (e.g., `service-method:src/auth.service.ts.login`).

Cross-language keys do not need to share an identical format string, provided they satisfy the deterministic and stability constraints listed above.

## Adding a Future Adapter

When adding a future adapter (e.g., Python/Django or Go/Gin):
1. Create a parser module in `packages/analyzer/src/scanner/`.
2. Create an adapter wrapper class in `packages/analyzer/src/scanner/adapters/` implementing `ScannerAdapter`.
3. Provide an honest, rigorous `ScannerCapabilityProfile`. Mark it `EXPERIMENTAL` or `PARTIAL` initially.
4. Ensure the adapter injects the `SCANNER_CAPABILITY_SUMMARY` diagnostic payload on every successful scan.
5. Register the new adapter instance within the `ScannerAdapterRegistry`.
6. Write integration tests to assert adherence to the Artifact Key Stability Rules.
