import "dotenv/config";
import { pool } from "../src/database/clients.js";
const main = async () => {
  const tables = await pool.query(`select table_name from information_schema.tables where table_schema='public' order by 1`);
  console.log("tables:", (tables as any).rows.map((t: any) => t.table_name).join(", "));
  const acc = await pool.query("select count(*)::int as n from accounts");
  console.log("accounts:", (acc as any).rows[0].n);
  const cm = await pool.query("select count(*)::int as n from client_metadata");
  console.log("client_metadata:", (cm as any).rows[0].n);
  const fm = await pool.query("select count(*)::int as n from freelancer_metadata");
  console.log("freelancer_metadata:", (fm as any).rows[0].n);
  await pool.end();
};
main().catch((e) => { console.error("DB_ERROR:", e.message); process.exit(1); });
