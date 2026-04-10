/**
 * Subagent SSE 实时进度服务
 * 
 * 连接到后端 /api/ops/stream/subagent/{sessionId} SSE 端点
 * 实时接收子任务进度、状态变化、完成事件
 */

import { ref, computed, type Ref } from 'vue'

// ==================== 类型定义 ====================

export interface SubagentTask {
  runId: string
  goal: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress?: number
  phase?: string
  result?: string
  error?: string
  startedAt?: number
  completedAt?: number
}

export interface BatchInfo {
  batchId: string
  sessionId: string
  totalTasks: number
  completedTasks: number
  failedTasks: number
  status: 'running' | 'completed' | 'partial' | 'failed'
  tasks: SubagentTask[]
  startedAt: number
  estimatedEndAt?: number
}

export interface SSEEvent {
  type: 'LOG_OUTPUT' | 'PROGRESS' | 'STATUS' | 'FATAL_ERROR' | 'heartbeat'
  runId?: string
  sessionId?: string
  data?: any
  timestamp: number
}

// ==================== 服务类 ====================

export class SubagentSseService {
  private eventSource: EventSource | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3
  private reconnectDelay = 2000
  
  // 响应式状态
  public isConnected: Ref<boolean> = ref(false)
  public connectionError: Ref<string | null> = ref(null)
  public currentBatch: Ref<BatchInfo | null> = ref(null)
  public activeTasks: Ref<Map<string, SubagentTask>> = ref(new Map())
  
  // 计算属性
  public progressPercentage = computed(() => {
    const batch = this.currentBatch.value
    if (!batch || batch.totalTasks === 0) return 0
    return Math.round((batch.completedTasks / batch.totalTasks) * 100)
  })
  
  public estimatedRemainingSeconds = computed(() => {
    const batch = this.currentBatch.value
    if (!batch || !batch.estimatedEndAt) return null
    const remaining = batch.estimatedEndAt - Date.now()
    return Math.max(0, Math.ceil(remaining / 1000))
  })
  
  public hasFailedTasks = computed(() => {
    return this.currentBatch.value?.failedTasks > 0
  })
  
  public allTasksCompleted = computed(() => {
    const batch = this.currentBatch.value
    if (!batch) return false
    return batch.completedTasks + batch.failedTasks >= batch.totalTasks
  })

  /**
   * 开始监听 SSE 流
   */
  connect(sessionId: string, opsSecret: string, runFilter?: string): void {
    if (this.eventSource) {
      this.disconnect()
    }
    
    this.reconnectAttempts = 0
    this.connectionError.value = null
    
    // 构建 SSE URL（运维路径，需要 X-Ops-Secret）
    const baseUrl = this.resolveServerUrl()
    const params = new URLSearchParams()
    if (runFilter) params.append('runId', runFilter)
    
    const url = `${baseUrl}/api/ops/stream/subagent/${sessionId}?${params.toString()}`
    
    console.log('[SubagentSSE] Connecting to:', url)
    
    // 创建 EventSource（注意：EventSource 不支持自定义 headers，需要用 query param 或改用 fetch ReadableStream）
    // 这里使用 fetch ReadableStream 方式以支持 X-Ops-Secret header
    this.connectWithFetch(url, opsSecret)
  }
  
  /**
   * 使用 fetch ReadableStream 连接（支持自定义 headers）
   */
  private async connectWithFetch(url: string, opsSecret: string): Promise<void> {
    try {
      const response = await fetch(url, {
        headers: {
          'X-Ops-Secret': opsSecret,
          'Accept': 'text/event-stream'
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      if (!response.body) {
        throw new Error('No response body')
      }
      
      this.isConnected.value = true
      this.connectionError.value = null
      
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          console.log('[SubagentSSE] Stream ended')
          break
        }
        
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // 保留未完成的部分
        
        for (const line of lines) {
          this.parseSSELine(line.trim())
        }
      }
      
      this.handleDisconnect()
      
    } catch (error) {
      console.error('[SubagentSSE] Connection error:', error)
      this.connectionError.value = error instanceof Error ? error.message : '连接失败'
      this.handleReconnect(url, opsSecret)
    }
  }
  
  /**
   * 解析 SSE 行
   */
  private parseSSELine(line: string): void {
    if (!line.startsWith('data:')) return
    
    const data = line.slice(5).trim()
    if (!data) return
    
    try {
      const event: SSEEvent = JSON.parse(data)
      this.handleEvent(event)
    } catch (e) {
      console.warn('[SubagentSSE] Failed to parse event:', data)
    }
  }
  
  /**
   * 处理 SSE 事件
   */
  private handleEvent(event: SSEEvent): void {
    console.log('[SubagentSSE] Event:', event.type, event.runId)
    
    switch (event.type) {
      case 'LOG_OUTPUT':
        this.handleLogOutput(event)
        break
      case 'PROGRESS':
        this.handleProgress(event)
        break
      case 'STATUS':
        this.handleStatus(event)
        break
      case 'FATAL_ERROR':
        this.handleFatalError(event)
        break
      case 'heartbeat':
        // 心跳事件，忽略
        break
    }
  }
  
  /**
   * 处理日志输出
   */
  private handleLogOutput(event: SSEEvent): void {
    const task = this.getOrCreateTask(event.runId || 'unknown')
    // 可以存储日志内容，用于展示
    console.log(`[Task ${event.runId}] Log:`, event.data?.content)
  }
  
  /**
   * 处理进度更新
   */
  private handleProgress(event: SSEEvent): void {
    const runId = event.runId
    if (!runId) return
    
    const task = this.getOrCreateTask(runId)
    task.progress = event.data?.percent ?? task.progress
    task.phase = event.data?.phase ?? task.phase
    
    this.activeTasks.value.set(runId, { ...task })
    this.updateBatchInfo()
  }
  
  /**
   * 处理状态变更
   */
  private handleStatus(event: SSEEvent): void {
    const runId = event.runId
    if (!runId) return
    
    const task = this.getOrCreateTask(runId)
    const newStatus = event.data?.status
    
    if (newStatus && this.isValidStatus(newStatus)) {
      task.status = newStatus
      
      if (newStatus === 'running' && !task.startedAt) {
        task.startedAt = Date.now()
      }
      
      if (['completed', 'failed', 'cancelled'].includes(newStatus)) {
        task.completedAt = Date.now()
        task.result = event.data?.result
        task.error = event.data?.error
      }
    }
    
    this.activeTasks.value.set(runId, { ...task })
    this.updateBatchInfo()
  }
  
  /**
   * 处理致命错误
   */
  private handleFatalError(event: SSEEvent): void {
    const runId = event.runId
    if (!runId) return
    
    const task = this.getOrCreateTask(runId)
    task.status = 'failed'
    task.error = event.data?.message
    task.completedAt = Date.now()
    
    this.activeTasks.value.set(runId, { ...task })
    this.updateBatchInfo()
  }
  
  /**
   * 获取或创建任务
   */
  private getOrCreateTask(runId: string): SubagentTask {
    const existing = this.activeTasks.value.get(runId)
    if (existing) return existing
    
    const newTask: SubagentTask = {
      runId,
      goal: '', // 需要从其他地方获取，或者从 SSE 事件解析
      status: 'pending'
    }
    
    return newTask
  }
  
  /**
   * 验证状态有效性
   */
  private isValidStatus(status: string): status is SubagentTask['status'] {
    return ['pending', 'running', 'completed', 'failed', 'cancelled'].includes(status)
  }
  
  /**
   * 更新批次信息
   */
  private updateBatchInfo(): void {
    const tasks = Array.from(this.activeTasks.value.values())
    const completed = tasks.filter(t => t.status === 'completed').length
    const failed = tasks.filter(t => t.status === 'failed' || t.status === 'cancelled').length
    const running = tasks.filter(t => t.status === 'running').length
    
    if (!this.currentBatch.value && tasks.length > 0) {
      // 初始化批次信息
      this.currentBatch.value = {
        batchId: `batch-${Date.now()}`,
        sessionId: '', // 需要外部设置
        totalTasks: tasks.length,
        completedTasks: completed,
        failedTasks: failed,
        status: running > 0 ? 'running' : completed + failed >= tasks.length ? 'completed' : 'running',
        tasks,
        startedAt: Date.now(),
        estimatedEndAt: this.calculateEstimatedEnd(tasks)
      }
    } else if (this.currentBatch.value) {
      // 更新批次信息
      const batch = this.currentBatch.value
      batch.totalTasks = tasks.length
      batch.completedTasks = completed
      batch.failedTasks = failed
      batch.status = running > 0 ? 'running' : completed + failed >= tasks.length ? 'completed' : 'running'
      batch.tasks = tasks
      batch.estimatedEndAt = this.calculateEstimatedEnd(tasks)
    }
  }
  
  /**
   * 计算预估结束时间
   */
  private calculateEstimatedEnd(tasks: SubagentTask[]): number | undefined {
    const runningTasks = tasks.filter(t => t.status === 'running' && t.progress !== undefined)
    if (runningTasks.length === 0) return undefined
    
    // 基于平均进度计算剩余时间
    let totalRemainingMs = 0
    for (const task of runningTasks) {
      if (task.progress && task.progress > 0 && task.startedAt) {
        const elapsed = Date.now() - task.startedAt
        const progressPerMs = task.progress / elapsed
        const remainingProgress = 100 - task.progress
        const remainingMs = remainingProgress / progressPerMs
        totalRemainingMs += remainingMs
      }
    }
    
    return Date.now() + (totalRemainingMs / runningTasks.length)
  }
  
  /**
   * 处理断开连接
   */
  private handleDisconnect(): void {
    this.isConnected.value = false
    this.eventSource = null
  }
  
  /**
   * 处理重连
   */
  private handleReconnect(url: string, opsSecret: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[SubagentSSE] Max reconnect attempts reached')
      this.connectionError.value = '连接失败，已达到最大重试次数'
      return
    }
    
    this.reconnectAttempts++
    console.log(`[SubagentSSE] Reconnecting... Attempt ${this.reconnectAttempts}`)
    
    setTimeout(() => {
      this.connectWithFetch(url, opsSecret)
    }, this.reconnectDelay * this.reconnectAttempts)
  }
  
  /**
   * 断开连接
   */
  disconnect(): void {
    console.log('[SubagentSSE] Disconnecting')
    this.isConnected.value = false
    this.eventSource = null
    this.reconnectAttempts = 0
  }
  
  /**
   * 初始化批次（从 spawn_subagent 工具调用结果）
   */
  initBatch(batchId: string, sessionId: string, tasks: { runId: string; goal: string }[]): void {
    const subagentTasks: SubagentTask[] = tasks.map(t => ({
      runId: t.runId,
      goal: t.goal,
      status: 'pending'
    }))
    
    this.currentBatch.value = {
      batchId,
      sessionId,
      totalTasks: tasks.length,
      completedTasks: 0,
      failedTasks: 0,
      status: 'running',
      tasks: subagentTasks,
      startedAt: Date.now()
    }
    
    // 填充 activeTasks map
    for (const task of subagentTasks) {
      this.activeTasks.value.set(task.runId, task)
    }
  }
  
  /**
   * 重置状态
   */
  reset(): void {
    this.disconnect()
    this.currentBatch.value = null
    this.activeTasks.value.clear()
    this.connectionError.value = null
  }
  
  /**
   * 解析服务器地址
   */
  private resolveServerUrl(): string {
    const saved = localStorage.getItem('ai-agent-settings')
    if (saved) {
      try {
        const settings = JSON.parse(saved)
        return settings.serverUrl || 'http://localhost:8080'
      } catch {
        // ignore
      }
    }
    return 'http://localhost:8080'
  }
}

// 导出单例
export const subagentSseService = new SubagentSseService()

// 导出 composable
export function useSubagentSse() {
  return {
    // 状态
    isConnected: subagentSseService.isConnected,
    connectionError: subagentSseService.connectionError,
    currentBatch: subagentSseService.currentBatch,
    activeTasks: subagentSseService.activeTasks,
    
    // 计算属性
    progressPercentage: subagentSseService.progressPercentage,
    estimatedRemainingSeconds: subagentSseService.estimatedRemainingSeconds,
    hasFailedTasks: subagentSseService.hasFailedTasks,
    allTasksCompleted: subagentSseService.allTasksCompleted,
    
    // 方法
    connect: (sessionId: string, opsSecret: string, runFilter?: string) => 
      subagentSseService.connect(sessionId, opsSecret, runFilter),
    disconnect: () => subagentSseService.disconnect(),
    initBatch: (batchId: string, sessionId: string, tasks: { runId: string; goal: string }[]) =>
      subagentSseService.initBatch(batchId, sessionId, tasks),
    reset: () => subagentSseService.reset()
  }
}
