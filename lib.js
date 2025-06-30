const grpc = require("k6/net/grpc");
const crypto = require("k6/crypto");
const execution = require("k6/execution");

const digits = "0123456789abcdef";

const propagatorMap = {
  w3c: (sampler, traceID) => ({
    traceparent: `00-${traceID}-${randHexString(16)}-${sampler() ? "01" : "00"}`
  }),
  jaeger: (sampler, traceID) => ({
    "uber-trace-id": `${traceID}:${randHexString(8)}:0:${sampler() ? "1" : "0"}`
  }),
};

function randHexString(n) {
  let result = '';
  for (let i = 0; i < n; ++i) {
    result += digits[Math.floor(Math.random() * 16)];
  }
  return result;
}

function newTraceID() {
  let result = "dc0718";
  let now = Date.now();
  const ns = longToByteArray(now * 1e6);
  let n = 3, i = 0;

  for (; i < ns.byteLength; i++) {
    if (ns[i] === 0) continue;
    break;
  }
  for (; i < ns.byteLength; i++) {
    result += ns[i].toString(16).padStart(2, "0");
    n++;
  }

  const rand = new Uint8Array(crypto.randomBytes(16 - n));
  for (i = 0; i < rand.length; i++) {
    result += rand[i].toString(16).padStart(2, "0");
  }

  return result;
}

function longToByteArray(long) {
  const byteArray = new Uint8Array(8);
  for (let index = byteArray.byteLength - 1; index >= 0; index--) {
    const byte = long % 256;
    byteArray[index] = byte;
    long = (long - byte) / 256;
    if (long < 1) break;
  }
  return byteArray;
}

function newProbalisticSampler(rate) {
  if (typeof rate === 'undefined') rate = 1;
  if (rate <= 0) return () => false;
  if (rate >= 1) return () => true;
  return () => Math.random() < rate;
}

class Client {
  #sampler;
  #propagator;
  #client;

  constructor(opts) {
    this.#sampler = newProbalisticSampler(opts.sampling);
    this.#propagator = propagatorMap[opts.propagator];
    if (!this.#propagator) throw new Error("Unknown propagator: " + opts.propagator);
    this.#client = new grpc.Client();
  }

  load(paths, root) {
    return this.#client.load(paths, root);
  }

  connect(addr, opts) {
    return this.#client.connect(addr, opts);
  }

  close() {
    return this.#client.close();
  }

  invoke(method, request, params = {}) {
    const traceID = newTraceID();
    const headers = this.#propagator(this.#sampler, traceID);
    if (!params.metadata) params.metadata = {};
    Object.assign(params.metadata, headers);

    if (!execution.vu.metrics.metadata) {
      execution.vu.metrics.metadata = {};
    }

    try {
      execution.vu.metrics.metadata["trace_id"] = traceID;
      console.log(`Trace ID: ${traceID}`);
      return this.#client.invoke(method, request, params);
    } finally {
      delete execution.vu.metrics.metadata["trace_id"];
    }
  }

  get client() {
    return this.#client;
  }
}

module.exports = {
  default: { Client },
  __esModule: true,
  Client
};
