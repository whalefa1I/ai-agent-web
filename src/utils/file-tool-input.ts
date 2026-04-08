/**
 * 与 ai-agent-server {@code FileToolArgs} 顺序一致：file_path → filePath → path。
 * Schema 仍以 file_path 为准；其它键仅在执行/展示边界归一。
 */
export function resolveFilePathFromToolInput(
  input: Record<string, unknown> | null | undefined
): string {
  if (!input || typeof input !== 'object') return ''
  const v = input.file_path ?? input.filePath ?? input.path
  if (v == null) return ''
  const s = String(v).trim()
  return s
}

/**
 * 与 ai-agent-server {@code FilesystemPathArgs} 顺序一致：path → file_path → filePath。
 * 用于 glob / grep / ls / FileDelete / local_mkdir 等「搜索根或单一路径」展示。
 */
export function resolveSearchRootPathFromInput(
  input: Record<string, unknown> | null | undefined
): string {
  if (!input || typeof input !== 'object') return ''
  const v = input.path ?? input.file_path ?? input.filePath
  if (v == null) return ''
  const s = String(v).trim()
  return s
}
