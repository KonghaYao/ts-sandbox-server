# 使用官方 Bun 镜像作为构建阶段
FROM oven/bun:1 AS builder

# 设置工作目录
WORKDIR /app

# 复制依赖文件
COPY package.json bun.lock ./

# 安装依赖（使用 Bun）
RUN bun install --frozen-lockfile

# 复制源代码和配置文件
COPY src/ src/
COPY deno.json deno.lock tsconfig.json ./

# 使用 Bun 进行构建（将 TypeScript 编译为 JavaScript）
RUN bun run build

# 检查构建产物
RUN ls -la dist/

# 生产阶段使用 Deno 镜像作为运行时
FROM denoland/deno:2.1.4-slim

# 创建非 root 用户
RUN addgroup --gid 1001 --system deno && \
    adduser --uid 1001 --system --ingroup deno deno

# 设置工作目录
WORKDIR /app

# 从构建阶段复制所有文件
COPY --from=builder /app/ /app/

# 创建临时目录用于沙盒工作空间
RUN mkdir -p /tmp/sandbox_workspaces && \
    chown -R deno:deno /tmp/sandbox_workspaces

# 切换到非 root 用户
USER deno

# 暴露端口
EXPOSE 8000

# 设置环境变量
ENV DENO_ENV=production

# 启动应用（运行 Bun 构建后的代码）
CMD ["deno", "run", "--allow-all", "--unstable-sloppy-imports", "dist/main.js"]
