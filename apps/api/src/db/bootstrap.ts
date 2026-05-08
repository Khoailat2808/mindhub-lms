import bcrypt from "bcrypt";

import { env } from "../config/env.js";
import { prisma } from "./prisma.js";

export async function ensureAdminUser() {
  if (!env.adminPassword) {
    console.warn("ADMIN_PASSWORD is not configured. Skipping admin bootstrap.");
    return;
  }

  const passwordHash = await bcrypt.hash(env.adminPassword, env.bcryptSaltRounds);

  await prisma.user.upsert({
    where: { username: env.adminUsername },
    update: {
      email: env.adminEmail,
      passwordHash,
      fullName: env.adminFullName,
      role: "admin"
    },
    create: {
      username: env.adminUsername,
      email: env.adminEmail,
      passwordHash,
      fullName: env.adminFullName,
      role: "admin"
    }
  });

  console.log(`Admin account ready: ${env.adminUsername}`);
}
