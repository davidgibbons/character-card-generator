FROM node:18-alpine

RUN apk add --no-cache git

WORKDIR /app

# Install proxy dependencies
COPY proxy/package*.json ./proxy/
RUN cd proxy && npm ci --only=production

# Copy proxy server
COPY proxy/ ./proxy/

# Copy frontend static files
COPY index.html favicon.png ./
COPY src/ ./src/

ENV NODE_ENV=production
ENV PORT=2426
ENV STATIC_ROOT=/app

EXPOSE 2426

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:2426/health || exit 1

CMD ["node", "proxy/server.js"]
