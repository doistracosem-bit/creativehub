import { useState } from 'react';
import { CalendarPlus, Copy, Download, Layers, RefreshCw } from 'lucide-react';
import { FORMATS } from '../../../supabase/functions/_shared/briefing';
import type { BriefingFormat } from '../../../supabase/functions/_shared/briefing';
import type { DesignBriefing } from '../../types';
import type { UIContextType } from '../../context/UIContext';
import { exportPhotoshopJson } from '../../services/aiService';

const roleLabels = { CAPA: 'Capa', CONTEUDO: 'Conteúdo', CTA_FINAL: 'Fechamento' };
const calendarFormats: Record<BriefingFormat, string> = {
  CARROSSEL_4x5: 'Carrossel Instagram', STORY_9x16: 'Stories Interativos', POST_1x1: 'Post Estático',
};

function relativeLuminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => {
    const level = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return level <= 0.04045 ? level / 12.92 : ((level + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function previewTextColor(background: string, text: string) {
  const bg = relativeLuminance(background);
  const fg = relativeLuminance(text);
  if ((Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05) >= 4.5) return text;
  return bg > 0.179 ? '#000000' : '#FFFFFF';
}

export function PreviewPlaceholder({ busy, format }: { busy: boolean; format: BriefingFormat }) {
  const spec = FORMATS[format];
  return (
    <div className="cartao copilot-result">
      <div className="copilot-result-heading">
        <h3>Prévia da campanha</h3>
        <small>{spec.width} × {spec.height} px</small>
      </div>
      <div className="copilot-placeholder">
        <div className="copilot-placeholder-icon" aria-hidden="true"><Layers size={30} strokeWidth={1.4} /></div>
        <h4>{busy ? 'Criando o roteiro' : 'Seu roteiro aparece aqui'}</h4>
        <p role="status">{busy ? 'O Gemini está preparando a estratégia e as peças.' : 'O briefing inclui direção de arte, texto de cada peça e legenda.'}</p>
      </div>
    </div>
  );
}

export function BriefingResult({ briefing, abrirPost, onVariation, busy }: {
  briefing: DesignBriefing;
  abrirPost: UIContextType['abrirPost'];
  onVariation: () => void;
  busy: boolean;
}) {
  const [active, setActive] = useState(0);
  const [notice, setNotice] = useState('');
  const spec = FORMATS[briefing.format];
  const slide = briefing.slides[active];
  const palette = briefing.color_palette;
  const caption = [briefing.caption, briefing.hashtags.join(' ')].filter(Boolean).join('\n\n');

  async function copy(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(message);
    } catch {
      setNotice('O navegador não permitiu a cópia.');
    }
  }

  function reviewCalendarPost() {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(18, 0, 0, 0);
    abrirPost(null, {
      project_id: briefing.projectId, client_name: briefing.client || briefing.niche, format: calendarFormats[briefing.format],
      headline: briefing.magnetic_hook, copy_text: caption, status: 'CRIANDO',
      scheduled_for: date.toISOString(), assets_ready: false,
    });
  }

  return (
    <div className="cartao copilot-result">
      <div className="copilot-result-heading copilot-campaign-heading">
        <div>
          <p className="copilot-result-context">{[briefing.client, briefing.niche, briefing.goal].filter(Boolean).join(' · ')}</p>
          <h3>{briefing.campaign_title}</h3>
        </div>
        <small>{briefing.model ? 'Gerado com Gemini' : 'Exemplo de demonstração'}</small>
      </div>

      <div className="copilot-art-section">
        <div className="copilot-art-matte">
          <div className="copilot-art" data-format={briefing.format}
            style={{ aspectRatio: `${spec.width} / ${spec.height}`, background: palette.background, color: previewTextColor(palette.background, palette.text) }}>
            <div className="copilot-art-shape" style={{ backgroundColor: palette.primary_accent }} aria-hidden="true" />
            <div className="copilot-art-line" style={{ borderColor: palette.glow_accent }} aria-hidden="true" />
            <div className="copilot-art-text">
              <h4>{slide.headline}</h4>
              <p>{slide.body_text}</p>
              {briefing.slides.length === 1 && <p className="copilot-art-cta">{briefing.call_to_action}</p>}
            </div>
          </div>
        </div>
        <div className="copilot-art-meta"><span>Simulação da composição</span><span>{spec.width} × {spec.height} px</span></div>

        {briefing.slides.length > 1 && (
          <div className="copilot-slide-list" role="group" aria-label="Selecionar quadro">
            {briefing.slides.map((item, index) => (
              <button key={item.slide_number} type="button" aria-pressed={index === active} onClick={() => setActive(index)}>
                <strong>{item.slide_number}</strong> {roleLabels[item.role]}
              </button>
            ))}
          </div>
        )}
        <div className="copilot-visual-note">
          <h4>Direção de arte</h4>
          <p>{slide.visual_direction}</p>
        </div>
      </div>

      <div className="copilot-details">
        <details>
          <summary>Texto do quadro {slide.slide_number}</summary>
          <p><strong>{slide.headline}</strong></p>
          <p>{slide.body_text}</p>
        </details>
        <details>
          <summary>Ganchos alternativos</summary>
          {briefing.alternative_hooks.map((hook) => <p key={hook}>{hook}</p>)}
        </details>
        <details open>
          <summary>Estratégia e chamada para ação</summary>
          <p><strong>Gancho</strong> {briefing.magnetic_hook}</p>
          <p>{briefing.strategy}</p>
          <p><strong>CTA</strong> {briefing.call_to_action}</p>
        </details>
        <details>
          <summary>Paleta e tipografia</summary>
          <div className="copilot-colors">
            {([
              ['Fundo', palette.background], ['Texto', palette.text],
              ['Acento', palette.primary_accent], ['Destaque', palette.glow_accent],
            ] as const).map(([name, hex]) => (
              <button key={name} type="button" title={`Copiar ${hex}`} onClick={() => copy(hex, `Cor ${hex} copiada.`)}>
                <span style={{ backgroundColor: hex }} />
                <strong>{name}</strong><small>{hex}</small>
              </button>
            ))}
          </div>
          <p><strong>Títulos</strong> {briefing.typography.heading_font} · <strong>Corpo</strong> {briefing.typography.body_font}</p>
          <p>{briefing.typography.notes}</p>
        </details>
        <details>
          <summary>Legenda e hashtags</summary>
          <p className="copilot-caption">{caption}</p>
          <button className="btn-secundario" type="button" onClick={() => copy(caption, 'Legenda copiada.')}>
            <Copy size={16} aria-hidden="true" /> Copiar legenda
          </button>
        </details>
      </div>

      <footer className="copilot-actions">
        {briefing.model && (
          <>
            <button className="btn-primario" type="button" disabled={busy} onClick={reviewCalendarPost}>
              <CalendarPlus size={16} aria-hidden="true" /> Levar ao calendário
            </button>
            <button className="btn-secundario" type="button" disabled={busy} onClick={onVariation}>
              <RefreshCw size={16} aria-hidden="true" /> Gerar variação
            </button>
          </>
        )}
        <button className="btn-secundario" type="button" disabled={busy} onClick={() => exportPhotoshopJson(briefing)}>
          <Download size={16} aria-hidden="true" /> Baixar briefing JSON
        </button>
        <small>O JSON contém roteiro e metadados para scripts de design.</small>
        <p className="copilot-notice" role="status">{notice}</p>
      </footer>
    </div>
  );
}
