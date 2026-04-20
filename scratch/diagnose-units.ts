import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // See ALL units for Ciencias Naturales with their course status
  const { rows } = await pool.query(`
    SELECT 
      u.id,
      u.name,
      u.course,
      u.subject_id,
      s.name as subject_name,
      COUNT(r.id) as resource_count,
      array_agg(DISTINCT r.course) FILTER (WHERE r.course IS NOT NULL) as resource_courses
    FROM units u
    JOIN subjects s ON u.subject_id = s.id
    LEFT JOIN resources r ON r.unit_id = u.id
    GROUP BY u.id, u.name, u.course, u.subject_id, s.name
    ORDER BY s.name, u.course NULLS LAST, u.order
  `);

  for (const r of rows) {
    console.log(`[${r.subject_name}] unit_id=${r.id} | unit.course="${r.course}" | name="${r.name}" | resources=${r.resource_count} | resource_courses=${JSON.stringify(r.resource_courses)}`);
  }

  await pool.end();
}

main().catch(console.error);
