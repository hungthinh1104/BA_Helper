FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/analyzer/package.json packages/analyzer/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    sh -c "pnpm config set store-dir /pnpm/store && if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile --ignore-scripts; else pnpm install --ignore-scripts; fi"

FROM base AS build
RUN corepack enable
ENV CI=true
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/apps/api/node_modules /app/apps/api/node_modules
COPY --from=deps /app/apps/worker/node_modules /app/apps/worker/node_modules
COPY --from=deps /app/packages/analyzer/node_modules /app/packages/analyzer/node_modules
COPY . .
WORKDIR /app/apps/worker
# worker needs apps/api prisma generated
RUN /app/apps/api/node_modules/.bin/prisma generate --schema /app/apps/api/prisma/schema.prisma
RUN /app/node_modules/.bin/tsc -p /app/packages/contracts/tsconfig.json \
 && /app/node_modules/.bin/tsc -p /app/packages/shared/tsconfig.json \
 && /app/node_modules/.bin/tsc -p /app/packages/analyzer/tsconfig.json \
 && /app/node_modules/.bin/tsc -p /app/apps/worker/tsconfig.build.json

FROM base AS runtime
ENV NODE_ENV=production
ENV NODE_PATH=/app/apps/api/node_modules:/app/node_modules
RUN apk add --no-cache git
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/api/node_modules /app/apps/api/node_modules
COPY --from=build /app/apps/worker/node_modules /app/apps/worker/node_modules
COPY --from=build /app/packages /app/packages
COPY --from=build /app/apps/worker/dist /app/apps/worker/dist
COPY --from=build /app/apps/api/node_modules /app/apps/worker/dist/apps/api/node_modules
USER app
CMD ["node", "/app/apps/worker/dist/apps/worker/src/main.js"]
