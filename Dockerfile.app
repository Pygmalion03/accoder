FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    g++ \
    openjdk-17-jdk-headless \
    python3 \
  && rm -rf /var/lib/apt/lists/*

RUN ln -sf /usr/bin/python3 /usr/local/bin/python

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts

COPY . .

ENV ACCODER_HOST=0.0.0.0
ENV ACCODER_DEPLOYMENT_MODE=docker-app
ENV PORT=43117

EXPOSE 43117

CMD ["node", "bin/accoder.js", "serve", "--port", "43117"]
