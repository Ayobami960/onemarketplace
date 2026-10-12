import "dotenv/config";
import { pool } from "../src/database/clients.js";
const main = async () => {
  const r = await pool.query(`select email, role, (email_verified_at is not null) as verified, "isOnboardingComplete" as onboarded from accounts`);
  console.table((r as any).rows);
  await pool.end();
};
main().catch((e) => { console.error("DB_ERROR:", e.message); process.exit(1); });
