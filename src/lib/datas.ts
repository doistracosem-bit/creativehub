// Utilitários de data em horário LOCAL (evita o erro de 3h do toISOString em inputs)

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO → valor de <input type="datetime-local"> no fuso do aparelho */
export function paraInputLocal(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date(Date.now() + 86400000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** valor de datetime-local → ISO (UTC) */
export function deInputLocal(v: string): string {
  return new Date(v).toISOString();
}

export const inicioDoDia = (d: Date | number | string) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};

export const mesmoDia = (a: Date | number | string, b: Date | number | string) => inicioDoDia(a) === inicioDoDia(b);

export const fmtHora = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export const fmtDataCurta = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

export function fmtDiaRelativo(iso: string): string {
  const diff = Math.round((inicioDoDia(iso) - inicioDoDia(Date.now())) / 86400000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Amanhã';
  if (diff === -1) return 'Ontem';
  const s = new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
  return s.charAt(0).toUpperCase() + s.slice(1).replace('.', '');
}

export function fmtDataLonga(iso: string): string {
  const s = new Date(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const LEMBRETES = [
  { min: 0, label: 'Só na hora de postar' },
  { min: 15, label: '15 min antes' },
  { min: 60, label: '1 hora antes' },
  { min: 180, label: '3 horas antes' },
  { min: 1440, label: '1 dia antes' },
];

export const iniciais = (nome = '') =>
  nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?';
