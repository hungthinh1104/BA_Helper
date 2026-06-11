FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
RUN corepack enable
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/analyzer/package.json packages/analyzer/package.json
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile --ignore-scripts; else pnpm install --ignore-scripts; fi

FROM base AS build
RUN corepack enable
COPY --from=deps /app/node_modules /app/node_modules
COPY . .
WORKDIR /app/apps/api
RUN pnpm exec prisma generate
RUN cd /app && pnpm -r build

FROM base AS runtime
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/api/node_modules /app/apps/api/node_modules
COPY --from=build /app/packages /app/packages
COPY --from=build /app/apps/api/dist /app/apps/api/dist
USER app
CMD ["node", "/app/apps/api/dist/apps/api/src/main.js"]
