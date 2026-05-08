import { app } from "./app.js";
import { env } from "./config/env.js";
import { ensureAdminUser } from "./db/bootstrap.js";

async function startServer() {
  await ensureAdminUser();

  app.listen(env.port, () => {
    console.log(`API server listening on http://localhost:${env.port}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start API server", error);
  process.exit(1);
});
