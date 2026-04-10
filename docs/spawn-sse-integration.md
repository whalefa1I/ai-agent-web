# Spawn Subagent SSE 实时进度集成文档

## 概述

本文档描述了如何在前端项目中集成 SSE（Server-Sent Events）实时进度展示，用于 `spawn_subagent` 并行任务的进度可视化。

## 核心组件

### 1. SSE 服务层 (`src/services/subagent-sse-service.ts`)

负责与后端 SSE 端点建立连接，实时接收子任务进度、状态变化事件。

**主要功能：**
- 使用 `fetch` + `ReadableStream` 连接 SSE（支持自定义 headers）
- 自动重连机制（最多3次重试）
- 响应式状态管理（Vue refs）
- 进度计算和时间预估

**使用方式：**

```typescript
import { useSubagentSse } from '@/services/subagent-sse-service'

const {
  isConnected,           // 是否已连接
  currentBatch,          // 当前批次信息
  progressPercentage,    // 整体进度百分比
  estimatedRemainingSeconds, // 预估剩余时间
  allTasksCompleted,     // 是否全部完成
  hasFailedTasks,        // 是否有失败任务
  connect,               // 连接方法
  disconnect             // 断开连接方法
} = useSubagentSse()
```

### 2. 进度面板组件 (`src/components/SubagentProgressPanel.vue`)

展示子任务实时进度的 UI 组件，包含：

- **头部概览**：状态图标、任务计数、进度圆环
- **任务列表**：每个子任务的进度条、状态、耗时
- **连接状态**：断线提示和重连按钮

**Props：**

```typescript
interface Props {
  batch: BatchInfo | null           // 批次信息
  isConnected: boolean              // 连接状态
  connectionError: string | null  // 错误信息
  compact?: boolean                 // 紧凑模式（可选）
}
```

### 3. 修改后的 Spawn 视图 (`src/tools/views/SpawnSubagentView.vue`)

已集成 `SubagentProgressPanel`，当检测到批量任务时自动显示实时进度。

**触发条件：**
- `metadata.batch` 存在且包含 `runIds`
- 或 `input.batchTasks` 是数组且长度 > 0

## 集成流程

### 1. 自动检测与启动

当后端返回 `spawn_subagent` 工具调用 artifact 时，前端自动：

1. **检测**：检查 artifact 的 `toolName` 是否为 `spawn_subagent`
2. **提取**：从 `metadata.batch` 提取 batchId、runIds、任务列表
3. **初始化**：调用 `subagentSseService.initBatch()` 初始化状态
4. **连接**：调用 `subagentSseService.connect()` 启动 SSE 流

**代码位置**：`src/stores/chat.ts` → `handleSpawnSubagentCall()`

### 2. 实时更新

SSE 连接建立后，实时接收以下事件类型：

| 事件类型 | 说明 |
|---------|------|
| `LOG_OUTPUT` | 子任务日志输出 |
| `PROGRESS` | 进度百分比更新 |
| `STATUS` | 状态变更（pending → running → completed/failed） |
| `FATAL_ERROR` | 致命错误 |
| `heartbeat` | 心跳（保持连接） |

### 3. 状态流转

```
用户发送消息
    ↓
重置之前的 SSE 状态
    ↓
检测到 spawn_subagent 工具调用
    ↓
初始化 batch 信息
    ↓
连接 SSE（/api/ops/stream/subagent/{sessionId}）
    ↓
实时接收进度更新 → 更新 UI
    ↓
所有任务完成/失败 → 显示完成状态
```

## 配置说明

### 1. Ops Secret 配置

SSE 连接需要 `X-Ops-Secret` header 进行认证，支持以下配置方式：

**方式1：LocalStorage（推荐用于开发）**

```javascript
// 在浏览器控制台或设置页面中设置
localStorage.setItem('ai-agent-ops-secret', 'your-ops-secret-key')
```

**方式2：环境变量（推荐用于生产）**

```bash
# .env.local
VITE_OPS_SECRET=your-ops-secret-key
```

**方式3：运行时输入**

在设置页面提供输入框，让用户输入 ops secret。

### 2. 服务器地址

SSE 自动从 `localStorage` 的 `ai-agent-settings` 中读取服务器地址，与主 API 保持一致。

## 缓解用户焦虑的设计

### 1. 视觉反馈

- **进度圆环**：实时显示整体完成百分比
- **状态图标**：
  - 🔄 旋转动画 = 进行中
  - ✅ 绿色 = 全部完成
  - ⚠️ 黄色 = 部分失败
- **任务列表**：每个任务独立显示进度条

### 2. 时间预估

- 基于已运行任务的平均速度计算剩余时间
- 显示在标题中：`约 45 秒`

### 3. 即时响应

- spawn 触发后立即显示进度面板（不等第一个 SSE 事件）
- 从 artifact 初始化任务列表，避免"空白等待期"

### 4. 断线重连

- SSE 断开时显示错误提示和"重连"按钮
- 自动重试最多3次

## 使用示例

### 在页面中手动启动 SSE

```vue
<script setup>
import { useSubagentSse } from '@/services/subagent-sse-service'

const { connect, currentBatch, progressPercentage } = useSubagentSse()

// 手动连接（通常由 store 自动处理）
const startMonitoring = () => {
  const sessionId = 'your-session-id'
  const opsSecret = 'your-ops-secret'
  connect(sessionId, opsSecret)
}
</script>
```

### 监听完成事件

```typescript
import { watch } from 'vue'
import { useSubagentSse } from '@/services/subagent-sse-service'

const { allTasksCompleted, hasFailedTasks } = useSubagentSse()

watch(allTasksCompleted, (completed) => {
  if (completed) {
    if (hasFailedTasks.value) {
      console.log('部分任务失败')
    } else {
      console.log('全部任务完成！')
      // 播放完成音效或显示通知
    }
  }
})
```

## 后端 SSE 端点

SSE 连接地址：

```
GET /api/ops/stream/subagent/{sessionId}?runId={optional-filter}
```

**Headers：**
```
X-Ops-Secret: {your-ops-secret}
Accept: text/event-stream
```

**事件格式：**

```
data: {"type":"PROGRESS","runId":"run-xxx","data":{"percent":50},"timestamp":1234567890}

data: {"type":"STATUS","runId":"run-xxx","data":{"status":"completed"},"timestamp":1234567890}
```

## 注意事项

1. **Ops Secret 安全**：不要在代码中硬编码 ops secret，使用环境变量或用户输入
2. **连接生命周期**：SSE 连接在以下情况会自动断开：
   - 所有任务完成
   - 用户发送新消息（自动重置）
   - 网络错误（自动重试3次）
3. **浏览器兼容性**：使用 `fetch` + `ReadableStream`，现代浏览器都支持

## 故障排查

### SSE 连接失败

1. 检查 ops secret 是否正确设置
2. 检查后端 `/api/ops/stream/subagent/{sessionId}` 端点是否可访问
3. 查看浏览器控制台 `[SubagentSSE]` 日志

### 不显示进度面板

1. 确认 `spawn_subagent` 返回的 artifact 包含 `metadata.batch`
2. 检查 `batch.runIds` 是否为数组
3. 查看 `SpawnSubagentView.vue` 的 `shouldShowProgressPanel` 计算属性

### 进度不更新

1. 检查 SSE 是否连接成功（看 isConnected）
2. 检查后端是否正确发送 PROGRESS 事件
3. 查看 `subagent-sse-service.ts` 的 `handleEvent` 方法日志
