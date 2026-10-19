import type { Express } from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

export type TestServer = {
  baseUrl: string;
  close: () => Promise<void>;
};

/** Starts an Express app on an ephemeral port for real HTTP-level tests. */
export async function startTestServer(app: Express): Promise<TestServer> {
  const server: Server = app.listen(0);
  await new Promise<void>((resolve) => {
    server.once("listening", () => resolve());
  });

  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      }),
  };
}
