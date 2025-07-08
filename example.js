import grpc from 'k6/net/grpc';
import { Client } from './lib.js';
import { check, sleep } from 'k6';

const client = new Client({
  propagator: 'w3c',
  sampling: 1.0,
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