# Adventure Keeper — realtime server. Build from the repository root:
#   docker build -f apps/realtime-server/Dockerfile -t adventure-keeper-realtime .
FROM node:26-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile --filter "@adventure-keeper/realtime-server..." \
 && pnpm turbo run build --filter=@adventure-keeper/realtime-server

# The server is one bundled file: no node_modules at run time.
FROM node:26-alpine
WORKDIR /app
COPY --from=build /repo/apps/realtime-server/dist/server.js ./server.js
ENV PORT=8787 DATA_DIR=/data NODE_ENV=production
VOLUME ["/data"]
EXPOSE 8787
USER node
CMD ["node", "server.js"]
