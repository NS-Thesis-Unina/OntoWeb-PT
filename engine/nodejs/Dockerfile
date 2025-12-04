FROM node:22-bookworm-slim

# Install Python 3 and tshark
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y \
      python3 python3-pip python3-venv \
      tshark \
    && rm -rf /var/lib/apt/lists/*

# Create a symlink so that "python" is available in PATH
RUN ln -s /usr/bin/python3 /usr/local/bin/python || true

WORKDIR /usr/src/app

# Copy package manifests to leverage Docker build cache
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy the entire project source
COPY . .

ENV NODE_ENV=production

# Express server listens on port 8081
EXPOSE 8081