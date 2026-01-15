FROM node:22-alpine

WORKDIR /app

# Install deps first (better layer caching)
COPY package.json package-lock.json* tsconfig.json ./
RUN npm install

# Copy source and build
COPY src ./src
COPY config ./config
RUN npm run build

# Runtime env (port, DB url come from compose)
ENV NODE_ENV=production

EXPOSE 4000
CMD ["node","dist/server.js"]

