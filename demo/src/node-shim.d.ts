// The vendored market package types its env reader against Node's process.env; Workers expose the same shape under nodejs_compat.
declare namespace NodeJS {
  interface ProcessEnv {
    [key: string]: string | undefined;
  }
}
declare const process: { env: NodeJS.ProcessEnv };
