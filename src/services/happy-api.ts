/**
 * Happy App 兼容的 API 服务层
 *
 * 使用 ai-agent-server 的 Happy 兼容 REST API:
 * - POST /api/v1/artifacts - 创建 artifact (发送消息)
 * - GET /api/v1/artifacts - 获取 artifact 列表
 * - GET /api/v1/artifacts/:id - 获取单个 artifact
 * - POST /api/v1/artifacts/:id - 更新 artifact
 * - DELETE /api/v1/artifacts/:id - 删除 artifact
 *
 * Artifact 格式 (Happy 协议):
 * - header: base64(加密的 header JSON) - 包含工具调用状态等元数据
 * - body: base64(加密的 body JSON) - 包含实际内容
 * - headerVersion/bodyVersion: 乐观并发控制
 */

import type {
  HappyArtifact,
  HappyArtifactHeader,
  HappyArtifactBody,
  ToolCallArtifact,
  MessageArtifact,
  PermissionArtifact,
  TodoArtifact
} from '@/types/happy-protocol'

// 配置
const DEFAULT_SERVER_URL = 'http://localhost:8080'
const ACCOUNT_ID_KEY = 'happy-account-id'
const SESSION_ID_KEY = 'happy-session-id'

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `artifact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 获取或创建账户 ID (持久化到 localStorage)
 */
function getAccountId(): string {
  let id = localStorage.getItem(ACCOUNT_ID_KEY)
  if (!id) {
    id = `account-${Date.now()}`
    localStorage.setItem(ACCOUNT_ID_KEY, id)
  }
  return id
}

/**
 * 获取或创建会话 ID
 */
function getSessionId(): string {
  let id = localStorage.getItem(SESSION_ID_KEY)
  if (!id) {
    id = `session-${Date.now()}`
    localStorage.setItem(SESSION_ID_KEY, id)
  }
  return id
}

/**
 * Base64 编码/解码工具
 */
function encodeBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
}

function decodeBase64(base64: string): string {
  return decodeURIComponent(escape(atob(base64)))
}

/**
 * 加密/解密 (模拟 - 实际使用需要真实加密)
 * 注意：生产环境应使用 Web Crypto API 进行真实加密
 */
function encryptData(data: object, key: string): string {
  // TODO: 实现真实加密
  // 目前仅做 base64 编码作为占位符
  return encodeBase64(JSON.stringify(data))
}

function decryptData<T>(encryptedBase64: string, key: string): T {
  // TODO: 实现真实解密
  if (!encryptedBase64 || encryptedBase64.trim() === '') {
    return {} as T
  }
  return JSON.parse(decodeBase64(encryptedBase64))
}

/**
 * 构建 artifact header
 */
function buildHeader(
  type: 'message' | 'tool-call' | 'permission',
  subtype: string,
  data: Record<string, any>
): HappyArtifactHeader {
  return {
    type,
    subtype,
    ...data,
    version: 1
  }
}

/**
 * 构建 artifact body
 */
function buildBody(content: Record<string, any>): HappyArtifactBody {
  return {
    ...content,
    version: 1
  }
}

/**
 * Happy API 服务类
 */
export class HappyApiService {
  private serverUrl: string
  private accountId: string
  private sessionId: string
  private pollingTimer: number | null = null
  private pollingInterval: number = 500 // 500ms 轮询一次（支持流式输出）

  constructor(serverUrl: string = DEFAULT_SERVER_URL) {
    this.serverUrl = serverUrl.replace(/\/$/, '')
    this.accountId = getAccountId()
    this.sessionId = getSessionId()
  }

  /**
   * 更新服务器地址
   */
  setServerUrl(url: string) {
    this.serverUrl = url.replace(/\/$/, '')
  }

  /**
   * 获取服务器地址
   */
  getServerUrl(): string {
    return this.serverUrl
  }

  /**
   * 获取账户 ID
   */
  getAccountId(): string {
    return this.accountId
  }

  /**
   * 获取会话 ID
   */
  getSessionId(): string {
    return this.sessionId
  }

  /**
   * 健康检查
   */
  async health(): Promise<{ status: string }> {
    const res = await fetch(`${this.serverUrl}/actuator/health`)
    return res.json()
  }

  /**
   * 获取所有 artifacts (用于轮询)
   */
  async getArtifacts(): Promise<HappyArtifact[]> {
    const url = `${this.serverUrl}/api/v1/artifacts?accountId=${encodeURIComponent(this.accountId)}`
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`Failed to get artifacts: ${res.status}`)
    }
    const data = await res.json()
    return data as HappyArtifact[]
  }

  /**
   * 获取单个 artifact
   */
  async getArtifact(id: string): Promise<HappyArtifact | null> {
    const url = `${this.serverUrl}/api/v1/artifacts/${id}?accountId=${encodeURIComponent(this.accountId)}`
    const res = await fetch(url)
    if (res.status === 404) {
      return null
    }
    if (!res.ok) {
      throw new Error(`Failed to get artifact: ${res.status}`)
    }
    return res.json()
  }

  /**
   * 发送用户消息 (创建 message artifact)
   */
  async sendMessage(content: string): Promise<HappyArtifact> {
    const id = generateId()

    // 构建 user message artifact
    const header = buildHeader('message', 'user-message', {
      title: 'User Message',
      timestamp: Date.now()
    })

    const body = buildBody({
      type: 'user-message',
      content,
      timestamp: Date.now()
    })

    const artifact: HappyArtifact = {
      id,
      header: encryptData(header, 'key'),
      body: encryptData(body, 'key'),
      dataEncryptionKey: btoa('user-message-key'),
      accountId: this.accountId,
      sessionId: this.sessionId,
      headerVersion: 1,
      bodyVersion: 1,
      seq: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    const res = await fetch(`${this.serverUrl}/api/v1/artifacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(artifact)
    })

    if (!res.ok) {
      throw new Error(`Failed to send message: ${res.status}`)
    }

    return res.json()
  }

  /**
   * 响应权限请求
   */
  async respondPermission(
    artifactId: string,
    choice: 'ALLOW_ONCE' | 'ALLOW_SESSION' | 'ALLOW_ALWAYS' | 'DENY',
    currentVersion: number
  ): Promise<{ success: boolean; bodyVersion: number }> {
    const updateBody = {
      body: encryptData({
        type: 'permission-response',
        choice,
        timestamp: Date.now()
      }, 'key'),
      expectedBodyVersion: currentVersion
    }

    const res = await fetch(`${this.serverUrl}/api/v1/artifacts/${artifactId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateBody)
    })

    if (!res.ok) {
      throw new Error(`Failed to respond permission: ${res.status}`)
    }

    return res.json()
  }

  /**
   * 更新工具调用状态
   */
  async updateToolCall(
    artifactId: string,
    status: 'started' | 'in_progress' | 'completed' | 'failed',
    output?: string,
    currentVersion?: number
  ): Promise<{ success: boolean; bodyVersion: number }> {
    const artifact = await this.getArtifact(artifactId)
    if (!artifact) {
      throw new Error(`Artifact not found: ${artifactId}`)
    }

    const currentBody = artifact.body ? decryptData<HappyArtifactBody>(artifact.body, 'key') : {}
    const updatedBody = {
      ...currentBody,
      status,
      ...(output && { output }),
      timestamp: Date.now()
    }

    const updateBody = {
      body: encryptData(updatedBody, 'key'),
      expectedBodyVersion: currentVersion ?? artifact.bodyVersion
    }

    const res = await fetch(`${this.serverUrl}/api/v1/artifacts/${artifactId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateBody)
    })

    if (!res.ok) {
      throw new Error(`Failed to update tool call: ${res.status}`)
    }

    return res.json()
  }

  /**
   * 删除 artifact
   */
  async deleteArtifact(id: string): Promise<void> {
    const url = `${this.serverUrl}/api/v1/artifacts/${id}?accountId=${encodeURIComponent(this.accountId)}`
    const res = await fetch(url, { method: 'DELETE' })
    if (!res.ok) {
      throw new Error(`Failed to delete artifact: ${res.status}`)
    }
  }

  /**
   * 开始轮询 artifacts
   */
  startPolling(
    onArtifactsChange: (artifacts: HappyArtifact[]) => void,
    onArtifactUpdate: (artifact: HappyArtifact) => void
  ): () => void {
    let lastKnownArtifacts: Map<string, string> = new Map()

    const poll = async () => {
      try {
        const artifacts = await this.getArtifacts()

        // 检测变化
        const hasChanges = artifacts.some(a => {
          const lastVersion = lastKnownArtifacts.get(a.id)
          return lastVersion !== `${a.headerVersion}-${a.bodyVersion}`
        }) || lastKnownArtifacts.size !== artifacts.length

        if (hasChanges) {
          // 更新已知状态
          const newMap = new Map<string, string>()
          artifacts.forEach(a => {
            const newVersion = `${a.headerVersion}-${a.bodyVersion}`
            const oldVersion = lastKnownArtifacts.get(a.id)

            newMap.set(a.id, newVersion)

            // 检测是否是新增或更新
            if (!lastKnownArtifacts.has(a.id)) {
              // 新增
              onArtifactUpdate(a)
            } else if (oldVersion !== newVersion) {
              // 更新（流式输出场景）
              onArtifactUpdate(a)
            }
          })
          lastKnownArtifacts = newMap

          onArtifactsChange(artifacts)
        }
      } catch (error) {
        console.error('轮询失败:', error)
      }
    }

    // 立即执行一次
    poll()

    // 设置定时器
    this.pollingTimer = window.setInterval(poll, this.pollingInterval)

    // 返回停止函数
    return () => {
      if (this.pollingTimer) {
        clearInterval(this.pollingTimer)
        this.pollingTimer = null
      }
    }
  }

  /**
   * 解析 artifact header
   */
  parseHeader<T = HappyArtifactHeader>(artifact: HappyArtifact): T {
    return decryptData<T>(artifact.header, 'key')
  }

  /**
   * 解析 artifact body
   */
  parseBody<T = HappyArtifactBody>(artifact: HappyArtifact): T {
    if (!artifact.body || artifact.body.trim() === '') {
      return {} as T
    }
    return decryptData<T>(artifact.body, 'key')
  }

  /**
   * 从 artifacts 中提取用户消息
   */
  extractUserMessages(artifacts: HappyArtifact[]): MessageArtifact[] {
    return artifacts
      .filter(a => {
        try {
          const header = this.parseHeader(a)
          return header.type === 'message' && header.subtype === 'user-message'
        } catch {
          return false
        }
      })
      .map(a => ({ ...a, header: this.parseHeader(a), body: this.parseBody(a) }))
  }

  /**
   * 从 artifacts 中提取助手消息
   */
  extractAssistantMessages(artifacts: HappyArtifact[]): MessageArtifact[] {
    return artifacts
      .filter(a => {
        try {
          const header = this.parseHeader(a)
          return header.type === 'message' && header.subtype === 'assistant-message'
        } catch {
          return false
        }
      })
      .map(a => ({ ...a, header: this.parseHeader(a), body: this.parseBody(a) }))
  }

  /**
   * 从 artifacts 中提取工具调用
   */
  extractToolCalls(artifacts: HappyArtifact[]): ToolCallArtifact[] {
    return artifacts
      .filter(a => {
        try {
          const header = this.parseHeader(a)
          return header.type === 'tool-call'
        } catch {
          return false
        }
      })
      .map(a => ({ ...a, header: this.parseHeader(a), body: this.parseBody(a) }))
  }

  /**
   * 从 artifacts 中提取权限请求
   */
  extractPendingPermissions(artifacts: HappyArtifact[]): PermissionArtifact[] {
    return artifacts
      .filter(a => {
        try {
          const header = this.parseHeader(a)
          return header.type === 'permission' && !this.parseBody(a)?.response
        } catch {
          return false
        }
      })
      .map(a => ({ ...a, header: this.parseHeader(a), body: this.parseBody(a) }))
  }

  /**
   * 从 artifacts 中提取待办事项
   */
  extractTodos(artifacts: HappyArtifact[]): TodoArtifact[] {
    return artifacts
      .filter(a => {
        try {
          const header = this.parseHeader(a)
          return header.type === 'todo'
        } catch {
          return false
        }
      })
      .map(a => ({ ...a, header: this.parseHeader(a), body: this.parseBody(a) }))
  }
}

// 导出单例
export const happyApi = new HappyApiService()
