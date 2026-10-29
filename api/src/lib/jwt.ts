import jwt, { type SignOptions } from "jsonwebtoken";

export interface AccessTokenPayload { sub: string; type: "access"; tv: number }
export interface RefreshTokenPayload { sub: string; type: "refresh"; tv: number }

// Secrets are read lazily so `next build` works without them; they are required at request time.
function secrets() {
  const access = process.env.JWT_ACCESS_SECRET;
  const refresh = process.env.JWT_REFRESH_SECRET;
  if (!access || !refresh || access.length < 32 || refresh.length < 32) {
    throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set (32+ characters each).");
  }
  return { access, refresh };
}

export const signAccessToken = (userId: string, tv: number) =>
  jwt.sign({ sub: userId, type: "access", tv } satisfies AccessTokenPayload, secrets().access, { expiresIn: process.env.JWT_ACCESS_EXPIRES || "15m" } as SignOptions);

export const signRefreshToken = (userId: string, tv: number) =>
  jwt.sign({ sub: userId, type: "refresh", tv } satisfies RefreshTokenPayload, secrets().refresh, { expiresIn: process.env.JWT_REFRESH_EXPIRES || "30d" } as SignOptions);

export function verifyAccessToken(token: string): AccessTokenPayload {
  const d = jwt.verify(token, secrets().access, { algorithms: ["HS256"] }) as AccessTokenPayload;
  if (d.type !== "access") throw new Error("WRONG_TOKEN_TYPE");
  return d;
}
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const d = jwt.verify(token, secrets().refresh, { algorithms: ["HS256"] }) as RefreshTokenPayload;
  if (d.type !== "refresh") throw new Error("WRONG_TOKEN_TYPE");
  return d;
}
