export enum TaskState {
  SUBMITTED = 'submitted',
  WORKING = 'working',
  INPUT_REQUIRED = 'input-required',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface TextPart {
  kind: 'text';
  text: string;
}

export interface Message {
  messageId: string;
  taskId?: string;
  role: 'user' | 'agent';
  parts: TextPart[];
  metadata?: Record<string, any>;
}

export interface TaskStatus {
  state: TaskState;
  message?: Message;
}

export interface Task {
  id: string;
  contextId?: string;
  status: TaskStatus;
  metadata?: Record<string, any>;
  artifacts?: any[];
}

export interface RequestContext {
  taskId: string;
  contextId?: string;
  currentTask?: Task;
  message: Message;
}

export interface EventQueue {
  enqueueEvent(event: Task): Promise<void>;
}
