# The API image. Build it from the repo root (the API compiles ../shared into its bundle):
#   docker build -f api/Dockerfile .
# Railway builds it this way (see railway.json).

FROM node:24-slim AS build
WORKDIR /app
COPY shared ./shared
COPY api/package.json api/package-lock.json ./api/
RUN cd api && npm ci
COPY api ./api
RUN cd api && npm run build && npm prune --omit=dev

FROM node:24-slim
WORKDIR /app/api
ENV NODE_ENV=production
COPY --from=build /app/api/package.json ./
COPY --from=build /app/api/node_modules ./node_modules
COPY --from=build /app/api/dist ./dist
USER node
# PORT comes from the platform (Railway sets it); the API defaults to 3000.
CMD ["node", "dist/main.js"]
