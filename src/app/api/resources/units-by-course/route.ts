import { prisma } from '@/lib/prisma';
import { ok } from '@/lib/auth';

export async function GET() {
  const units = await prisma.unit.findMany({
    orderBy: [{ subject: { name: 'asc' } }, { course: 'asc' }, { order: 'asc' }],
    include: { subject: { select: { id: true, name: true, slug: true } } },
  });

  const subjectMap = new Map<number, { subjectId: number; subjectName: string; coursesMap: Map<string, any[]> }>();

  for (const u of units) {
    if (!subjectMap.has(u.subjectId)) {
      subjectMap.set(u.subjectId, {
        subjectId: u.subjectId,
        subjectName: u.subject.name,
        coursesMap: new Map(),
      });
    }

    const sub = subjectMap.get(u.subjectId)!;
    const courseName = u.course || 'Sin curso';

    if (!sub.coursesMap.has(courseName)) {
      sub.coursesMap.set(courseName, []);
    }

    sub.coursesMap.get(courseName)!.push({
      id: u.id,
      name: u.name,
      code: u.code,
      order: u.order,
    });
  }

  const result = Array.from(subjectMap.values()).map(sub => ({
    subjectId: sub.subjectId,
    subjectName: sub.subjectName,
    courses: Array.from(sub.coursesMap.entries()).map(([course, units]) => ({
      course,
      units,
    })),
  }));

  return ok(result);
}
