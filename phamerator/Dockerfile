# Stage 1: Build the Meteor app
FROM node:20-bookworm AS builder

# Install Meteor (running as root in the builder stage is standard and fixes path/permission issues)
RUN curl "https://install.meteor.com/?release=3.4" | sh

# Copy the meteor installation from root to the node user and fix ownership
RUN cp -r /root/.meteor /home/node/.meteor && \
    chown -R node:node /home/node/.meteor

# Set working directory (Docker will automatically create this directory)
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (Meteor 3 uses standard npm)
RUN npm install

# Copy the rest of the app source code
COPY . .
RUN chown -R node:node /app

# Switch to the non-root node user
USER node

# Build the Meteor app
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
