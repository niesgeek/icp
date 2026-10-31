FROM oven/bun:1-alpine AS runtime
WORKDIR /app
COPY package.json ./
COPY public ./public
COPY server ./server
COPY scripts ./scripts
COPY schema.sql ./
RUN mkdir -p /app/data && chown -R bun:bun /app
USER bun
EXPOSE 3000
ENV PORT=3000
ENV DB_PATH=/app/data/icp.db
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["bun", "run", "server/index.ts"]
