/**
 * 前端调试日志系统
 * 用于联调测试时记录和显示组件渲染状态
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  data?: unknown;
}

class DebugLogger {
  private logs: LogEntry[] = [];
  private enabled = true;
  private maxLogs = 500;
  private sequence = 0;

  constructor() {
    // 从 localStorage 读取启用状态
    const stored = localStorage.getItem('debug-logger-enabled');
    this.enabled = stored !== 'false';
  }

  enable(): void {
    this.enabled = true;
    localStorage.setItem('debug-logger-enabled', 'true');
  }

  disable(): void {
    this.enabled = false;
    localStorage.setItem('debug-logger-enabled', 'false');
  }

  private createEntry(level: LogLevel, component: string, message: string, data?: unknown): LogEntry {
    this.sequence += 1;
    return {
      id: `${Date.now()}-${this.sequence}`,
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      data
    };
  }

  private addLog(entry: LogEntry): void {
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // 同时输出到控制台
    if (this.enabled) {
      const prefix = `[${entry.timestamp.split('T')[1].split('.')[0]}] [${entry.component}]`;
      switch (entry.level) {
        case 'debug':
          console.debug(prefix, entry.message, entry.data || '');
          break;
        case 'info':
          console.info(prefix, entry.message, entry.data || '');
          break;
        case 'warn':
          console.warn(prefix, entry.message, entry.data || '');
          break;
        case 'error':
          console.error(prefix, entry.message, entry.data || '');
          break;
      }
    }
  }

  debug(component: string, message: string, data?: unknown): void {
    this.addLog(this.createEntry('debug', component, message, data));
  }

  info(component: string, message: string, data?: unknown): void {
    this.addLog(this.createEntry('info', component, message, data));
  }

  warn(component: string, message: string, data?: unknown): void {
    this.addLog(this.createEntry('warn', component, message, data));
  }

  error(component: string, message: string, data?: unknown): void {
    this.addLog(this.createEntry('error', component, message, data));
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clear(): void {
    this.logs = [];
    console.info('[DebugLogger] Logs cleared');
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // 组件渲染日志
  logComponentMount(component: string, props?: unknown): void {
    this.info(component, 'Mounted', props);
  }

  logComponentUnmount(component: string): void {
    this.info(component, 'Unmounted');
  }

  logComponentUpdate(component: string, oldProps?: unknown, newProps?: unknown): void {
    this.debug(component, 'Updated', { oldProps, newProps });
  }

  // 消息渲染日志
  logMessageRender(type: string, messageId: string, content?: string): void {
    this.debug('MessageRenderer', `Rendering ${type} message: ${messageId}`, {
      type,
      messageId,
      contentLength: content?.length
    });
  }

  // 工具调用日志
  logToolCall(toolName: string, status: string, toolId?: string): void {
    this.info('ToolCall', `Tool ${toolName} - ${status}`, { toolName, status, toolId });
  }

  // 状态变更日志
  logStateChange(component: string, stateName: string, oldValue: unknown, newValue: unknown): void {
    this.debug(component, `State change: ${stateName}`, { oldValue, newValue });
  }
}

// 导出单例
export const logger = new DebugLogger();

// 全局挂载
if (typeof window !== 'undefined') {
  (window as unknown as { logger: DebugLogger }).logger = logger;
}
