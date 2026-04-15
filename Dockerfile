# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN git describe --tags --always 2>/dev/null > /app/dist/version.txt || echo 'unknown' > /app/dist/version.txt

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/data
EXPOSE 4000

ENV NODE_ENV=production
ENV QUIKAN_DATA=/app/data

CMD ["npm", "start"]
