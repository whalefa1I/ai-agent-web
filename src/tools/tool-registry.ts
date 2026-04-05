/**
 * 工具元数据注册系统
 *
 * 定义每个工具的显示属性：图标、标题、描述提取函数等
 */

// 工具状态枚举
export type ToolState = 'started' | 'in_progress' | 'completed' | 'failed' | 'pending'

// 工具图标类型
export type ToolIconType = 'file' | 'terminal' | 'search' | 'edit' | 'todo' | 'task' | 'web' | 'default'

// 工具元数据接口
export interface ToolMetadata {
  name: string
  displayName: string
  icon: ToolIconType
  // 是否最简化显示（不显示详细内容）
  minimal?: boolean
  // 提取标题函数
  extractTitle?: (input: Record<string, any>) => string
  // 提取描述函数
  extractDescription?: (input: Record<string, any>) => string
  // 提取状态函数
  extractStatus?: (body: Record<string, any>) => string
}

// 图标映射
export const TOOL_ICONS: Record<ToolIconType, string> = {
  file: '📄',
  terminal: '💻',
  search: '🔍',
  edit: '📝',
  todo: '📋',
  task: '🤖',
  web: '🌐',
  default: '🔧'
}

// 工具注册表
export const toolRegistry: Record<string, ToolMetadata> = {
  // Bash 工具
  bash: {
    name: 'bash',
    displayName: '执行命令',
    icon: 'terminal',
    minimal: true,
    extractTitle: (input) => {
      const cmd = input.command as string
      if (!cmd) return '执行命令'
      // 提取命令名
      const firstWord = cmd.split(' ')[0]
      return firstWord.length > 20 ? firstWord.substring(0, 20) + '...' : firstWord
    },
    extractDescription: (input) => {
      const cmd = input.command as string
      return cmd || '执行 Shell 命令'
    },
    extractStatus: (body) => {
      if (body.status === 'completed') return 'completed'
      if (body.status === 'failed') return 'failed'
      if (body.progress) return 'in_progress'
      return 'started'
    }
  },

  // 文件读取工具
  file_read: {
    name: 'file_read',
    displayName: '读取文件',
    icon: 'file',
    minimal: true,
    extractTitle: (input) => {
      const path = input.path as string
      if (!path) return '读取文件'
      // 提取文件名
      const parts = path.split(/[\\/]/)
      return parts[parts.length - 1] || '读取文件'
    },
    extractDescription: (input) => {
      const path = input.path as string
      const offset = input.offset as number
      const limit = input.limit as number
      let desc = path
      if (offset !== undefined) desc += `:${offset}`
      if (limit !== undefined) desc += `+${limit}`
      return desc
    }
  },

  // 文件写入工具
  file_write: {
    name: 'file_write',
    displayName: '写入文件',
    icon: 'edit',
    minimal: false,
    extractTitle: (input) => {
      const path = input.path as string
      if (!path) return '写入文件'
      const parts = path.split(/[\\/]/)
      return parts[parts.length - 1] || '写入文件'
    },
    extractDescription: (input) => {
      const path = input.path as string
      return `写入：${path}`
    }
  },

  // 文件编辑工具
  file_edit: {
    name: 'file_edit',
    displayName: '编辑文件',
    icon: 'edit',
    minimal: false,
    extractTitle: (input) => {
      const path = input.path as string
      if (!path) return '编辑文件'
      const parts = path.split(/[\\/]/)
      return parts[parts.length - 1] || '编辑文件'
    },
    extractDescription: (input) => {
      const path = input.path as string
      return `编辑：${path}`
    }
  },

  // 文件搜索工具（glob）
  glob: {
    name: 'glob',
    displayName: '文件搜索',
    icon: 'search',
    minimal: true,
    extractTitle: (input) => {
      const pattern = input.pattern as string
      return pattern || '文件搜索'
    },
    extractDescription: (input) => {
      const pattern = input.pattern as string
      const path = input.path as string
      if (path) return `${pattern} (in ${path})`
      return pattern
    }
  },

  // 文本搜索工具（grep）
  grep: {
    name: 'grep',
    displayName: '文本搜索',
    icon: 'search',
    minimal: true,
    extractTitle: (input) => {
      const pattern = input.pattern as string
      return `grep: ${pattern?.substring(0, 20) || ''}${pattern?.length > 20 ? '...' : ''}`
    },
    extractDescription: (input) => {
      const pattern = input.pattern as string
      const path = input.path as string
      if (path) return `在 ${path} 中搜索 "${pattern}"`
      return `搜索 "${pattern}"`
    }
  },

  // 待办事项工具
  todo_write: {
    name: 'todo_write',
    displayName: '待办事项',
    icon: 'todo',
    minimal: false,
    extractTitle: (input) => {
      const action = input.action as string
      const content = input.content as string
      if (action === 'create' && content) return `创建：${content.substring(0, 30)}`
      if (action === 'list') return '待办列表'
      if (action === 'update') return '更新待办'
      if (action === 'delete') return '删除待办'
      return '待办事项'
    },
    extractDescription: (input) => {
      const action = input.action as string
      const content = input.content as string
      return `${action}: ${content || ''}`
    }
  },

  // 任务委派工具
  Task: {
    name: 'Task',
    displayName: '委派任务',
    icon: 'task',
    minimal: false,
    extractTitle: (input) => {
      const description = input.description as string
      return description || '委派任务'
    },
    extractDescription: (input) => {
      const prompt = input.prompt as string
      return prompt || '将任务委派给子 Agent'
    }
  }
}

// 获取工具元数据
export function getToolMetadata(toolName: string): ToolMetadata {
  return toolRegistry[toolName] || {
    name: toolName,
    displayName: toolName,
    icon: 'default',
    minimal: false
  }
}
