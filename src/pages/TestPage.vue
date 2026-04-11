<template>
  <div class="test-page">
    <h1 class="title">WebSocket 流式测试</h1>
    <p class="subtitle">测试 reasoning_content 流式推送功能</p>

    <!-- 连接状态 -->
    <div class="status-bar">
      <div class="status-item">
        <span class="status-label">连接状态:</span>
        <span :class="['status-value', state.stateInfo?.state || 'disconnected']">
          {{ state.stateInfo?.state || 'disconnected' }}
        </span>
      </div>
      <div class="status-item">
        <span class="status-label">会话 ID:</span>
        <span class="status-value">{{ state.stateInfo?.sessionId || '-' }}</span>
      </div>
      <div class="status-item">
        <span class="status-label">测试状态:</span>
        <span :class="['status-value', state.status]">{{ state.status }}</span>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="input-section">
      <textarea
        v-model="testMessage"
        placeholder="输入测试消息，例如：请详细思考并回答：1+1 等于几？"
        rows="3"
        class="test-input"
      />
      <div class="button-row">
        <button
          @click="startTest"
          :disabled="state.status === 'streaming' || state.stateInfo?.state !== 'connected'"
          class="btn btn-primary"
        >
          {{ state.status === 'streaming' ? '测试中...' : '开始测试' }}
        </button>
        <button @click="connectWs" :disabled="state.stateInfo?.state === 'connected'" class="btn btn-secondary">
          连接 WebSocket
        </button>
        <button @click="disconnectWs" :disabled="state.stateInfo?.state !== 'connected'" class="btn btn-secondary">
          断开连接
        </button>
        <button @click="clearResults" class="btn btn-secondary">清空结果</button>
      </div>
    </div>

    <!-- 统计信息 -->
    <div v-if="state.stats.reasoningCount > 0 || state.stats.textCount > 0" class="stats-section">
      <h3 class="stats-title">统计信息</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-label">Reasoning 消息数</span>
          <span class="stat-value">{{ state.stats.reasoningCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">文本消息数</span>
          <span class="stat-value">{{ state.stats.textCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">工具调用数</span>
          <span class="stat-value">{{ state.stats.toolCallCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">输入 Tokens</span>
          <span class="stat-value">{{ state.stats.inputTokens }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">输出 Tokens</span>
          <span class="stat-value">{{ state.stats.outputTokens }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">总耗时</span>
          <span class="stat-value">{{ state.stats.totalDurationMs }}ms</span>
        </div>
      </div>
    </div>

    <!-- 消息列表 -->
    <div class="messages-section">
      <h3 class="messages-title">消息流 ({{ state.messages.length }})</h3>
      <div class="messages-list">
        <div
          v-for="(msg, index) in state.messages"
          :key="index"
          :class="['message-item', msg.type]"
        >
          <div class="message-header">
            <span class="message-type">{{ msg.type }}</span>
            <span class="message-time">{{ formatTime(msg.timestamp) }}</span>
          </div>
          <div class="message-content">
            <pre>{{ msg.content }}</pre>
          </div>
          <div v-if="msg.toolName" class="message-tool">
            工具：{{ msg.toolName }}
            <span v-if="msg.input">| 输入：{{ JSON.stringify(msg.input) }}</span>
            <span v-if="msg.output">| 输出：{{ msg.output }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 错误信息 -->
    <div v-if="state.error" class="error-section">
      <h3 class="error-title">错误</h3>
      <pre class="error-content">{{ state.error }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { testApi, type TestState, type TestMessage } from '@/services/test-api'
import { agentWebSocketClient } from '@/services/agent-websocket'

const testMessage = ref('')
const state = ref<TestState>(testApi.getState())

let unsubscribeState: (() => void) | undefined

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { hour12: false }) + '.' + date.getMilliseconds().toString().padStart(3, '0')
}

const connectWs = () => {
  testApi.connect('test-token')
}

const disconnectWs = () => {
  testApi.disconnect()
}

const startTest = () => {
  if (!testMessage.value.trim()) {
    testMessage.value = '请详细思考并回答：如果一个公司有 1000 名员工，每年流失率是 15%，招聘新员工的成本是每人 5 万元，那么公司每年的招聘成本是多少？'
  }

  testApi.startStreaming(testMessage.value, {
    onReasoning: (delta) => {
      console.log('[TestPage] Reasoning:', delta)
    },
    onText: (delta) => {
      console.log('[TestPage] Text:', delta)
    },
    onToolCallStart: (toolCallId, toolName, input) => {
      console.log('[TestPage] Tool Start:', toolName, input)
    },
    onToolCallEnd: (toolCallId, toolName, output) => {
      console.log('[TestPage] Tool End:', toolName, output)
    },
    onComplete: (content, inputTokens, outputTokens, durationMs) => {
      console.log('[TestPage] Complete:', { content: content.substring(0, 50) + '...', inputTokens, outputTokens, durationMs })
    }
  })
}

const clearResults = () => {
  testApi.clear()
  state.value = testApi.getState()
}

onMounted(() => {
  unsubscribeState = agentWebSocketClient.subscribeState((wsState) => {
    state.value = testApi.getState()
  })

  // 自动订阅测试状态
  testApi.setCallbacks({
    onStateChange: (newState) => {
      state.value = newState
    }
  })
})

onUnmounted(() => {
  unsubscribeState?.()
  testApi.dispose()
})
</script>

<style scoped>
.test-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.title {
  font-size: 24px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 8px;
}

.subtitle {
  font-size: 14px;
  color: #6b7280;
  margin-bottom: 20px;
}

.status-bar {
  display: flex;
  gap: 20px;
  padding: 12px 16px;
  background: #f9fafb;
  border-radius: 8px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-label {
  font-size: 13px;
  color: #6b7280;
}

.status-value {
  font-size: 13px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
}

.status-value.connected,
.status-value.streaming {
  background: #d1fae5;
  color: #065f46;
}

.status-value.disconnected,
.status-value.idle {
  background: #e5e7eb;
  color: #374151;
}

.status-value.connecting {
  background: #dbeafe;
  color: #1e40af;
}

.status-value.error,
.status-value.error {
  background: #fee2e2;
  color: #991b1b;
}

.status-value.completed {
  background: #d1fae5;
  color: #065f46;
}

.input-section {
  margin-bottom: 20px;
}

.test-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  margin-bottom: 12px;
}

.test-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.button-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover:not(:disabled) {
  background: #e5e7eb;
}

.stats-section {
  margin-bottom: 20px;
}

.stats-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 12px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
}

.stat-label {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.messages-section {
  margin-bottom: 20px;
}

.messages-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 12px;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 600px;
  overflow-y: auto;
}

.message-item {
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.message-item.reasoning {
  background: #fef3c7;
  border-color: #fcd34d;
}

.message-item.text {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.message-item.tool_call_start,
.message-item.tool_call_end {
  background: #dbeafe;
  border-color: #93c5fd;
}

.message-item.complete {
  background: #d1fae5;
  border-color: #6ee7b7;
}

.message-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.message-type {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  color: #6b7280;
}

.message-time {
  font-size: 12px;
  color: #9ca3af;
}

.message-content {
  font-size: 14px;
  color: #1f2937;
  white-space: pre-wrap;
  word-break: break-word;
}

.message-content pre {
  font-family: inherit;
  margin: 0;
}

.message-tool {
  margin-top: 8px;
  font-size: 12px;
  color: #6b7280;
}

.error-section {
  padding: 16px;
  background: #fee2e2;
  border: 1px solid #fca5a5;
  border-radius: 8px;
}

.error-title {
  font-size: 16px;
  font-weight: 600;
  color: #991b1b;
  margin-bottom: 8px;
}

.error-content {
  font-size: 13px;
  color: #7f1d1d;
  font-family: monospace;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
