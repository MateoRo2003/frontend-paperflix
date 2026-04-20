import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const { rows } = await pool.query(`
    SELECT s.name as subject, u.course, COUNT(u.id) as unit_count
    FROM units u
    JOIN subjects s ON u.subject_id = s.id
    GROUP BY s.name, u.course
    ORDER BY s.name, u.course NULLS LAST
  `);

  for (const r of rows) {
    console.log(`[${r.subject}] course="${r.course ?? 'NULL'}" → ${r.unit_count} units`);
  }

  await pool.end();
}

main().catch(console.error);
