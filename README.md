# PIS-System-servers

进销存系统后端：Node.js + Express + TypeScript + SQLite（better-sqlite3）。

## 环境要求

- Node.js 18+

## 安装与开发

```bash
npm install
npm run dev
```

默认监听 `PORT` 环境变量或 `3000`。数据库目录为仓库内 `data/`（首次运行自动创建），库文件默认 `data/inventory.db`。可通过环境变量 `DB_PATH` 指定其它路径。

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
