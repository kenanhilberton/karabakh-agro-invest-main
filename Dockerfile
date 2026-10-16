# Multi-stage build for production
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install dependencies
RUN npm ci --prefix client && npm ci --prefix server

# Copy source code
COPY . .

# Build client
RUN cd client && npm run build

# Production stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Copy built client and server
COPY --from=builder /app/server ./server
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/server/src/db/init.js ./server/src/db/init.js
COPY --from=builder /app/server/src/db/schema.sql ./server/src/db/schema.sql

# Create uploads directory
RUN mkdir -p /app/uploads

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 4000

CMD ["node", "server/src/index.js"]