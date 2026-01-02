# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --frozen-lockfile

# Copy all source code
COPY . .

# Build the NestJS app
RUN npm run build

# Stage 2: Run
FROM node:20-alpine

WORKDIR /app

# Copy only the built files and package.json
COPY package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Expose port
EXPOSE 3000

# Start the app
CMD ["node", "dist/main.js"]