/**
 * Tools Module - Clawdbot-style agent tools
 */

export { createExecTool } from './exec';
export type { ExecTool, ExecOptions, ExecResult } from './exec';

export { createWebSearchTool, formatSearchResults } from './web-search';
export type { WebSearchTool, SearchOptions, SearchResult, SearchResponse } from './web-search';

export { createWebFetchTool } from './web-fetch';
export type { WebFetchTool, FetchOptions, FetchResult } from './web-fetch';

export { createSessionTools, formatSessionList } from './sessions';
export type { SessionTools, SessionInfo, HistoryEntry, SendOptions, SendResult } from './sessions';

export { createImageTool } from './image';
export type { ImageTool, ImageSource, AnalyzeOptions, AnalysisResult } from './image';

export { createMessageTool } from './message';
export type {
  MessageTool,
  MessageAction,
  ReactionAction,
  ThreadAction,
  PollAction,
  PinAction,
  EditAction,
  DeleteAction,
} from './message';

export { createBrowserTool } from './browser';
export type { BrowserTool, BrowserConfig, ScreenshotOptions, ClickOptions, PageInfo } from './browser';

export { createCanvasTool, CanvasTemplates } from './canvas';
export type { CanvasTool, CanvasState, CanvasSnapshot, CanvasContentType } from './canvas';

export { createNodesTool } from './nodes';
export type {
  NodesTool,
  DeviceNode,
  NodeType,
  NodeCapability,
  CameraSnapResult,
  ScreenRecordResult,
  LocationResult,
  SystemRunResult,
} from './nodes';

export { createFileTool } from './files';
export type {
  FileTool,
  FileReadOptions,
  FileWriteOptions,
  FileEdit,
  FileEditOptions,
  FileListOptions,
  FileSearchOptions,
} from './files';

export { createShellHistoryTool } from './shell-history';
export type { ShellHistoryTool, ShellHistoryEntry, ShellHistoryOptions } from './shell-history';

export { createGitTool } from './git';
export type { GitTool, GitStatusResult, GitLogEntry } from './git';

export { createEmailTool } from './email';
export type { EmailTool, SendEmailOptions, EmailAddress } from './email';

export { createSmsTool } from './sms';
export type { SmsTool, SmsSendOptions } from './sms';

export { createTranscriptionTool } from './transcription';
export type { TranscriptionTool, TranscribeOptions } from './transcription';

export { createSqlTool } from './sql';
export type { SqlTool, SqlQueryOptions, SqlQueryResult } from './sql';

export { createWebhookTool } from './webhooks';
export type { WebhookTool, RegisterWebhookOptions, WebhookInfo, WebhookTarget } from './webhooks';

export { createDockerTool } from './docker';
export type { DockerTool, DockerRunOptions, DockerContainerInfo, DockerImageInfo } from './docker';
