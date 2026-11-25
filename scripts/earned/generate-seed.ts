import { writeFileSync } from "node:fs";
import { seedSql } from "../../lib/earned/db/seed";

writeFileSync("supabase/seed.sql", seedSql());
console.log("Wrote supabase/seed.sql");
