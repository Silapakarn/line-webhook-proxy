declare module 'express-correlation-id' {
  import { RequestHandler } from 'express';
  function correlator(options?: { header?: string }): RequestHandler;
  namespace correlator {
    function getId(): string | undefined;
  }
  export = correlator;
}
