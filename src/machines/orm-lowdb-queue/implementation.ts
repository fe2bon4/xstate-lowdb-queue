import lowdb, { LowdbSync } from "lowdb";
import FileSync from "lowdb/adapters/FileSync";

import { MachineOptions, assign } from "xstate";
import {
  MachineContext,
  Config,
  QueueConfig,
  QueueAdapter,
  Dictionary,
  LogItem,
  QueueMeta,
  PushRequest,
  PullRequest,
  PullResponse,
} from "./types";
import path from "path";
import { promises as fsPromises, statSync } from "fs";
import { v4 } from "uuid";
import { respond } from "xstate/lib/actions";

const { mkdir } = fsPromises;

interface AdapterLoadedEvent {
  type: "ADAPTER_LOADED";
  payload: QueueAdapter;
}

interface ConfigLoadedEvent {
  type: "CONFIG_LOADED";
  adapter: any;
}

type EventTypes = AdapterLoadedEvent | ConfigLoadedEvent | any;

const createAdapter = (
  data_dir_path: string,
  file_name: string,
  default_value: any = {}
): LowdbSync<any> => {
  // Prepare Log File
  const data_file_path = path.join(data_dir_path, file_name);
  const data_file_adapter = new FileSync(data_file_path);
  const data_adapter = lowdb(data_file_adapter);

  data_adapter.defaults(default_value).write();
  return data_adapter;
};

export const implementation: MachineOptions<MachineContext, EventTypes> = {
  activities: {},
  delays: {},
  guards: {
    requestHasQueueId: (_, e: PushRequest | PullRequest) =>
      e.queue_id ? true : false,
  },
  actions: {
    // Loggers
    logInitializing: () => console.log(`[Queue-Adapter]: Initializing`),
    logConfigLoaded: () => console.log(`[Queue-Adapter]: Config Loaded`),
    logAdapterLoaded: (_, e: AdapterLoadedEvent) =>
      console.log(`[Queue-Adapter]: AdapterLoaded ${e.payload.name}`),
    logLoadingDone: () => console.log(`[Queue-Adapter]: Loading Done`),
    logReady: () => console.log(`[Queue-Adapter]: Ready`),
    // Assigners
    assignConfigAdapter: assign({
      adapter_config: (_, e: ConfigLoadedEvent) => e.adapter,
    }),
    assignAdapter: assign({
      adapters: (context, e: AdapterLoadedEvent) => ({
        ...context.adapters,
        [e.payload.id]: e.payload,
      }),
    }),
    // Actors
    pushDataToQueue: ({ adapters }, event: PushRequest) => {
      const { queue_id = "default", payload } = event;
      const { meta, data } = adapters[queue_id].adapters;

      const { count, id }: QueueMeta = meta.getState();

      const item: LogItem<unknown> = {
        id: `${id}-${count}`,
        payload,
      };
      data.set(item.id, item).write();
      meta.set("count", count + 1).write();
    },
    acknowledgeQueueItem: ({ adapters }, event: PullRequest) => {
      const { queue_id = "default" } = event;
      const { meta } = adapters[queue_id].adapters;
      const { index, count }: QueueMeta = meta.getState();

      if (index === count) {
        return;
      }

      meta.set("index", index + 1).write();
    },
    // Responders
    respondToPullRequest: respond(
      ({ adapters }, event: PullRequest): PullResponse => {
        const { queue_id } = event;
        const { meta, data } = adapters[queue_id].adapters;

        const { index }: QueueMeta = meta.getState();
        const payload: LogItem<any> = data.get(`${queue_id}-${index}`).value();

        const response: PullResponse = {
          type: "PULL_DATA_RESPONSE",
          queue_id,
          payload: payload || null,
        };

        return response;
      }
    ),
  },
  services: {
    initializeConfig: ({ data_dir, config_file }) => async (send) => {
      const data_dir_path = path.resolve(data_dir);

      try {
        statSync(data_dir_path);
      } catch (e) {
        console.error(
          `[Queue-Adapter]: Data Dir: ${data_dir_path} does not exists`
        );
        await mkdir(data_dir_path, { recursive: true });
      }

      const config_file_path = path.join(data_dir_path, config_file);
      const config_file_adapter = new FileSync(config_file_path);
      const config_adapter = lowdb(config_file_adapter);

      const default_queue_id = v4();
      const default_config: Config = {
        queues: [
          {
            data: `${default_queue_id}-log.json`,
            meta: `${default_queue_id}-meta.json`,
            id: default_queue_id,
            type: "default",
            name: "default",
          },
        ],
      };

      config_adapter.defaults(default_config).write();

      // Update Machine
      send({
        type: "CONFIG_LOADED",
        adapter: config_adapter,
      });
    },
    initializeAdapters: ({ adapter_config, data_dir }) => (send) => {
      const queues = adapter_config.get("queues").value();

      queues.forEach((queue: QueueConfig) => {
        const { data, meta } = queue;

        const data_dir_path = path.resolve(data_dir);

        // Prepare Log File
        const default_log_value: Dictionary<LogItem<any>> = {};
        const data_adapter = createAdapter(
          data_dir_path,
          data,
          default_log_value
        );

        // Prepare Meta File
        const default_meta_value: QueueMeta = {
          count: 0,
          index: 0,
          id: queue.id,
          name: queue.name,
        };
        const meta_adapter = createAdapter(
          data_dir_path,
          meta,
          default_meta_value
        );

        // Prepare Event
        const adapter_event: AdapterLoadedEvent = {
          type: "ADAPTER_LOADED",
          payload: {
            adapters: {
              data: data_adapter,
              meta: meta_adapter,
            },
            type: queue.type,
            id: queue.id,
            name: queue.name,
          },
        };
        // Update Machine
        send(adapter_event);
      });

      send({ type: "ADAPTER_LOADING_DONE" });
    },
  },
};
