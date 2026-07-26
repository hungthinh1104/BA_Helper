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
COPY packages/backend-runtime/package.json packages/backend-runtime/package.json
COPY packages/application/package.json packages/application/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    sh -c "pnpm config set store-dir /pnpm/store && if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile --ignore-scripts; else pnpm install --ignore-scripts; fi"

FROM base AS build
RUN corepack enable
ENV CI=true
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/apps/web/node_modules /app/apps/web/node_modules
COPY --from=deps /app/packages/backend-runtime/node_modules /app/packages/backend-runtime/node_modules
COPY --from=deps /app/packages/application/node_modules /app/packages/application/node_modules
COPY . .
WORKDIR /app/apps/web
RUN /app/node_modules/.bin/tsc -p /app/packages/contracts/tsconfig.json \
 && /app/node_modules/.bin/tsc -p /app/packages/shared/tsconfig.json \
 && /app/apps/web/node_modules/.bin/next build

FROM base AS runtime
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/web/node_modules /app/apps/web/node_modules
COPY --from=build /app/packages/backend-runtime/node_modules /app/packages/backend-runtime/node_modules
COPY --from=build /app/packages/application/node_modules /app/packages/application/node_modules
COPY --from=build /app/packages /app/packages
COPY --from=build /app/apps/web/.next /app/apps/web/.next
COPY --from=build /app/apps/web/public /app/apps/web/public
COPY --from=build /app/apps/web/package.json /app/apps/web/package.json
COPY --from=build /app/apps/web/next.config.ts /app/apps/web/next.config.ts
USER app
CMD ["sh", "-lc", "cd /app/apps/web && /app/apps/web/node_modules/.bin/next start -p ${PORT:-3000}"]
