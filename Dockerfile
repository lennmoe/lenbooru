# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS base
ENV NODE_ENV=production
WORKDIR /app
# toolchain for native modules (better-sqlite3) when no prebuilt binary matches
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --include=dev

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --omit=dev

FROM base AS runner
ENV PORT=3000
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next        ./.next
COPY --from=build /app/public       ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.mjs ./next.config.mjs
# ./data (SQLite + uploaded media) is provided as a mounted volume at runtime
EXPOSE 3000
CMD ["npm", "start"]
