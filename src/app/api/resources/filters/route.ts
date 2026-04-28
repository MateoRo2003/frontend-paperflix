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

  const [courses, rawUnits, activityTypes] = await Promise.all([
    prisma.resource.findMany({ where: { subjectId: Number(subjectId), isActive: true }, select: { course: true }, distinct: ['course'] }),
    prisma.unit.findMany({ where: unitWhere, select: { id: true, name: true }, orderBy: { order: 'asc' } }),
    prisma.resource.findMany({ where, select: { activityType: true }, distinct: ['activityType'] }),
  ]);

  // Enrich units with oaDescription from their resources
  const unitIds = rawUnits.map(u => u.id);
  const oaRows = unitIds.length > 0
    ? await prisma.resource.findMany({
        where: { unitId: { in: unitIds }, oaDescription: { not: null }, isActive: true },
        select: { unitId: true, oaDescription: true },
        distinct: ['unitId'],
      })
    : [];
  const oaMap = new Map(oaRows.map(r => [r.unitId, r.oaDescription]));
  const units = rawUnits.map(u => ({ ...u, oaDescription: oaMap.get(u.id) ?? null }));

  // Split comma-separated combinations and collect individual unique types
  const actTypeSet = new Set<string>();
  activityTypes.forEach(r => {
    if (r.activityType) r.activityType.split(',').forEach((t: string) => {
      const trimmed = t.trim();
      if (trimmed) actTypeSet.add(trimmed);
    });
  });

  return ok({
    courses: courses.map(r => r.course).filter(Boolean),
    units,
    activityTypes: Array.from(actTypeSet).sort(),
  });
}
