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
# The whole directory, not a per-file list. server.js imports 6 modules from
# cli/src at load time (report-descriptor, report-i18n, report-grouping,
# report-sql, report-filters, report-branding) and the list went stale twice in
# one week: whatever is missing makes the container die on startup with
# ERR_MODULE_NOT_FOUND, never reaching a single request. It is invisible while
# developing, because a dev machine has the whole repository on disk.
COPY cli/src/ ./cli/src/

EXPOSE 3001

CMD ["node", "tools/report-server/server.js"]
