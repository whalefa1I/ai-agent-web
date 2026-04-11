#!/usr/bin/env node

/**
 * WebSocket Stream Test CLI
 *
 * 用于测试后端 WebSocket 流式输出功能
 * 使用方法:
 *   node test-ws-stream.js "你的测试消息"
 *   node test-ws-stream.js --help
 */

import WebSocket from 'ws'

const WS_URL = process.env.WS_URL || 'ws://localhost:8081/ws/agent/test-token'

// 解析命令行参数
const args = process.argv.slice(2)
const helpFlag = args.includes('--help') || args.includes('-h')
const messageArg = args.find(arg => !arg.startsWith('--'))

if (helpFlag || !messageArg) {
  console.log(`
WebSocket 流式测试工具

用法:
  node test-ws-stream.js [选项] "测试消息"

选项:
  --help, -h     显示帮助信息
  --url <URL>    指定 WebSocket URL (默认：ws://localhost:8081/ws/agent/test-token)

示例:
  node test-ws-stream.js "你好，请简单回复"
  node test-ws-stream.js --url ws://127.0.0.1:8080/ws/agent/my-token "请思考后回答"
  $env:WS_URL="ws://localhost:8081/ws/agent/test-token"; node test-ws-stream.js "你好"

消息类型说明:
  - RESPONSE_START: 响应开始
  - REASONING_DELTA: reasoning 内容增量（思考过程）
  - TEXT_DELTA: 文本内容增量
  - TOOL_CALL: 工具调用通知
  - RESPONSE_COMPLETE: 响应完成
`)
  process.exit(0)
}

// 自定义 URL
const customUrl = args.find((_, i) => args[i - 1] === '--url') || WS_URL

console.log('='.repeat(60))
console.log('WebSocket 流式测试工具')
console.log('='.repeat(60))
console.log('URL:', customUrl)
console.log('消息:', messageArg)
console.log('时间:', new Date().toLocaleString('zh-CN'))
console.log('='.repeat(60))
console.log()

// 创建 WebSocket 连接
const ws = new WebSocket(customUrl)

const stats = {
  reasoningCount: 0,
  textCount: 0,
  toolCallCount: 0,
  inputTokens: 0,
  outputTokens: 0,
  startTime: Date.now()
}

let responseStartReceived = false
let completeReceived = false

ws.on('open', () => {
  console.log('[连接] WebSocket 已连接')
  console.log()

  // 发送测试消息
  const message = {
    type: 'USER_MESSAGE',
    content: messageArg,
    requestId: `test_${Date.now()}`
  }
  ws.send(JSON.stringify(message))
  console.log('[发送] 用户消息:', message.requestId)
  console.log()
})

ws.on('message', (data) => {
  const message = JSON.parse(data.toString())
  const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false }) + '.' + Date.now().toString().slice(-3)

  switch (message.type) {
    case 'RESPONSE_START':
      responseStartReceived = true
      console.log(`[${timestamp}] [RESPONSE_START]`)
      console.log(`  Turn ID: ${message.turnId}`)
      console.log(`  Request ID: ${message.requestId}`)
      break

    case 'REASONING_DELTA':
      stats.reasoningCount++
      console.log(`[${timestamp}] [REASONING_DELTA] #${stats.reasoningCount}`)
      console.log(`  ${message.delta.substring(0, 100)}${message.delta.length > 100 ? '...' : ''}`)
      break

    case 'TEXT_DELTA':
      stats.textCount++
      console.log(`[${timestamp}] [TEXT_DELTA] #${stats.textCount}`)
      console.log(`  ${message.delta.substring(0, 100)}${message.delta.length > 100 ? '...' : ''}`)
      break

    case 'TOOL_CALL':
      stats.toolCallCount++
      console.log(`[${timestamp}] [TOOL_CALL] ${message.status}`)
      console.log(`  工具：${message.toolName}`)
      if (message.toolCallId) console.log(`  ID: ${message.toolCallId}`)
      if (message.input) console.log(`  输入：${JSON.stringify(message.input).substring(0, 100)}...`)
      if (message.output) console.log(`  输出：${message.output.substring(0, 100)}...`)
      if (message.error) console.log(`  错误：${message.error}`)
      if (message.durationMs) console.log(`  耗时：${message.durationMs}ms`)
      break

    case 'RESPONSE_COMPLETE':
      completeReceived = true
      stats.inputTokens = message.inputTokens || 0
      stats.outputTokens = message.outputTokens || 0
      const duration = Date.now() - stats.startTime
      console.log(`[${timestamp}] [RESPONSE_COMPLETE]`)
      console.log(`  内容：${message.content?.substring(0, 100)}${message.content?.length > 100 ? '...' : ''}`)
      console.log(`  输入 Tokens: ${stats.inputTokens}`)
      console.log(`  输出 Tokens: ${stats.outputTokens}`)
      console.log(`  总耗时：${duration}ms`)
      console.log()
      break

    case 'ERROR':
      console.log(`[${timestamp}] [ERROR] ${message.code}: ${message.message}`)
      console.log()
      break

    default:
      console.log(`[${timestamp}] [未知消息] ${message.type}`)
  }
})

ws.on('close', (code, reason) => {
  console.log()
  console.log('='.repeat(60))
  console.log('[断开] 连接已关闭')
  console.log(`  Code: ${code}`)
  if (reason) console.log(`  Reason: ${reason}`)
  console.log()
  console.log('统计信息:')
  console.log(`  Reasoning 消息：${stats.reasoningCount}`)
  console.log(`  文本消息：${stats.textCount}`)
  console.log(`  工具调用：${stats.toolCallCount}`)
  console.log(`  输入 Tokens: ${stats.inputTokens}`)
  console.log(`  输出 Tokens: ${stats.outputTokens}`)
  console.log(`  总耗时：${Date.now() - stats.startTime}ms`)
  console.log('='.repeat(60))

  const duration = Date.now() - stats.startTime
  const exitCode = (!completeReceived && duration > 30000) ? 1 : 0
  process.exit(exitCode)
})

ws.on('error', (error) => {
  console.log()
  console.log('='.repeat(60))
  console.log('[错误] WebSocket 错误:')
  console.log(error.message || error)
  console.log('='.repeat(60))
  process.exit(1)
})

// 设置超时
setTimeout(() => {
  if (!completeReceived) {
    console.log()
    console.log('='.repeat(60))
    console.log('[超时] 30 秒未收到完整响应，自动退出')
    console.log('='.repeat(60))
    ws.close()
    process.exit(1)
  }
}, 30000)
