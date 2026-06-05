interface IJWTPayloadToken {
  realm_access?: {
    roles?: string[];
  };
  groups?: string[];
  channel_code?: string;
  email?: string;
}

declare global {
  namespace Express {
    interface Request {
      payload?: IJWTPayloadToken;
      rawBody?: string;
    }
  }
}
export {};
