// Permite importar archivos CSS en TypeScript (Next.js los procesa en tiempo de build)
declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}
