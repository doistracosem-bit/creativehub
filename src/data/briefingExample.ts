import type { BriefingContent } from '../../supabase/functions/_shared/briefing';

export const exampleContent: BriefingContent = {
  campaign_title: 'O próximo capítulo começa no bairro',
  magnetic_hook: 'Que tal atravessar o bairro para trocar uma história?',
  alternative_hooks: ['Qual livro seu merece circular?', 'A próxima leitura pode vir da estante de um vizinho.'],
  strategy: 'Convidar moradores que têm livros parados na estante a participar de uma troca na livraria. O carrossel começa com um objeto familiar e explica, em etapas, o que levar e o que esperar.',
  call_to_action: 'Comente qual livro você levaria para a troca.',
  color_palette: { background: '#30231B', text: '#FFF4DE', primary_accent: '#AB613B', glow_accent: '#F6BD72' },
  typography: {
    heading_font: 'Georgia',
    body_font: 'Plus Jakarta Sans',
    notes: 'Use uma serifada nos títulos para evocar páginas de livro. Preserve margens largas e corpo legível em telas pequenas.',
  },
  slides: [
    { headline: 'Um livro seu. Uma história nova.', body_text: 'Uma troca de livros para quem mora por perto e quer renovar a estante.', visual_direction: 'Fotografe dois livros empilhados sobre uma mesa de madeira. Use luz lateral e deixe a metade superior livre para o título.' },
    { headline: 'Escolha um livro em bom estado', body_text: 'Vale aquele que você já leu e indicaria a alguém do bairro.', visual_direction: 'Mostre a mão puxando um livro da estante. Deixe o título no lado oposto ao movimento.' },
    { headline: 'Conte por que você gostou', body_text: 'Escreva uma recomendação curta num marcador e coloque-o entre as páginas.', visual_direction: 'Enquadre um marcador parcialmente inserido no livro, com o texto sobre um fundo liso.' },
    { headline: 'Saia com outro livro na mão', body_text: 'Explore a mesa comunitária e escolha sua próxima leitura.', visual_direction: 'Fotografe a mesa de cima. Reserve um canto sem livros para a legenda da peça.' },
    { headline: 'Qual livro você levaria?', body_text: 'Conte nos comentários e marque alguém que trocaria uma história com você.', visual_direction: 'Faça uma foto frontal de dois livros lado a lado, com o convite em destaque acima das capas.' },
  ],
  caption: 'Tem um livro na estante que merece circular? Na troca de livros do bairro, você traz uma leitura em bom estado e escolhe outra da mesa comunitária. Se quiser, deixe um marcador com uma recomendação para quem abrir o livro depois de você.\n\nQual livro você levaria para a troca? Conta pra gente nos comentários.',
  hashtags: ['#TrocaDeLivros', '#LivrariaDeBairro', '#LeituraCompartilhada'],
};
