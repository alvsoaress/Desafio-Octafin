export function scoreFromCpf(cpf: string): number {
  return Number(cpf.slice(3, 6));
}
