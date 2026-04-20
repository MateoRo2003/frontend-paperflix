const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const units = await prisma.unit.findMany({ select: { id: true, name: true, course: true } });
  console.log('Total units:', units.length);
  console.log('Units with course:', units.filter(r => r.course).length);
  console.log('Units without course:', units.filter(r => !r.course).length);
  console.log('Sample without course:', units.filter(r => !r.course).slice(0, 5));
}

check().catch(console.error).finally(() => prisma.$disconnect());
