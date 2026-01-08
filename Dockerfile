# Stage 1: Build Frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Final Production Image
FROM node:20-slim
WORKDIR /app

# Copy ALL dependencies (unified at root)
COPY package*.json ./
RUN npm install --omit=dev

# Copy source files
COPY server ./server
COPY types.ts ./
COPY constants.ts ./
COPY services ./services
COPY tsconfig.json ./
COPY server/tsconfig.json ./server/

# Copy built frontend from Stage 1
COPY --from=frontend-builder /app/dist ./dist

# Environment variables
ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

# Start scanning for files and run via ts-node directly from root
CMD ["npm", "start"]
