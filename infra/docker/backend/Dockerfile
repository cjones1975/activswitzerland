# Stage 1: build native modules (bcrypt requires python3/make/g++)
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev


# Stage 2: production image
FROM node:20-alpine

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/node_modules ./node_modules
COPY src ./src

# config/ holds the .env file loaded by dotenv — mount it at runtime
RUN mkdir -p config && chown -R appuser:appgroup /app

USER appuser

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "src/server.js"]
