import { useRef, useState } from 'react';
import { Download, Plus, Upload, X } from 'lucide-react';
import { MAX_TIKTOK_POSTS, parseTikTok, TIKTOK_FORMATS, TIKTOK_TIMEZONES, todayInZone } from '../../../../supabase/functions/_shared/tiktok';
import type { TikTokInput, TikTokPost, TikTokZone } from '../../../../supabase/functions/_shared/tiktok';
import { parseTikTokCsv, TIKTOK_CSV_LIMIT, TIKTOK_TEMPLATE } from '../../../lib/tiktokCsv';
import { Field, Notice } from '../traffic/TrafficForms';

const template = 'data:text/csv;charset=utf-8,' + encodeURIComponent('\uFEFF' + TIKTOK_TEMPLATE);
const types = [['likes', 'Curtidas'], ['comments', 'Comentários'], ['shares', 'Compartilhamentos'], ['saves', 'Salvamentos']] as const;
const message = (error: unknown) => error instanceof Error ? error.message : 'Tente novamente.';

export function TikTokForm({ save }: { save: (input: TikTokInput, id: string) => Promise<void> }) {
  const [handle, setHandle] = useState('');
  const [timezone, setTimezone] = useState<TikTokZone>('America/Sao_Paulo');
  const [reference, setReference] = useState(() => todayInZone('America/Sao_Paulo'));
  const [mode, setMode] = useState<TikTokInput['mode']>('lifetime');
  const [posts, setPosts] = useState<{ id: string; data: TikTokPost }[]>([]);
  const [input, setInput] = useState<'csv' | 'manual'>('csv');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const draftId = useRef('');
  const draftContent = useRef('');

  function append(rows: TikTokPost[]) {
    if (posts.length + rows.length > MAX_TIKTOK_POSTS) throw new Error(`O limite é de ${MAX_TIKTOK_POSTS} publicações por análise.`);
    setPosts((current) => [...current, ...rows.map((data) => ({ id: crypto.randomUUID(), data }))]);
  }

  async function readFile(file?: File) {
    if (!file || reading) return;
    setReading(true);
    setError('');
    try {
      if (file.size > TIKTOK_CSV_LIMIT) throw new Error('O CSV excede 180 KB.');
      append(parseTikTokCsv(await file.text()));
    } catch (failure) {
      setError(message(failure));
    } finally {
      setReading(false);
    }
  }

  async function analyze() {
    setError('');
    setBusy(true);
    try {
      const dataset = parseTikTok({ handle, timezone, reference, mode, posts: posts.map((post) => post.data) });
      const encoded = JSON.stringify(dataset);
      if (encoded !== draftContent.current) {
        draftId.current = crypto.randomUUID();
        draftContent.current = encoded;
      }
      await save(dataset, draftId.current);
    } catch (failure) {
      setError(message(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="cartao space-y-5 p-4 sm:p-6" aria-labelledby="tiktok-form-title">
      <div>
        <h2 id="tiktok-form-title" className="text-lg font-extrabold text-marinho">Nova análise de conta</h2>
        <p className="mt-1 text-sm text-text-muted">Use métricas do TikTok Studio. O @ identifica a conta e permite conferir os links informados.</p>
      </div>
      <fieldset className="grid min-w-0 gap-3 sm:grid-cols-2" disabled={busy || reading}>
        <Field label="@ ou link do perfil"><input className="campo" value={handle} maxLength={180} autoCapitalize="none"
          onChange={(event) => setHandle(event.target.value)} placeholder="@perfil" /></Field>
        <Field label="Fuso das datas dos posts"><select className="campo" value={timezone} onChange={(event) => {
          const zone = event.target.value as TikTokZone;
          setTimezone(zone);
          if (reference === todayInZone(timezone)) setReference(todayInZone(zone));
        }}>
          {Object.entries(TIKTOK_TIMEZONES).map(([zone, label]) => <option key={zone} value={zone}>{label}</option>)}
        </select></Field>
        <Field label="Data de referência"><input className="campo" type="date" value={reference} max={todayInZone(timezone)}
          onChange={(event) => setReference(event.target.value)} /></Field>
        <Field label="Período das métricas"><select className="campo" value={mode} onChange={(event) => setMode(event.target.value as TikTokInput['mode'])}>
          <option value="lifetime">Total acumulado por post</option>
          <option value="seven-day">Primeiros 7 dias de cada post</option>
        </select></Field>
      </fieldset>
      <p className="text-xs leading-relaxed text-text-muted">{mode === 'lifetime'
        ? 'Posts mais antigos tiveram mais tempo para acumular visualizações. Este modo apresenta resultados exploratórios e não calcula VPS.'
        : 'Informe todas as métricas no 7º dia de cada post. Posts com menos de sete dias na data de referência ficam fora.'}</p>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Como inserir publicações">
        <button type="button" className={input === 'csv' ? 'btn-primario' : 'btn-secundario'}
          aria-pressed={input === 'csv'} onClick={() => setInput('csv')}>Importar CSV</button>
        <button type="button" className={input === 'manual' ? 'btn-primario' : 'btn-secundario'}
          aria-pressed={input === 'manual'} onClick={() => setInput('manual')}>Inserir manualmente</button>
      </div>
      {input === 'csv' ? (
        <div className="rounded-2xl border border-dashed border-border-subtle bg-canvas p-4">
          <p className="text-sm text-text-muted">Use o modelo. Preencha a data e hora no fuso escolhido, o formato, as visualizações e se houve impulsionamento.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a className="btn-secundario" href={template} download="modelo-tiktok.csv"><Download size={16} /> Baixar modelo</a>
            <label className="btn-secundario relative cursor-pointer focus-within:ring-2 focus-within:ring-accent-glow">
              <Upload size={16} /> {reading ? 'Lendo CSV…' : 'Selecionar arquivo CSV'}
              <input type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" className="sr-only" disabled={busy || reading}
                onChange={(event) => { void readFile(event.target.files?.[0]); event.target.value = ''; }} />
            </label>
          </div>
        </div>
      ) : <ManualPostForm disabled={busy || reading} maxDate={reference} add={(row) => {
        setError('');
        append([row]);
      }} />}

      {posts.length > 0 && (
        <details className="rounded-2xl border border-border-subtle p-3">
          <summary className="cursor-pointer text-sm font-bold text-marinho">{posts.length} {posts.length === 1 ? 'publicação na análise' : 'publicações na análise'}</summary>
          <ul className="mt-3 max-h-60 divide-y divide-border-subtle overflow-y-auto">
            {posts.map(({ id, data }, index) => <li key={id} className="flex items-center justify-between gap-2 py-1.5">
              <span className="min-w-0 break-words text-xs text-text-muted">
                {data.published.replace('T', ' ')} · {data.format}
                {' · '}{data.views.toLocaleString('pt-BR')} visualizações{data.boosted ? ' · impulsionado' : ''}
              </span>
              <button type="button" className="grid size-10 shrink-0 place-items-center rounded-lg text-text-muted hover:bg-canvas"
                aria-label={`Remover publicação ${index + 1}`} disabled={busy || reading}
                onClick={() => setPosts((rows) => rows.filter((row) => row.id !== id))}><X size={17} /></button>
            </li>)}
          </ul>
        </details>
      )}
      {error && <Notice>{error}</Notice>}
      <button type="button" className="btn-primario min-h-11" disabled={busy || reading || !posts.length} onClick={() => void analyze()}>
        {busy ? 'Calculando…' : 'Calcular e salvar análise'}
      </button>
    </section>
  );
}

function ManualPostForm({ add, disabled, maxDate }: { add: (row: TikTokPost) => void; disabled: boolean; maxDate: string }) {
  const [error, setError] = useState('');
  return (
    <form className="rounded-2xl bg-canvas p-4" onSubmit={(event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      const number = (name: string) => data.get(name) ? Number(data.get(name)) : null;
      try {
        add({
          published: String(data.get('published')), format: String(data.get('format')), views: number('views')!,
          likes: number('likes'), comments: number('comments'), shares: number('shares'), saves: number('saves'),
          boosted: data.get('boosted') === 'yes', url: String(data.get('url')).trim() || null,
        });
        setError('');
        form.reset();
      } catch (failure) {
        setError(message(failure));
      }
    }}>
      <fieldset disabled={disabled} className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Data e hora da publicação"><input className="campo" name="published" type="datetime-local"
          max={maxDate ? maxDate + 'T23:59' : undefined} required /></Field>
        <Field label="Formato"><select className="campo" name="format" required>
          {TIKTOK_FORMATS.map((format) => <option key={format}>{format}</option>)}
        </select></Field>
        <Field label="Visualizações"><input className="campo" name="views" type="number" min="0" step="1" max="1000000000000" required /></Field>
        {types.map(([name, label]) => <Field label={`${label} (opcional)`} key={name}>
          <input className="campo" name={name} type="number" min="0" step="1" max="1000000000000" />
        </Field>)}
        <Field label="Impulsionado?"><select className="campo" name="boosted"><option value="no">Não</option><option value="yes">Sim</option></select></Field>
        <Field label="Link do post (opcional)"><input className="campo" name="url" type="url" maxLength={400} /></Field>
      </fieldset>
      {error && <p className="mt-3 text-sm text-red-800" role="alert">{error}</p>}
      <button className="btn-secundario mt-4 min-h-11" disabled={disabled} type="submit"><Plus size={16} /> Adicionar publicação</button>
    </form>
  );
}
