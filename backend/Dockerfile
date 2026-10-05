FROM node:22-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Copy prisma schema first (needed by postinstall script)
COPY prisma/ ./prisma/

# Copy package files and install production deps (Linux-native binaries)
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# Generate Linux-native Prisma client (in case postinstall was skipped)
RUN npx prisma generate --schema=./prisma/schema.prisma

# Copy pre-built JS output from local build
COPY backend/dist/ ./dist/
RUN mkdir -p /app/uploads

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy --schema=./prisma/schema.prisma || true && node dist/index.js"]
