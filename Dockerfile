FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# Default data path for a Railway volume mount (survives deploys).
ENV DATA_DIR=/data
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY public ./public
RUN mkdir -p /data certs && chown -R node:node /data
EXPOSE 3000
CMD ["node", "dist/server.js"]
