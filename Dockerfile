# Stage 1: Build Frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Build Backend & Final Image
FROM node:20-slim
WORKDIR /app

# Copy server dependencies
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

# Copy server source
COPY server ./server
COPY types.ts ./
COPY constants.ts ./
COPY services/gameEngine.ts ./services/
COPY services/pokerLogic.ts ./services/

# Copy built frontend from Stage 1
COPY --from=frontend-builder /app/dist ./dist

# Environment variables
ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

# Start the server
CMD ["node", "--loader", "ts-node/esm", "--experimental-specifier-resolution=node", "server/index.ts"]
