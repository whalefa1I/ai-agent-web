# ai-agent-web

AI Agent 前端项目，基于 Vue 3 + TypeScript + Vite 构建。

## 技术栈

- **Vue 3.5** - 渐进式 JavaScript 框架
- **TypeScript 5.6** - 类型安全的 JavaScript 超集
- **Vite 5.4** - 下一代前端构建工具
- **Pinia 2.2** - Vue 3 官方状态管理库
- **TailwindCSS** - 实用优先的 CSS 框架

## 功能特性

- 聊天界面 - 与 AI Agent 进行实时对话
- 消息历史 - 查看和管理历史对话记录
- 工具调用展示 - 实时显示 AI 调用的工具及其执行结果
- 权限控制 - 工具调用前请求用户授权
- 设置页面 - 配置 API 端点等参数

## 项目结构

```
ai-agent-web/
├── src/
│   ├── components/       # 可复用组件
│   │   ├── InputBar.vue      # 输入框组件
│   │   ├── MessageList.vue   # 消息列表组件
│   │   ├── PermissionDialog.vue  # 权限对话框
│   │   └── ToolCalls.vue     # 工具调用展示组件
│   ├── pages/            # 页面组件
│   │   ├── ChatPage.vue      # 聊天页面
│   │   └── SettingsPage.vue  # 设置页面
│   ├── services/         # 服务层
│   │   ├── http.ts           # HTTP 请求服务
│   │   └── websocket.ts      # WebSocket 服务
│   ├── stores/           # Pinia 状态管理
│   │   └── chat.ts             # 聊天状态
│   ├── styles/           # 全局样式
│   └── types/            # TypeScript 类型定义
├── index.html
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

## 快速开始

### 环境要求

- Node.js >= 18
- Bun (推荐) 或 npm/yarn/pnpm

### 安装依赖

```bash
bun install
```

### 开发模式

```bash
bun run dev
```

启动后访问 http://localhost:5173

### 生产构建

```bash
bun run build
```

构建产物输出到 `dist/` 目录

### 预览构建

```bash
bun run preview
```

## 与后端通信

前端通过 WebSocket 与后端 (`ai-agent-server`) 通信。默认配置：

- 开发环境：`ws://localhost:8080/ws`
- 生产环境：在设置页面配置

## 部署

### Vercel 部署

1. 安装 Vercel CLI：
```bash
npm i -g vercel
```

2. 部署到 Vercel：
```bash
vercel
```

3. 生产环境部署：
```bash
vercel --prod
```

部署后可以在 Vercel 仪表盘配置环境变量 `VITE_API_BASE_URL` 指向你的后端地址。

## 许可证

MIT
