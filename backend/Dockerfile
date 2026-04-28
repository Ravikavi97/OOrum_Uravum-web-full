FROM node:22-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Copy package files and install production deps (Linux-native binaries)
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# Copy prisma schema and generate Linux client
COPY prisma/ ./prisma/
RUN npx prisma generate --schema=./prisma/schema.prisma

# Copy pre-built JS output from local build
COPY backend/dist/ ./dist/
COPY backend/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && mkdir -p /app/uploads

EXPOSE 4000
CMD ["./docker-entrypoint.sh"]
