# Build stage
FROM node:20-alpine AS builder
ARG VERSION=unknown
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build
RUN echo "$VERSION" > /app/dist/version.txt

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/data
EXPOSE 4000

ENV NODE_ENV=production
ENV QUIKAN_DATA=/app/data

CMD ["npm", "start"]
