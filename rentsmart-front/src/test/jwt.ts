/** Un token con la forma de un JWT (header.contenido.firma) y el rol dado en su contenido, para las pruebas. La firma no se revisa en el navegador. */
export function fakeJwt(role: string, extra: Record<string, unknown> = {}): string {
  const part = (value: unknown) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ sub: 'u1', role, ...extra })}.firma`
}
