import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins";
import { Pool } from "pg";

export const authPool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });

export function createAuth(allowSignUp = false) {
  return betterAuth({
    database: authPool,
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [process.env.BETTER_AUTH_URL!],
    emailAndPassword: { enabled: true, disableSignUp: !allowSignUp },
    plugins: [
      jwt({
        jwks: { keyPairConfig: { alg: "EdDSA", crv: "Ed25519" } },
        jwt: {
          issuer: process.env.BETTER_AUTH_URL,
          audience: "ventia-challenge-api",
          expirationTime: "5m",
        },
      }),
    ],
  });
}

export const auth = createAuth();
