# Build and run the Express backend

FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Build stage for TypeScript
FROM node:20-alpine AS build
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/tsconfig.json ./tsconfig.json
COPY backend/src ./src
RUN npm run build

# Runtime image
FROM node:20-alpine AS runtime
WORKDIR /app

# Copy production deps and built files
COPY --from=base /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY backend/package.json ./package.json
COPY backend/scripts ./scripts

# Add curl for healthcheck
RUN apk add --no-cache curl libc6-compat

# Create a writable data directory (mounted via compose)
VOLUME ["/data"]

# Default envs (can be overridden by compose)
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data

EXPOSE 3000
CMD ["node", "dist/index.js"]
