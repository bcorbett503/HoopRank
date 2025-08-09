# syntax=docker/dockerfile:1

# --- Stage: install production deps only (small runtime node_modules) ---
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
# Install ONLY runtime deps here
RUN npm install --no-audit --no-fund --omit=dev --legacy-peer-deps

# --- Stage: build (needs dev deps) ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
# Install full deps to compile TypeScript
RUN npm install --no-audit --no-fund --legacy-peer-deps
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

# --- Stage: runtime (copy prod deps + compiled dist) ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/main.js"]
