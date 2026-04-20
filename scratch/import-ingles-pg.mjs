import fs from 'fs';
import { Client } from 'pg';

async function main() {
  const data = JSON.parse(fs.readFileSync('ingles.json', 'utf-8'));
  console.log(`Encontrados ${data.length} recursos de inglés en el JSON.`);

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  try {
    const deleted = await client.query('DELETE FROM resources WHERE subject_id = 4');
    console.log(`Limpieza: se eliminaron ${deleted.rowCount} recursos antiguos.`);

    let inserted = 0;
    for (const item of data) {
      const query = `
        INSERT INTO resources (
          subject_id, unit_id, title, description, activity_type, author, image_url,
          link_url, course, oa_code, oa_description, "order", is_active, views,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
        )
      `;
      const values = [
        item.subject_id,
        item.unit_id,
        item.title,
        item.description,
        item.activity_type,
        item.author,
        item.image_url,
        item.link_url,
        item.course,
        item.oa_code,
        item.oa_description,
        item.order || 0,
        item.is_active === 1 || item.is_active === true,
        item.views || 0,
        new Date(item.created_at),
        new Date(item.updated_at)
      ];
      await client.query(query, values);
      inserted++;
    }

    console.log(`¡Éxito! Se insertaron ${inserted} recursos de inglés en la base de datos.`);

    const finalCount = await client.query('SELECT COUNT(*) FROM resources WHERE subject_id = 4');
    console.log(`Conteo final en Supabase: ${finalCount.rows[0].count}`);

  } finally {
    await client.end();
  }
}

main().catch(console.error);
