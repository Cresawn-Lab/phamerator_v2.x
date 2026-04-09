# Stage 1: Build the Meteor app
FROM node:20-bookworm AS builder

# Install Meteor (version matching your project)
RUN curl "https://install.meteor.com/?release=3.4" | sh

# Set environment variable to allow Meteor build to run as root in Docker
ENV METEOR_ALLOW_SUPERUSER=true

WORKDIR /app
COPY package*.json ./

# Install npm dependencies
RUN meteor npm install

# Copy the rest of the app source code
COPY . .

# Build the Meteor app into a directory called "/built-app"
RUN meteor build --directory /built-app --architecture os.linux.aarch64

# Stage 2: Create the production image
FROM node:20-alpine

# Set the working directory to where the built app will live
WORKDIR /app

# Copy the built app "bundle" from the builder stage
COPY --from=builder /built-app/bundle ./

# Install server-specific dependencies for the built Meteor app
WORKDIR /app/programs/server
RUN npm install

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
