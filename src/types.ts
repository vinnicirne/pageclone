export type FormatoMidia = '1:1' | '9:16' | '16:9';
export type TipoCriativo = 'Vídeo' | 'Imagem' | 'Copy';

export interface Criativo {
  id: string;
  nome: string;
  tipo: TipoCriativo;
  formato: FormatoMidia;
  duracao?: string;
  cpa?: string;
  videoUrl?: string;
  previewImg?: string;
  arquivoUrl?: string;
}

export interface MaterialApoio {
  id: string;
  titulo: string;
  tipo: 'Copy' | 'Script' | 'Arquivo' | 'Headline';
  texto?: string;
  desc?: string;
  arquivoUrl?: string;
}

export interface AulaProduto {
  id: string;
  titulo: string;
  duracao: string;
  concluida: boolean;
  videoUrl: string;
}

export interface ProdutoLowTicket {
  id: string;
  nome: string;
  nicho: string;
  tag: string;
  preco: number;
  moeda: 'BRL' | 'USD' | 'EUR';
  vendasSemana: number;
  conversao: number;
  cpaMedio: number;
  descricao: string;
  entregavel: string;
  webhookUrl: string;
  mockupImg: string;
  moedasDisponiveis: string[];
  criativos: Criativo[];
  materiais: MaterialApoio[];
  aulas: AulaProduto[];
}

export interface ConfiguracaoPublicacao {
  produtoId: string;
  checkoutUrl: string;
  pixelMeta?: string;
  capiToken?: string;
  testCode?: string;
  tiktokPixel?: string;
  ga4Id?: string;
  customDomain?: string;
  statusDns: 'pendente' | 'verificando' | 'conectado';
  publicado: boolean;
}

export interface EtapaJornada {
  id: number;
  titulo: string;
  concluida: boolean;
  badge: string;
}
