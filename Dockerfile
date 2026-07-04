# Development container for simplePersonalDB.
# Provides Node + pnpm; project sources are bind-mounted at runtime (see docker.sh).
FROM node:22-slim

RUN npm install -g pnpm@10

WORKDIR /app

# Vite dev server / preview server
EXPOSE 42304 4173

CMD ["bash"]
