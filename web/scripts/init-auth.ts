import { getMigrations } from "better-auth/db/migration";

import { auth, authPool, createAuth } from "../lib/auth";

async function main() {
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();

  const email = process.env.SEED_EMAIL ?? "candidato@ventia.test";
  const existing = await authPool.query('SELECT id FROM "user" WHERE email = $1', [email]);
  if (existing.rowCount === 0) {
    await createAuth(true).api.signUpEmail({
      body: {
        name: "Candidato VentIA",
        email,
        password: process.env.SEED_PASSWORD ?? "VentiaDemo2026!",
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => authPool.end());
