FROM node:22-alpine AS web-builder
WORKDIR /web
COPY web/package.json ./
RUN npm install
COPY web/ ./
RUN npm run build

FROM node:22-alpine AS app
WORKDIR /app

COPY app/package.json ./
RUN npm install

COPY app/tsconfig.json app/drizzle.config.ts ./
COPY app/src ./src
COPY --from=web-builder /web/dist ./public

RUN npm run build
RUN npm prune --omit=dev

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV DB_PATH=/app/data/planning.db

EXPOSE 3001

CMD ["node", "dist/index.js"]

FROM node:22-alpine AS dev
WORKDIR /app

COPY app/package.json ./
RUN npm install

COPY app/tsconfig.json app/drizzle.config.ts ./

ENV DB_PATH=/app/data/planning.db

EXPOSE 3001

CMD ["npx", "tsx", "watch", "src/index.ts"]
