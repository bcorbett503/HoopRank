# syntax=docker/dockerfile:1

# Install *runtime* deps only (omit dev), relax peer checks to avoid false conflicts.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund --omit=dev --legacy-peer-deps

# Build TypeScript → dist with full dev deps.
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund --legacy-peer-deps
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

# Final runtime image.
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
