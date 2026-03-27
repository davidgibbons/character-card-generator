# -- Stage 1: Build ------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# -- Stage 2: Production -------------------------------------
FROM node:22-alpine

RUN apk add --no-cache git
WORKDIR /app

# Install proxy deps only
COPY proxy/package*.json ./proxy/
RUN cd proxy && npm ci --only=production

# Copy proxy source
COPY proxy/ ./proxy/

# Copy built frontend from stage 1
COPY --from=build /app/dist ./dist

# Copy static assets needed at root level in dist
COPY favicon.png ./dist/

ENV NODE_ENV=production
ENV PORT=2426
ENV STATIC_ROOT=/app/dist
ENV DATA_DIR=/data

EXPOSE 2426

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:2426/health || exit 1

CMD ["node", "proxy/server.js"]
