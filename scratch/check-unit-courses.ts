import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  const { rows: units } = await pool.query('SELECT id, name, course FROM units');
  
  let nullCourseCount = 0;
  let updateableCount = 0;
  let hasCourseCount = 0;

  for (const u of units) {
    if (!u.course) {
      nullCourseCount++;
      const { rows: resources } = await pool.query('SELECT course FROM resources WHERE unit_id = $1', [u.id]);
      const resourceCourses = [...new Set(resources.map(r => r.course).filter(Boolean))];
      
      if (resourceCourses.length === 1) {
        updateableCount++;
      }
    } else {
      hasCourseCount++;
    }
  }

  console.log(`Total units with NO course: ${nullCourseCount}`);
  console.log(`Total units WITH course: ${hasCourseCount}`);
  console.log(`Units that can be auto-assigned a course from resources: ${updateableCount}`);
  
  if (updateableCount > 0) {
     console.log("Fixing them now...");
     for (const u of units) {
       if (!u.course) {
         const { rows: resources } = await pool.query('SELECT course FROM resources WHERE unit_id = $1', [u.id]);
         const resourceCourses = [...new Set(resources.map(r => r.course).filter(Boolean))];
         if (resourceCourses.length === 1) {
           await pool.query('UPDATE units SET course = $1 WHERE id = $2', [resourceCourses[0], u.id]);
         }
       }
     }
     console.log("Fixed!");
  }
  
  await pool.end();
}

main().catch(console.error);
