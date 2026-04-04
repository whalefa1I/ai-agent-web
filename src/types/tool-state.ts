/**
 * Tool State TypeScript Types
 *
 * 用于 Java 后端工具状态展示的前端类型定义
 */

// 工具状态枚举
export type ToolStatus =
  | 'todo'
  | 'plan'
  | 'pending_confirmation'
  | 'executing'
  | 'completed'
  | 'failed';

// ToolArtifact Header - 工具元数据
export interface ToolArtifactHeader {
  name: string;
  type: string;
  status: ToolStatus;
  version: number;
}

// ToolArtifact Body - 工具状态详情
export interface ToolArtifactBody {
  todo?: string;
  plan?: string[];
  input?: Record<string, any>;
  output?: any;
  error?: string;
  progress?: string;
  confirmation?: {
    requested: boolean;
    granted?: boolean;
  };
  version: number;
}

// ToolArtifact 完整结构
export interface ToolArtifact {
  id: string;
  sessionId: string;
  accountId: string;
  header: ToolArtifactHeader | Record<string, any>;
  body: ToolArtifactBody | Record<string, any>;
  headerVersion: number;
  bodyVersion: number;
  seq: number;
  createdAt: number;
  updatedAt: number;
}

// WebSocket 事件类型
export type ToolStateWebSocketEvent =
  | {
      type: 'new-tool-artifact';
      artifactId: string;
      header: ToolArtifactHeader | Record<string, any>;
      body: ToolArtifactBody | Record<string, any>;
      timestamp: number;
    }
  | {
      type: 'update-tool-artifact';
      artifactId: string;
      header: ToolArtifactHeader | Record<string, any>;
      body: ToolArtifactBody | Record<string, any>;
      timestamp: number;
    }
  | {
      type: 'delete-tool-artifact';
      artifactId: string;
      timestamp: number;
    };

// HTTP API 请求/响应类型
export interface CreateToolArtifactRequest {
  sessionId: string;
  accountId: string;
  toolName: string;
  toolType: string;
  initialStatus?: ToolStatus;
  body?: Record<string, any>;
}

export interface CreateToolArtifactResponse {
  success: boolean;
  artifact: ToolArtifact;
}

export interface UpdateToolArtifactRequest {
  accountId: string;
  status: ToolStatus;
  body?: Record<string, any>;
  expectedVersion: number;
}

export interface UpdateToolArtifactResponse {
  success: boolean;
  artifact?: ToolArtifact;
  reason?: 'version-mismatch';
  currentVersion?: number;
}

export interface GetToolArtifactResponse {
  success: boolean;
  artifact: ToolArtifact;
}

export interface GetSessionToolArtifactsResponse {
  success: boolean;
  artifacts: ToolArtifact[];
}
