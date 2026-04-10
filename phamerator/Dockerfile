# Stage 1: Build the Meteor app
FROM node:20-bookworm AS builder

# Switch to the non-root node user early
USER node

# Install Meteor locally to the node user's home directory
RUN curl "https://install.meteor.com/?release=3.4" | sh
ENV PATH="/home/node/.meteor:${PATH}"

# Set working directory (Docker will automatically create this directory)
WORKDIR /app

# Copy package files ensuring correct ownership
COPY --chown=node:node package*.json ./

# Install npm dependencies for building (leaving off --production here is correct)
RUN meteor npm install

# Copy the rest of the app source code ensuring correct ownership
COPY --chown=node:node . .

# Build the Meteor app into a local directory that the node user can write to
RUN meteor build --directory /app/build --architecture os.linux.aarch64

# Stage 2: Create the production image
FROM node:20-alpine

# Set the working directory to where the built app will live
WORKDIR /app

# Copy the built app "bundle" from the builder stage maintaining permissions
COPY --chown=node:node --from=builder /app/build/bundle ./

# Install server-specific dependencies for the built Meteor app securely
WORKDIR /app/programs/server
RUN npm install --production

WORKDIR /app

# Switch to the non-root "node" user (built into the official Node images)
USER node

# Expose the default port
EXPOSE 9000

# Set default environment variables
ENV PORT=9000
# NOTE: You MUST provide MONGO_URL and ROOT_URL at runtime.

# Start the application
CMD ["node", "main.js"]
