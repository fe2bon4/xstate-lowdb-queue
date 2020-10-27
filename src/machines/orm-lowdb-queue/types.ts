import { LowdbSync } from "lowdb";
export type QueueType = "default" | "static";
export interface Dictionary<TItem = any> {
  [key: string]: TItem;
}

export interface LogItem<TItem> {
  id: string;
  payload: TItem;
}

export interface QueueMeta {
  id: string;
  name: string;
  index: number;
  count: number;
}

export interface QueueData<TItem = any> {
  [key: string]: LogItem<TItem>;
}

export interface Queue<T = any> {
  meta: QueueMeta;
  data: QueueData<T>;
}
export interface QueueAdapter {
  id: string;
  name: string;
  type: QueueType;
  adapters: {
    data: LowdbSync<any>;
    meta: LowdbSync<any>;
  };
}

export interface QueueConfig {
  id: string;
  name: string;
  type: QueueType;
  data: string;
  meta: string;
}

export interface Config {
  queues: QueueConfig[];
}

export interface PushRequestParams<TPayload> {
  queue_id: string;
  payload: TPayload;
}

export interface PushResponseParams {
  queue_id: string;
  count: number;
}

export interface PullRequestParams {
  queue_id: string;
}

export type PullResponseParams = PushRequestParams<any>;

export interface PushRequest extends PushRequestParams<any | unknown> {
  type: "PUSH_DATA";
}

export interface PushResponse extends PushResponseParams {
  type: "PUSH_DATA_RESPONSE";
}

export interface PullRequest extends PullRequestParams {
  type: "PULL_DATA";
}

export interface PullResponse extends PullResponseParams {
  type: "PULL_DATA_RESPONSE";
}

export interface MachineContext {
  data_dir: string;
  config_file: string;
  adapter_config: any;
  adapters: Dictionary<QueueAdapter>;
}
