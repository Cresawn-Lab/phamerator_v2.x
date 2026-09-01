# Stage 1: Build the Meteor app
FROM node:20-bookworm AS builder

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ git curl bash && \
    rm -rf /var/lib/apt/lists/*

# Install Meteor
RUN curl https://install.meteor.com/ | sh

# Copy the meteor installation from root to the node user and fix ownership
RUN cp -r /root/.meteor /home/node/.meteor && \
    chown -R node:node /home/node/.meteor

WORKDIR /app
COPY . .
RUN chown -R node:node /app

# Switch to the non-root node user
USER node

# Build the application
RUN npm install --omit=dev --no-audit --no-fund
RUN meteor build --directory /home/node/build --server-only

# Stage 2: Create the production image
FROM node:20-bookworm

WORKDIR /app

# Copy the built app "bundle" from the builder stage maintaining permissions
COPY --chown=node:node --from=builder /home/node/build/bundle ./

# Switch to the non-root "node" user
USER node

# Install server-specific dependencies for the built Meteor app securely
WORKDIR /app/programs/server
RUN npm install --omit=dev --no-audit --no-fund

WORKDIR /app

EXPOSE 9000

ENV PORT=9000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 9000) + '/', (res) => process.exit(res.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "main.js"]
