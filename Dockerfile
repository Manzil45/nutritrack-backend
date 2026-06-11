FROM node:22-alpine

WORKDIR /app

# Copy package files dulu
COPY package*.json ./

# Install dependencies di dalam container
RUN npm ci --only=production

# Baru copy source code
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]