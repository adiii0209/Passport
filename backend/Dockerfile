FROM node:22-bookworm-slim
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ghostscript \
  && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/. .

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000
CMD ["npm", "start"]
