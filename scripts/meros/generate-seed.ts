import { writeFileSync } from "node:fs";
import { seedSql } from "../../lib/meros/db/seed";

writeFileSync("supabase/seed.sql", seedSql());
console.log("Wrote supabase/seed.sql");
