import { prisma } from '@/lib/prisma';
import { ok } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const COURSE_ORDER = ['Primero', 'Segundo', 'Tercero', 'Cuarto', 'Quinto', 'Sexto', 'Septimo', 'Séptimo', 'Octavo'];
function sortCourses(courses: string[]): string[] {
  return [...courses].sort((a, b) => {
    const ai = COURSE_ORDER.findIndex(c => c.toLowerCase() === a.toLowerCase());
    const bi = COURSE_ORDER.findIndex(c => c.toLowerCase() === b.toLowerCase());
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

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
    courses: sortCourses(Array.from(sub.coursesMap.keys())).map(course => ({
      course,
      units: sub.coursesMap.get(course)!,
    })),
  }));

  return ok(result);
}
