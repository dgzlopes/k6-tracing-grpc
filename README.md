# k6-tracing-grpc

An **experimental library** to inject trace context headers into gRPC requests made from [Grafana k6](https://github.com/grafana/k6) tests.

This module allows you to start a new trace and propagate it downstream. It behaves similarly to [http-instrumentation-tempo](https://grafana.com/docs/k6/latest/javascript-api/jslib/http-instrumentation-tempo/), but for `k6/net/grpc`.

> :warning: This is experimental and may change/break without notice.

## Example

```js
import grpc from 'k6/net/grpc';
import { Client } from 'https://raw.githubusercontent.com/dgzlopes/k6-tracing-grpc/refs/heads/main/lib.js';
import { check, sleep } from 'k6';

const client = new Client({
  propagator: 'w3c', // or 'jaeger'
  sampling: 1.0,     // 0.0 to 1.0 sampling rate
  logTraceID: true,
});

client.load(null, './example-service/api/hello-service.proto');

export default () => {
  client.connect('127.0.0.1:7777', { plaintext: true });

  const data = { greeting: "Hello world" };
  const response = client.invoke('api.HelloService/SayHello', data);

  check(response, {
    'status is OK': (r) => r && r.status === grpc.StatusOK,
  });

  console.log(JSON.stringify(response.message));

  client.close();
  sleep(1);
};
```

## Example service

This repo includes a fork of the example gRPC service from the [OpenTelemetry Go contrib repo](https://github.com/open-telemetry/opentelemetry-go-contrib/tree/main/instrumentation/google.golang.org/grpc/otelgrpc/example), modified to send traces to Grafana Cloud Traces if the following environment variables are set:

```
GRAFANA_CLOUD_TRACES_ENDPOINT
GRAFANA_CLOUD_API_KEY
GRAFANA_CLOUD_USER
``` 

If these variables are not set, the service will log trace data to stdout.