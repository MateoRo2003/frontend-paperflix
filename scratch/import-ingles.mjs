import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Leyendo ingles.json...');
  const data = JSON.parse(fs.readFileSync('ingles.json', 'utf-8'));
  
  console.log(`Encontrados ${data.length} recursos de inglés en el JSON.`);
  
  // Limpiar primero si es que hubiera alguno perdido (aunque sabemos que hay 0)
  const deleted = await prisma.resource.deleteMany({
    where: { subjectId: 4 }
  });
  console.log(`Limpieza inicial: se eliminaron ${deleted.count} recursos antiguos de inglés.`);

  const resourcesToInsert = data.map(item => ({
    // omitimos el id para que PostgreSQL lo genere automáticamente y no rompa la secuencia
    subjectId: item.subject_id,
    unitId: item.unit_id,
    title: item.title,
    description: item.description,
    activityType: item.activity_type,
    author: item.author,
    imageUrl: item.image_url,
    linkUrl: item.link_url,
    course: item.course,
    oaCode: item.oa_code,
    oaDescription: item.oa_description,
    order: item.order || 0,
    isActive: item.is_active === 1 || item.is_active === true,
    views: item.views || 0,
    createdAt: new Date(item.created_at),
    updatedAt: new Date(item.updated_at)
  }));

  console.log('Insertando recursos en Supabase...');
  
  // Insertamos masivamente
  const result = await prisma.resource.createMany({
    data: resourcesToInsert,
    skipDuplicates: true
  });

  console.log(`¡Éxito! Se insertaron ${result.count} recursos de inglés en la base de datos.`);
  
  // Verificamos el conteo final
  const finalCount = await prisma.resource.count({
    where: { subjectId: 4 }
  });
  console.log(`Conteo final de recursos de inglés en Supabase: ${finalCount}`);
}

main()
  .catch(e => {
    console.error('Error durante la importación:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
