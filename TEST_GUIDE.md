# 前端测试工具使用说明

## 概述

已为 `ai-agent-web` 前端项目添加了 WebSocket 流式测试工具，支持：
- 命令行测试（无需打开浏览器）
- 浏览器测试页面（可视化界面）
- reasoning_content 流式推送测试
- 工具调用测试
- Token 统计

## 文件清单

### 新增文件

1. **`test-ws-stream.js`** - 命令行测试工具
   - 直接通过 Node.js 运行
   - 实时显示接收到的消息
   - 支持统计信息输出

2. **`src/services/test-api.ts`** - 测试 API 服务
   - 封装 WebSocket 客户端
   - 提供流式测试回调
   - 状态管理

3. **`src/services/test-http-api.ts`** - HTTP 测试 API
   - 用于通过 HTTP 请求触发测试
   - 会话管理

4. **`src/pages/TestPage.vue`** - 浏览器测试页面
   - 可视化界面
   - 实时消息流显示
   - 统计信息面板

5. **`TESTING.md`** - 测试文档

### 修改文件

1. **`src/main.ts`** - 添加测试页面路由
2. **`package.json`** - 添加测试命令

## 使用方法

### 方法 1: 命令行测试（推荐）

```bash
# 进入前端项目目录
cd G:\project\ai-agent-web

# 运行测试
npm run test:ws "你好，请简单回复"

# 或直接运行
node test-ws-stream.js "你好，请简单回复"

# 指定 WebSocket URL
node test-ws-stream.js --url ws://localhost:8081/ws/agent/test-token "请思考后回答"
```

### 方法 2: 浏览器测试页面

```bash
# 启动开发服务器
npm run dev

# 访问测试页面
http://localhost:5173/test
```

在页面中：
1. 点击 "连接 WebSocket"
2. 输入测试消息
3. 点击 "开始测试"
4. 查看实时消息流和统计信息

## 输出示例

### 命令行输出

```
============================================================
WebSocket 流式测试工具
============================================================
URL: ws://localhost:8081/ws/agent/test-token
消息：你好，请简单回复
时间：2026/4/11 11:14:20
============================================================

[连接] WebSocket 已连接

[发送] 用户消息：test_1775877260131

[11:14:20.216] [RESPONSE_START]
  Turn ID: msg_1775877260214_fa65419d
  Request ID: test_1775877260131

[11:14:22.247] [REASONING_DELTA] #1
  让我思考一下这个问题...

[11:14:22.247] [TEXT_DELTA] #1
  你好！

[11:14:22.383] [RESPONSE_COMPLETE]
  内容：你好！有什么我可以帮你的吗？
  输入 Tokens: 10
  输出 Tokens: 20
  总耗时：2292ms

============================================================
统计信息:
  Reasoning 消息：1
  文本消息：14
  工具调用：0
  输入 Tokens: 10
  输出 Tokens: 20
  总耗时：2292ms
============================================================
```

## 消息类型

| 类型 | 说明 | 显示内容 |
|------|------|----------|
| `RESPONSE_START` | 响应开始 | Turn ID, Request ID |
| `REASONING_DELTA` | reasoning 增量 | 思考过程片段 |
| `TEXT_DELTA` | 文本增量 | 回答内容片段 |
| `TOOL_CALL` | 工具调用 | 工具名、输入输出、耗时 |
| `RESPONSE_COMPLETE` | 响应完成 | 内容摘要、Token 统计 |

## 测试场景

### 1. 测试 reasoning_content

```bash
node test-ws-stream.js "请详细思考并回答：如果一个公司有 1000 名员工，每年流失率是 15%，招聘新员工的成本是每人 5 万元，那么公司每年的招聘成本是多少？请详细说明你的思考过程。"
```

### 2. 测试工具调用

```bash
node test-ws-stream.js "请帮我读取当前目录下的 package.json 文件"
```

### 3. 测试流式输出

```bash
node test-ws-stream.js "请写一篇 500 字的文章"
```

## 故障排查

### 连接失败

1. 确认后端服务已启动：
   ```bash
   curl http://localhost:8081/actuator/health
   ```

2. 检查端口：
   ```bash
   netstat -ano | findstr :8081
   ```

### 没有 REASONING_DELTA

- 确认后端配置：`demo.bailian.direct-call=true`
- 确认模型支持 reasoning_content（qwen3.5-plus 支持）
- 检查后端日志

### 超时退出

测试工具会在 30 秒后自动超时，如果未收到 `RESPONSE_COMPLETE`，退出码为 1。

## 消息排序说明

前端使用 artifact 的 `seq` 字段（全局递增序列号）作为主要排序依据，确保消息按正确的先后顺序显示。

排序逻辑：
1. **优先使用 `seq`**：后端为每个 artifact 分配的唯一递增序号
2. **时间戳作为后备**：当 `seq` 缺失或相同时使用
3. **类型优先级作为最后的 tie-break**：USER → TOOL → TODO → THINKING → ASSISTANT → SYSTEM

如果看到消息顺序错乱，请检查：
- 后端是否正确返回了 `seq` 字段
-  artifact 的 `seq` 是否确实是递增的

## 集成到 CI/CD

```bash
#!/bin/bash
# test-streaming.sh

echo "Running WebSocket streaming test..."
node test-ws-stream.js "测试消息" > test-output.log 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "Test PASSED"
  cat test-output.log
else
  echo "Test FAILED"
  cat test-output.log
  exit 1
fi
```
