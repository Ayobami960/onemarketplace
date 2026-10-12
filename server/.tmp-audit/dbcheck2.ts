import "dotenv/config";
import { pool } from "../src/database/clients.js";
const main = async () => {
  try {
    const r = await pool.query("select * from drizzle.__drizzle_migrations order by created_at desc limit 3");
    console.log("migrations:", JSON.stringify((r as any).rows, null, 1));
  } catch (e: any) { console.log("migrations table error:", e.message); }
  await pool.end();
};
main().catch((e) => { console.error("DB_ERROR:", e.message); process.exit(1); });
