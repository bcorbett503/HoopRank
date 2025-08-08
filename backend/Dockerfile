# ---- Dependencies (full, incl. dev) ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
# Use install, not ci (no lockfile); tolerate peer dep quirks
RUN npm install --no-audit --no-fund --legacy-peer-deps

# ---- Build (transpile TS) ----
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

# ---- Runtime (prod) ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Bring runtime deps, then drop dev deps
COPY --from=deps /app/node_modules ./node_modules
RUN npm prune --omit=dev
# App files
COPY package*.json ./
COPY --from=build /app/dist ./dist

EXPOSE 3000
ENV PORT=3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/health', r => { if (r.statusCode !== 200) process.exit(1); }).on('error', () => process.exit(1))"

CMD ["node", "dist/main.js"]
