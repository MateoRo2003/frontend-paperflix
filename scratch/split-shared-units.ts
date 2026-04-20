/**
 * split-shared-units.ts
 * ---------------------
 * Splits "shared" units (units that have resources across multiple courses)
 * into separate course-specific units, one per course.
 *
 * Example:
 *   UNIT 1 (id=26, course=null) has resources in Primero, Segundo, Tercero...
 *   → Creates "UNIDAD 1" (course=Primero), "UNIDAD 1" (course=Segundo), etc.
 *   → Reassigns each resource to the correct new unit
 *   → Deletes the original shared unit
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Find all units with course IS NULL that have resources in multiple courses
    const { rows: sharedUnits } = await client.query(`
      SELECT
        u.id,
        u.name,
        u.code,
        u.subject_id,
        u.order,
        array_agg(DISTINCT r.course ORDER BY r.course) FILTER (WHERE r.course IS NOT NULL) as resource_courses
      FROM units u
      JOIN resources r ON r.unit_id = u.id
      WHERE u.course IS NULL
      GROUP BY u.id, u.name, u.code, u.subject_id, u.order
      HAVING COUNT(DISTINCT r.course) > 0
    `);

    console.log(`Found ${sharedUnits.length} shared units to split.\n`);

    let totalCreated = 0;
    let totalReassigned = 0;
    let totalDeleted = 0;

    for (const unit of sharedUnits) {
      const courses: string[] = unit.resource_courses;
      console.log(`Processing unit ${unit.id} "${unit.name}" → ${courses.length} courses: ${courses.join(', ')}`);

      // 2. For each course, create a new course-specific unit
      const courseToNewUnitId: Record<string, number> = {};

      for (const course of courses) {
        const { rows } = await client.query(`
          INSERT INTO units (subject_id, name, code, course, "order", created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
          RETURNING id
        `, [unit.subject_id, unit.name, unit.code, course, unit.order]);

        courseToNewUnitId[course] = rows[0].id;
        totalCreated++;
        console.log(`  → Created unit ${rows[0].id} for course "${course}"`);
      }

      // 3. Reassign resources to the correct new unit
      for (const course of courses) {
        const { rowCount } = await client.query(`
          UPDATE resources
          SET unit_id = $1, updated_at = NOW()
          WHERE unit_id = $2 AND course = $3
        `, [courseToNewUnitId[course], unit.id, course]);
        totalReassigned += rowCount ?? 0;
        console.log(`  → Reassigned ${rowCount} resources (course="${course}") to new unit ${courseToNewUnitId[course]}`);
      }

      // 4. Delete the now-empty original shared unit
      await client.query('DELETE FROM units WHERE id = $1', [unit.id]);
      totalDeleted++;
      console.log(`  → Deleted original shared unit ${unit.id}\n`);
    }

    await client.query('COMMIT');

    console.log('=== Migration complete ===');
    console.log(`Units created:    ${totalCreated}`);
    console.log(`Resources moved:  ${totalReassigned}`);
    console.log(`Old units deleted: ${totalDeleted}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration FAILED — rolled back.', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
