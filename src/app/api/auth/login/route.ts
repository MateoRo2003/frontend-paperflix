import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signToken, ok, err } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) return err('Email y contraseña requeridos');

  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!admin) return err('Credenciales inválidas', 401);

  const valid = await bcrypt.compare(password, admin.password);
  if (!valid) return err('Credenciales inválidas', 401);

  const token = await signToken({ sub: admin.id, email: admin.email });
  return ok({ token, admin: { id: admin.id, email: admin.email, name: admin.name } });
}
