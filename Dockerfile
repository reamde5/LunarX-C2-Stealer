FROM node:18-alpine

WORKDIR /app

# Copy server files
COPY server/package*.json ./
RUN npm ci --only=production

COPY server/ ./

# Create data directories
RUN mkdir -p data/uploads data/screenshots

EXPOSE 3000

CMD ["node", "server.js"]
