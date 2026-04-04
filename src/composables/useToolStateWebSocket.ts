/**
 * Tool State WebSocket Composable
 *
 * 用于连接 Java 后端工具状态 WebSocket 的 Vue composable
 */

import { ref, onMounted, onUnmounted } from 'vue'
import type { ToolArtifact, ToolStateWebSocketEvent } from '@/types/tool-state'

const WEBSOCKET_URL = 'ws://localhost:8081/ws/tool-state'

export function useToolStateWebSocket(userId: string) {
  const ws = ref<WebSocket | null>(null)
  const artifacts = ref<ToolArtifact[]>([])
  const isConnected = ref(false)

  /**
   * 连接 WebSocket
   */
  function connect() {
    if (ws.value?.readyState === WebSocket.OPEN) {
      return
    }

    const url = `${WEBSOCKET_URL}?userId=${encodeURIComponent(userId)}`
    ws.value = new WebSocket(url)

    ws.value.onopen = () => {
      console.log('[ToolState WebSocket] 连接已建立')
      isConnected.value = true
    }

    ws.value.onclose = () => {
      console.log('[ToolState WebSocket] 连接已关闭')
      isConnected.value = false
    }

    ws.value.onerror = (error) => {
      console.error('[ToolState WebSocket] 连接错误:', error)
    }

    ws.value.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ToolStateWebSocketEvent
        handleWebSocketMessage(data)
      } catch (error) {
        console.error('[ToolState WebSocket] 解析消息失败:', error)
      }
    }
  }

  /**
   * 处理 WebSocket 消息
   */
  function handleWebSocketMessage(data: ToolStateWebSocketEvent) {
    console.log('[ToolState WebSocket] 收到消息:', data)

    switch (data.type) {
      case 'new-tool-artifact': {
        // 添加工具状态到列表
        const artifact: ToolArtifact = {
          id: data.artifactId,
          sessionId: '', // 从其他地方获取
          accountId: userId,
          header: data.header as any,
          body: data.body as any,
          headerVersion: (data.header as any).version || 0,
          bodyVersion: (data.body as any).version || 0,
          seq: 0,
          createdAt: data.timestamp,
          updatedAt: data.timestamp
        }
        artifacts.value.push(artifact)
        break
      }

      case 'update-tool-artifact': {
        // 更新现有工具状态
        const index = artifacts.value.findIndex(a => a.id === data.artifactId)
        if (index !== -1) {
          artifacts.value[index] = {
            ...artifacts.value[index],
            header: data.header as any,
            body: data.body as any,
            headerVersion: (data.header as any).version || artifacts.value[index].headerVersion,
            bodyVersion: (data.body as any).version || artifacts.value[index].bodyVersion,
            updatedAt: data.timestamp
          }
        }
        break
      }

      case 'delete-tool-artifact': {
        // 删除工具状态
        const index = artifacts.value.findIndex(a => a.id === data.artifactId)
        if (index !== -1) {
          artifacts.value.splice(index, 1)
        }
        break
      }
    }
  }

  /**
   * 断开 WebSocket 连接
   */
  function disconnect() {
    if (ws.value) {
      ws.value.close()
      ws.value = null
    }
  }

  /**
   * 获取工具状态列表
   */
  async function fetchSessionArtifacts(sessionId: string) {
    try {
      const response = await fetch(`/api/v2/tool-state/session/${sessionId}`)
      const data = await response.json()
      if (data.success) {
        artifacts.value = data.artifacts
      }
    } catch (error) {
      console.error('获取工具状态失败:', error)
    }
  }

  /**
   * 更新工具状态
   */
  async function updateArtifact(
    artifactId: string,
    status: string,
    body: Record<string, any>,
    expectedVersion: number
  ): Promise<boolean> {
    try {
      const response = await fetch(`/api/v2/tool-state/${artifactId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: userId,
          status,
          body,
          expectedVersion
        })
      })
      const data = await response.json()
      if (data.success) {
        return true
      } else if (data.reason === 'version-mismatch') {
        console.warn('版本冲突，需要刷新本地状态')
        return false
      }
      return false
    } catch (error) {
      console.error('更新工具状态失败:', error)
      return false
    }
  }

  onMounted(() => {
    connect()
  })

  onUnmounted(() => {
    disconnect()
  })

  return {
    ws,
    artifacts,
    isConnected,
    connect,
    disconnect,
    fetchSessionArtifacts,
    updateArtifact
  }
}
