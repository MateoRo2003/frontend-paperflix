import { prisma } from '@/lib/prisma';
import { ok } from '@/lib/auth';

export async function GET() {
  const settings = await prisma.setting.findMany();
  const result = Object.fromEntries(settings.map(s => [s.key, s.value]));
  return ok(result);
}
