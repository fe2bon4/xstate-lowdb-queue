import { MachineConfig } from "xstate";
import { MachineContext } from "./types";

export const config: MachineConfig<MachineContext, any, any> = {
  context: {
    data_dir: `./data/`,
    config_file: `config.json`,
    adapter_config: null,
    adapters: {},
  },
  initial: "start",
  states: {
    start: {
      initial: "initialize_config",
      entry: ["logInitializing"],
      onDone: "ready",
      states: {
        intialize_adapters: {
          invoke: {
            id: "initializeAdapters",
            src: "initializeAdapters",
          },
          on: {
            ADAPTER_LOADED: {
              actions: ["assignAdapter", "logAdapterLoaded"],
            },
            ADAPTER_LOADING_DONE: {
              actions: ["logLoadingDone"],
              target: "done",
            },
          },
        },
        done: {
          type: "final",
        },
        initialize_config: {
          invoke: {
            id: "initializeConfig",
            src: "initializeConfig",
          },
          on: {
            CONFIG_LOADED: {
              actions: ["assignConfigAdapter", "logConfigLoaded"],
              target: "intialize_adapters",
            },
          },
        },
      },
    },
    ready: {
      entry: ["logReady"],
      type: "parallel",
      states: {
        ticker_service: {
          initial: "tock",
          states: {
            tock: {
              after: {
                3600: "tick",
              },
            },
            tick: {
              after: {
                3600: "tock",
              },
            },
          },
        },
        push_service: {
          initial: "idle",
          states: {
            idle: {
              on: {
                PUSH_DATA: [
                  {
                    actions: ["pushDataToQueue", "respondToPushRequest"],
                  },
                ],
              },
            },
          },
        },
        acknowledge_service: {
          initial: "idle",
          states: {
            idle: {
              on: {
                ACK_DATA: [
                  {
                    actions: ["acknowledgeQueueItem", "respondToPullRequest"],
                  },
                ],
              },
            },
          },
        },
        pull_service: {
          initial: "idle",
          states: {
            idle: {
              on: {
                PULL_DATA: [
                  {
                    actions: ["respondToPullRequest"],
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
};
