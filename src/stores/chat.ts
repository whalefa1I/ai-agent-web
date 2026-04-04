import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { wsService, reconnectWebSocket } from '@/services/websocket'
import type {
  ChatMessageDTO,
  ToolCallMessage,
  PermissionRequestMessage,
  SessionStats
} from '@/types/protocol'

export const useChatStore = defineStore('chat', () => {
  // 状态
  const messages = ref<ChatMessageDTO[]>([])
  const pendingToolCalls = ref<ToolCallMessage[]>([])
  const pendingPermission = ref<PermissionRequestMessage | null>(null)
  const stats = ref<SessionStats | null>(null)
  const isThinking = ref(false)
  const currentResponse = ref('')

  // 计算属性
  const hasPendingPermission = computed(() => pendingPermission.value !== null)
  const hasPendingToolCalls = computed(() => pendingToolCalls.value.length > 0)

  // 添加用户消息
  function addUserMessage(content: string) {
    messages.value.push({
      id: `msg_${Date.now()}`,
      type: 'USER',
      content,
      timestamp: new Date().toISOString()
    })
  }

  // 添加助手消息
  function addAssistantMessage(content: string) {
    messages.value.push({
      id: `msg_${Date.now()}`,
      type: 'ASSISTANT',
      content,
      timestamp: new Date().toISOString()
    })
  }

  // 更新助手消息（流式）
  function updateAssistantMessage(content: string) {
    const lastMessage = messages.value[messages.value.length - 1]
    if (lastMessage && lastMessage.type === 'ASSISTANT') {
      lastMessage.content += content
    } else {
      addAssistantMessage(content)
    }
  }

  // 添加工具调用
  function addToolCall(toolCall: ToolCallMessage) {
    const index = pendingToolCalls.value.findIndex(tc => tc.toolCallId === toolCall.toolCallId)
    if (index >= 0) {
      pendingToolCalls.value[index] = toolCall
    } else {
      pendingToolCalls.value.push(toolCall)
    }
  }

  // 更新工具调用状态
  function updateToolCall(toolCallId: string, updates: Partial<ToolCallMessage>) {
    const index = pendingToolCalls.value.findIndex(tc => tc.toolCallId === toolCallId)
    if (index >= 0) {
      pendingToolCalls.value[index] = { ...pendingToolCalls.value[index], ...updates }
    }
  }

  // 清除工具调用
  function clearToolCalls() {
    pendingToolCalls.value = []
  }

  // 设置权限请求
  function setPermissionRequest(request: PermissionRequestMessage) {
    pendingPermission.value = request
  }

  // 清除权限请求
  function clearPermissionRequest() {
    pendingPermission.value = null
  }

  // 更新统计
  function updateStats(newStats: SessionStats) {
    stats.value = newStats
  }

  // 发送消息
  function sendMessage(content: string) {
    if (!content.trim()) return

    addUserMessage(content)
    isThinking.value = true
    currentResponse.value = ''
    wsService.sendMessage(content)
  }

  // 响应权限请求
  function respondPermission(
    requestId: string,
    choice: 'ALLOW_ONCE' | 'ALLOW_SESSION' | 'ALLOW_ALWAYS' | 'DENY'
  ) {
    wsService.sendPermissionResponse(requestId, choice)
    clearPermissionRequest()
  }

  // 初始化 WebSocket 监听
  function initWebSocket() {
    // 监听连接确认
    wsService.on('CONNECTED', (msg) => {
      console.log('WebSocket 已连接，会话 ID:', (msg as any).sessionId)
    })

    // 监听响应开始
    wsService.on('RESPONSE_START', () => {
      isThinking.value = true
      currentResponse.value = ''
    })

    // 监听文本增量
    wsService.on('TEXT_DELTA', (msg) => {
      const deltaMsg = msg as any
      currentResponse.value += deltaMsg.delta
      updateAssistantMessage(deltaMsg.delta)
    })

    // 监听工具调用
    wsService.on('TOOL_CALL', (msg) => {
      addToolCall(msg as ToolCallMessage)
    })

    // 监听权限请求
    wsService.on('PERMISSION_REQUEST', (msg) => {
      setPermissionRequest(msg as PermissionRequestMessage)
    })

    // 监听响应完成
    wsService.on('RESPONSE_COMPLETE', (msg) => {
      isThinking.value = false
      clearToolCalls()
    })

    // 监听错误
    wsService.on('ERROR', (msg) => {
      console.error('服务器错误:', msg)
      isThinking.value = false
    })

    // 监听历史消息
    wsService.on('HISTORY', (msg) => {
      messages.value = (msg as any).messages || []
    })

    // 监听统计
    wsService.on('STATS', (msg) => {
      updateStats((msg as any).stats)
    })

    // 主动连接 WebSocket
    wsService.connect().catch(err => {
      console.error('WebSocket 连接失败:', err)
    })
  }

  // 手动连接 WebSocket
  function connect() {
    wsService.connect().catch(err => {
      console.error('WebSocket 连接失败:', err)
    })
  }

  // 断开连接
  function disconnect() {
    wsService.disconnect()
  }

  // 使用设置的服务器地址连接
  function connectWithSettings() {
    const saved = localStorage.getItem('ai-agent-settings')
    let serverUrl = ''

    if (saved) {
      try {
        const settings = JSON.parse(saved)
        serverUrl = settings.serverUrl || ''
      } catch (e) {
        console.error('加载设置失败:', e)
      }
    }

    // 重新创建 WebSocket 服务实例
    const newService = reconnectWebSocket(serverUrl)

    // 重新注册事件监听器
    newService.on('CONNECTED', (msg) => {
      console.log('WebSocket 已连接，会话 ID:', (msg as any).sessionId)
    })
    newService.on('RESPONSE_START', () => {
      isThinking.value = true
      currentResponse.value = ''
    })
    newService.on('TEXT_DELTA', (msg) => {
      const deltaMsg = msg as any
      currentResponse.value += deltaMsg.delta
      updateAssistantMessage(deltaMsg.delta)
    })
    newService.on('TOOL_CALL', (msg) => {
      addToolCall(msg as ToolCallMessage)
    })
    newService.on('PERMISSION_REQUEST', (msg) => {
      setPermissionRequest(msg as PermissionRequestMessage)
    })
    newService.on('RESPONSE_COMPLETE', (msg) => {
      isThinking.value = false
      clearToolCalls()
    })
    newService.on('ERROR', (msg) => {
      console.error('服务器错误:', msg)
      isThinking.value = false
    })
    newService.on('HISTORY', (msg) => {
      messages.value = (msg as any).messages || []
    })
    newService.on('STATS', (msg) => {
      updateStats((msg as any).stats)
    })

    // 替换全局 wsService 引用（通过修改原型）
    Object.setPrototypeOf(wsService, newService)
    Object.assign(wsService, newService)

    // 发起连接
    wsService.connect().catch(err => {
      console.error('WebSocket 连接失败:', err)
    })
  }

  return {
    // 状态
    messages,
    pendingToolCalls,
    pendingPermission,
    stats,
    isThinking,
    currentResponse,
    // 计算属性
    hasPendingPermission,
    hasPendingToolCalls,
    // 方法
    addUserMessage,
    addAssistantMessage,
    updateAssistantMessage,
    addToolCall,
    updateToolCall,
    clearToolCalls,
    setPermissionRequest,
    clearPermissionRequest,
    updateStats,
    sendMessage,
    respondPermission,
    initWebSocket,
    connect,
    disconnect
  }
})
