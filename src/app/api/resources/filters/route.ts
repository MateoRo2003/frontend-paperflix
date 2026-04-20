import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, err } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const subjectId = p.get('subjectId');
  const course = p.get('course');
  if (!subjectId) return err('subjectId requerido');

  const where: Record<string, unknown> = { subjectId: Number(subjectId), isActive: true };
  if (course) where.course = course;

  // Unit filter: if a course is selected, only return units for that course
  const unitWhere: Record<string, unknown> = { subjectId: Number(subjectId) };
  if (course) unitWhere.course = course;

  const [courses, units, activityTypes] = await Promise.all([
    prisma.resource.findMany({ where: { subjectId: Number(subjectId), isActive: true }, select: { course: true }, distinct: ['course'] }),
    prisma.unit.findMany({ where: unitWhere, select: { id: true, name: true }, orderBy: { order: 'asc' } }),
    prisma.resource.findMany({ where, select: { activityType: true }, distinct: ['activityType'] }),
  ]);

  return ok({
    courses: courses.map(r => r.course).filter(Boolean),
    units,
    activityTypes: activityTypes.map(r => r.activityType).filter(Boolean),
  });
}
