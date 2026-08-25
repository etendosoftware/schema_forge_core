FROM node:22-alpine

WORKDIR /app

# Install production deps inside the tools/report-server/ subdir
# so that __dirname in server.js resolves ../../artifacts correctly.
COPY tools/report-server/package.json ./tools/report-server/package.json
WORKDIR /app/tools/report-server
RUN npm install --production

# Switch back to repo root and copy the rest of the tree
WORKDIR /app
COPY tools/report-server/server.js ./tools/report-server/server.js
COPY artifacts/ ./artifacts/
COPY templates/ ./templates/
COPY cli/src/extract-from-jasper.js ./cli/src/extract-from-jasper.js
# server.js imports this at module load time (added by ETP-4899 to keep the
# deploy-time report list in sync with the dev one). Without it the container
# dies on startup with ERR_MODULE_NOT_FOUND, never reaching a single request.
COPY cli/src/report-descriptor.js ./cli/src/report-descriptor.js

EXPOSE 3001

CMD ["node", "tools/report-server/server.js"]
