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
# Runtime data (passes, logos, accounts) — must match the Railway volume mount path.
ENV DATA_DIR=/data
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY public ./public
# Image fallback only. At runtime Railway overlays this path with the volume.
RUN mkdir -p /data /app/certs
EXPOSE 3000
CMD ["node", "dist/server.js"]
