# WebSocket 流式测试工具

本目录包含用于测试后端 WebSocket 流式输出功能的工具，支持 testing reasoning_content 流式推送。

## 快速开始

### 方法 1: 命令行测试 (推荐)

```bash
# 进入前端项目目录
cd G:\project\ai-agent-web

# 使用 npm 脚本运行
npm run test:ws "你好，请简单回复"

# 或直接运行
node test-ws-stream.js "你好，请简单回复"

# 指定 WebSocket URL
node test-ws-stream.js --url ws://localhost:8081/ws/agent/test-token "请思考后回答"

# 使用环境变量
$env:WS_URL="ws://localhost:8081/ws/agent/test-token"
node test-ws-stream.js "你好"
```

### 方法 2: 浏览器测试页面

1. 启动前端开发服务器:
   ```bash
   npm run dev
   ```

2. 访问测试页面:
   ```
   http://localhost:5173/test
   ```

3. 在页面中:
   - 点击 "连接 WebSocket"
   - 输入测试消息
   - 点击 "开始测试"
   - 查看实时消息流和统计信息

## 输出说明

### 消息类型

| 类型 | 说明 | 示例 |
|------|------|------|
| `RESPONSE_START` | 响应开始 | 包含 turnId 和 requestId |
| `REASONING_DELTA` | reasoning 内容增量 | 模型的思考过程 |
| `TEXT_DELTA` | 文本内容增量 | 最终回答内容 |
| `TOOL_CALL` | 工具调用通知 | 工具名称、输入输出 |
| `RESPONSE_COMPLETE` | 响应完成 | 包含 token 统计 |

### 命令行输出示例

```
============================================================
WebSocket 流式测试工具
============================================================
URL: ws://localhost:8081/ws/agent/test-token
消息：请详细思考并回答：1+1 等于几？
时间：2026/4/11 11:00:00
============================================================

[连接] WebSocket 已连接

[发送] 用户消息：test_1775905515324

[11:00:01.234] [RESPONSE_START]
  Turn ID: turn-abc123
  Request ID: test_1775905515324

[11:00:01.456] [REASONING_DELTA] #1
  让我思考一下这个问题...

[11:00:01.789] [REASONING_DELTA] #2
  这是一个简单的数学问题...

[11:00:02.123] [TEXT_DELTA] #1
  1+1 等于 2。

[11:00:02.456] [RESPONSE_COMPLETE]
  内容：1+1 等于 2。
  输入 Tokens: 10
  输出 Tokens: 20
  总耗时：1500ms

============================================================
[断开] 连接已关闭
  Code: 1000
============================================================
```

## API 参考

### test-ws-stream.js

```bash
# 显示帮助
node test-ws-stream.js --help

# 基本用法
node test-ws-stream.js "测试消息"

# 自定义 URL
node test-ws-stream.js --url <WebSocket-URL> "测试消息"
```

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `WS_URL` | WebSocket 服务器 URL | `ws://localhost:8081/ws/agent/test-token` |

## 故障排查

### 连接失败

1. 确认后端服务已启动：
   ```bash
   curl http://localhost:8081/actuator/health
   ```

2. 检查 WebSocket 端口：
   ```bash
   netstat -ano | findstr :8081
   ```

3. 确认 Token 有效（如果启用认证）

### 收不到 REASONING_DELTA

1. 确认模型支持 reasoning_content（qwen3.5-plus 支持）
2. 检查后端日志中是否有 reasoning 内容
3. 查看 `/tmp/bailian-debug/` 中的响应日志

### 超时退出

测试工具会在 30 秒后自动超时退出，如果此时未收到 `RESPONSE_COMPLETE`，退出码为 1。

## 消息排序说明

前端使用 artifact 的 `seq` 字段（全局递增序列号）作为主要排序依据，确保消息按正确的先后顺序显示。

排序逻辑：
1. **优先使用 `seq`**：后端为每个 artifact 分配的唯一递增序号
2. **时间戳作为后备**：当 `seq` 缺失或相同时使用
3. **类型优先级作为最后的 tie-break**：USER → TOOL → TODO → THINKING → ASSISTANT → SYSTEM

如果看到消息顺序错乱，请检查：
- 后端是否正确返回了 `seq` 字段
- artifact 的 `seq` 是否确实是递增的

## 集成到自动化测试

```bash
#!/bin/bash
# test-streaming.sh

# 运行测试并检查退出码
node test-ws-stream.js "测试消息"
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "测试通过"
else
  echo "测试失败"
  exit 1
fi
```

## 相关文件

- `test-ws-stream.js` - 命令行测试工具
- `src/services/test-api.ts` - 测试 API 服务（浏览器用）
- `src/services/test-http-api.ts` - HTTP 测试 API
- `src/pages/TestPage.vue` - 浏览器测试页面
