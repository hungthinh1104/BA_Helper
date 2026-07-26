# Backend Package Dependencies

The authoritative boundary decision is
[ADR-0010](../adr/adr-0010-application-runtime-boundary.md).

```text
                     +-------------------+
                     | packages/contracts|
                     +-------------------+
                               ^
                               |
 +-----------------+    +------+-------+    +-----------------+
 | packages/shared |<---|  application |--->|packages/analyzer|
 +-----------------+    +------+-------+    +-----------------+
                               ^
                               | implements ports
                     +---------+----------+
                     |  backend-runtime   |
                     | Prisma/BullMQ/SDKs |
                     +----+-----------+---+
                          ^           ^
                     compose|         |compose
                     +----+-+       +-+------+
                     | API  |       | worker |
                     | HTTP |       | jobs   |
                     +------+       +--------+
```

Allowed package dependencies:

| Consumer | May depend on |
| --- | --- |
| `application` | `contracts`, `shared`, `analyzer` |
| `backend-runtime` | `application`, `contracts`, `shared`, `analyzer`, infrastructure SDKs |
| `apps/api` | application/runtime public exports, HTTP/auth libraries |
| `apps/worker` | application/runtime public exports, Nest/BullMQ processor libraries |

Forbidden edges:

```text
application -> backend-runtime
application -> NestJS / Prisma / BullMQ / provider SDK
backend-runtime -> apps/api or apps/worker
worker -> apps/api
API/worker -> another package's src or dist path
```

Infrastructure implementations have one owner. API and worker compose runtime
adapters; they do not copy them.
