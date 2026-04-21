# PIS-System-servers

进销存系统后端：Node.js + Express + TypeScript + SQLite / Turso（`@libsql/client`）。

## 环境要求

- Node.js：`22.13.0`（见 `.nvmrc`）
- npm：`10.x`

## 安装与开发

```bash
nvm use
npm install
npm run dev
```

默认监听 `PORT` 环境变量或 `3000`。数据库目录为仓库内 `data/`（首次运行自动创建），库文件默认 `data/inventory.db`。可通过环境变量 `DB_PATH` 指定其它路径。

## 协作规范

- 提交规范：Conventional Commits（`commitlint`）
- 代码格式：Prettier（pre-commit 自动格式化暂存文件）

常用命令：

```bash
npm run lint
npm run lint:fix
npm run format
npm run format:check
```

如果 hooks 未生效，可手动执行：

```bash
npm run prepare
```

## 初始化数据库（可选）

```bash
npm run setup
```

## 生产构建与启动

```bash
npm run build
npm start
```

生产模式下若存在上级目录的 `client/dist`，会一并托管静态前端（见 `src/index.ts`）。

## API

- 前缀：`/api`
- 认证：`Authorization: Bearer <token>`（除 `/api/auth/login`、`/api/auth/register`）

## 安全提示

生产环境请设置强随机 `JWT_SECRET`，勿提交 `.env`。
