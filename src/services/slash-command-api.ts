/**
 * 斜杠命令 API 服务
 */

const API_BASE = '/api/commands'

export interface SlashCommand {
  name: string
  aliases: string[]
  description: string
  source: string
  enabled: boolean
}

export interface ExecuteCommandResult {
  success: boolean
  type: 'text' | 'error' | 'confirmation' | 'plan_mode'
  content?: string
  message?: string
  code?: string
  title?: string
  planContent?: string
  planFilePath?: string
}

/**
 * 获取所有可用的斜杠命令
 */
export async function fetchSlashCommands(): Promise<SlashCommand[]> {
  const response = await fetch(`${API_BASE}/slash`)
  if (!response.ok) {
    throw new Error('Failed to fetch slash commands')
  }
  return response.json()
}

/**
 * 执行斜杠命令
 *
 * @param command 命令名（不带 /）
 * @param args 命令参数
 */
export async function executeSlashCommand(
  command: string,
  args: string
): Promise<ExecuteCommandResult> {
  const response = await fetch(`${API_BASE}/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      command,
      args
    })
  })

  if (!response.ok) {
    throw new Error('Failed to execute command')
  }

  return response.json()
}
