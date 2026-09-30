FROM node:22-bookworm-slim
RUN corepack enable
WORKDIR /workspace
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY web/package.json ./web/package.json
RUN pnpm install --frozen-lockfile
COPY web ./web
WORKDIR /workspace/web
EXPOSE 3000
CMD ["pnpm", "dev", "--hostname", "0.0.0.0"]
