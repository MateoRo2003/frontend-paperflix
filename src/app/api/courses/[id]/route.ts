import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, ok, err } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  return ok(await prisma.course.update({ where: { id: Number(params.id) }, data: await req.json() }));
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const course = await prisma.course.findUnique({ where: { id: Number(params.id) } });
  if (!course) return err('Curso no encontrado');

  const [unitCount, resourceCount] = await Promise.all([
    prisma.unit.count({ where: { course: course.name } }),
    prisma.resource.count({ where: { course: course.name } }),
  ]);

  if (unitCount > 0 || resourceCount > 0) {
    const parts: string[] = [];
    if (unitCount > 0) parts.push(`${unitCount} unidad${unitCount !== 1 ? 'es' : ''}`);
    if (resourceCount > 0) parts.push(`${resourceCount} recurso${resourceCount !== 1 ? 's' : ''}`);
    return err(`No se puede eliminar "${course.name}": tiene ${parts.join(' y ')} asociados. Elimínalos primero.`);
  }

  await prisma.course.delete({ where: { id: Number(params.id) } });
  return ok({ success: true });
}
