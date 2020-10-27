import { Machine, interpret } from "xstate";

import machine_spec from "./machines/orm-lowdb-queue";

const { config, implementation } = machine_spec;

const machine_instance = Machine(config, implementation);

const service = interpret(machine_instance);

service.start();

setTimeout(() => {
  service.send({
    type: "ACK_DATA",
    queue_id: "b28011db-4099-4557-8a45-313398e84de8",
    payload: {
      foo: "bar",
    },
  });
}, 2000);
