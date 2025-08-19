# Build stage
FROM node:18.4-alpine AS builder

WORKDIR /bot

# Copy package files
COPY ./package.json /bot/package.json
COPY ./package-lock.json /bot/package-lock.json

# Install build dependencies and all dependencies (including devDependencies for building)
RUN apk add --no-cache python3 build-base
RUN npm ci

# Copy source code and build configuration
COPY ./src /bot/src
COPY ./tsconfig.json /bot/tsconfig.json

# Build the application
RUN npm run build

# Production stage
FROM node:18.4-alpine AS production

WORKDIR /bot

# Copy package files
COPY ./package.json /bot/package.json
COPY ./package-lock.json /bot/package-lock.json

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /bot/build /bot/build

# Set NODE_ENV to production
ENV NODE_ENV=production

# Run the application
CMD ["npm", "run", "prod", "--prefix", "/bot"]
