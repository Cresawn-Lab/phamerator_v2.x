# Stage 1: Build the Meteor app
FROM node:24-bookworm AS builder

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ git curl bash ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Switch to the non-root node user for building
USER node
ENV HOME=/home/node
ENV PATH="/home/node/.meteor:$PATH"
ENV METEOR_HEADLESS=1
ENV CI=1
ENV TOOL_NODE_FLAGS="--max-old-space-size=4096"

# Install Meteor directly in /home/node/.meteor and pre-warm the exact Meteor 3.5.3 release
RUN curl -fsSL https://install.meteor.com/ | sh && \
    meteor --release 3.5.3 --version

WORKDIR /home/node/app

# 1. Install npm dependencies first (cached across application code edits)
COPY --chown=node:node package*.json ./
RUN npm install --no-audit --no-fund

# 2. Copy the rest of the application source code
COPY --chown=node:node . .

# 3. Build the production bundle
RUN meteor build --directory /home/node/build --server-only

# Stage 2: Create the production runtime image
FROM node:24-bookworm-slim

WORKDIR /app

# Copy the built app bundle from builder stage
COPY --chown=node:node --from=builder /home/node/build/bundle ./

# Install temporary build tools, compile server modules, then purge all build tools, caches, and package managers
WORKDIR /app/programs/server
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && npm pkg set 'overrides.proxy-addr'='^2.0.8' \
    && npm install --omit=dev --no-audit --no-fund \
    && npm install proxy-addr@2.0.8 --no-audit --no-fund \
    && apt-get purge -y python3 make g++ \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /opt/yarn* /usr/local/bin/yarn* /usr/local/lib/node_modules/corepack \
    && rm -rf node_modules/node-gyp node_modules/cacache /root/.npm /root/.cache \
    && chown -R node:node /app

WORKDIR /app

# Switch to the non-root "node" user
USER node

EXPOSE 9000

ENV PORT=9000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 9000) + '/').then(r => process.exit(r.status < 500 ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "main.js"]
