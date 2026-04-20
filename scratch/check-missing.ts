import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  const { rows: units } = await pool.query('SELECT id, name, course FROM units WHERE course IS NULL');
  
  for (const u of units) {
    const { rows: resources } = await pool.query('SELECT course FROM resources WHERE unit_id = $1', [u.id]);
    const resourceCourses = [...new Set(resources.map(r => r.course).filter(Boolean))];
    
    if (resourceCourses.length === 0) {
      console.log(`Unit ${u.id} (${u.name}) has NO resources (or no resources with a course).`);
    } else if (resourceCourses.length > 1) {
      console.log(`Unit ${u.id} (${u.name}) has conflicting courses in its resources: ${resourceCourses.join(', ')}`);
    }
  }
  
  await pool.end();
}

main().catch(console.error);
