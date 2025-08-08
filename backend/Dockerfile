# --- Production deps only (for the final runtime image)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
# Prod deps only for runtime
RUN npm ci --omit=dev --legacy-peer-deps

# --- Full deps for build (includes TypeScript, Nest CLI, etc.)
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

# --- Runtime image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Copy production node_modules and built app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
