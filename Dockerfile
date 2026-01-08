# Stage 1: Build Frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Build Backend
FROM node:20-slim AS backend-builder
WORKDIR /app
COPY . .
RUN cd server && npm install && npm run build

# Stage 3: Final Production Image
FROM node:20-slim
WORKDIR /app

# Copy server production dependencies
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

# Copy compiled backend
COPY --from=backend-builder /app/server/dist ./server/dist

# Copy frontend static files
COPY --from=frontend-builder /app/dist ./dist

# Environment variables
ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

# Start the server using the compiled JS
CMD ["node", "server/dist/server/index.js"]
