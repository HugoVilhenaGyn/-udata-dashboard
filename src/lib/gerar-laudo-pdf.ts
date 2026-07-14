import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { RelatorioLisa } from './db';

// Gerador do PDF de "Laudo/Estudo de Mercado" com a identidade visual real
// da Lobo Imóveis — layout, cores e tom seguem o modelo de laudo de
// avaliação mercadológica que a imobiliária já usa (logo, título em navy,
// subtítulo em dourado, tabelas com cabeçalho navy, aviso legal ao final).
// Isso transforma o relatório estruturado que a Lisa já gera (título,
// resumo, seções com texto/tabela) num documento pronto pra enviar ao
// proprietário, sem precisar editar nada manualmente.

const NAVY = '#1F3A5F';
const GOLD = '#B08D2F';
const GRAY = '#555555';
const LIGHT = '#F4F4F4';
const MARGIN = 55;
const BOTTOM_LIMIT = 770;

const LOGO_PATH = path.join(process.cwd(), 'src', 'assets', 'lobo-logo.jpg');

const AVISO_LEGAL =
  'Estudo de mercado orientativo gerado automaticamente pela Lisa (Inteligência Artificial da Lobo Imóveis), com base em dados reais do portfólio próprio (comparáveis ativos, leads e visualizações) e/ou pesquisas de mercado cadastradas pela equipe. Não constitui laudo técnico de engenharia de avaliação (ABNT NBR 14.653/IBAPE-GO). Para financiamento bancário, inventário, partilha ou ação judicial, recomenda-se a contratação de um engenheiro avaliador credenciado. Valores de mercado podem variar conforme condições de negociação, sazonalidade e características específicas do imóvel.';

const FOOTER_LINE =
  'Rua. 84, 572 - St. Sul, Goiânia - GO, 74080-400   ·   Telefone: (62) 3018-2500   ·   www.loboimoveis.imb.br';

export interface ContextoLaudoPdf {
  // Linha dourada logo abaixo do título — ex: "Imóvel residencial · Setor
  // Bueno" ou "Lead: Fulano de Tal — venda de apartamento em X".
  subtitulo?: string;
}

export function gerarLaudoPdfBuffer(relatorio: RelatorioLisa, contexto?: ContextoLaudoPdf): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 70, left: MARGIN, right: MARGIN },
        bufferPages: true,
      });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const PAGE_W = doc.page.width;
      const CONTENT_W = PAGE_W - MARGIN * 2;

      const drawLogo = (y: number) => {
        if (fs.existsSync(LOGO_PATH)) {
          doc.image(LOGO_PATH, MARGIN, y, { width: 55 });
        }
      };

      const ensureRowSpace = (rowH: number) => {
        if (doc.y + rowH > BOTTOM_LIMIT) {
          doc.addPage();
          drawLogo(40);
          doc.y = 100;
        }
      };

      const sectionHeading = (text: string) => {
        doc.moveDown(0.8);
        doc.fontSize(12).fillColor(NAVY).font('Helvetica-Bold').text(text, MARGIN, doc.y, { width: CONTENT_W });
        const hy = doc.y + 2;
        doc.moveTo(MARGIN, hy).lineTo(PAGE_W - MARGIN, hy).strokeColor(NAVY).lineWidth(1).stroke();
        doc.y = hy + 10;
      };

      const paragraph = (text: string) => {
        doc.fontSize(10).fillColor('#222222').font('Helvetica')
          .text(text, MARGIN, doc.y, { width: CONTENT_W, align: 'justify' });
        doc.moveDown(0.5);
      };

      const table = (colunas: string[], linhas: string[][]) => {
        const colWidth = CONTENT_W / colunas.length;
        const rowH = 20;
        doc.moveDown(0.3);
        ensureRowSpace(rowH);
        let y = doc.y;

        doc.rect(MARGIN, y, CONTENT_W, rowH).fill(NAVY);
        colunas.forEach((c, i) => {
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF')
            .text(c, MARGIN + i * colWidth + 5, y + 6, { width: colWidth - 10 });
        });
        y += rowH;
        doc.y = y;

        linhas.forEach((linha, ri) => {
          ensureRowSpace(rowH);
          y = doc.y;
          const bg = ri % 2 === 0 ? '#FFFFFF' : LIGHT;
          doc.rect(MARGIN, y, CONTENT_W, rowH).fill(bg);
          doc.fontSize(9).font('Helvetica').fillColor('#222222');
          linha.forEach((cell, ci) => {
            doc.text(String(cell ?? ''), MARGIN + ci * colWidth + 5, y + 6, { width: colWidth - 10 });
          });
          y += rowH;
          doc.y = y;
        });
        doc.y += 10;
      };

      // ---- Cabeçalho ----
      drawLogo(40);
      doc.y = 105;
      doc.fontSize(18).fillColor(NAVY).font('Helvetica-Bold')
        .text(relatorio.titulo.toUpperCase(), MARGIN, doc.y, { width: CONTENT_W, align: 'center' });
      if (contexto?.subtitulo) {
        doc.fontSize(11).fillColor(GOLD).font('Helvetica-Bold')
          .text(contexto.subtitulo.toUpperCase(), { width: CONTENT_W, align: 'center' });
      }
      doc.moveDown(0.3);
      const dataFmt = new Date(relatorio.criado_em).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      doc.fontSize(9).fillColor(GRAY).font('Helvetica-Oblique')
        .text(`Elaborado por Lobo Imóveis Negócios Imobiliários Ltda. — Inteligência de Mercado (Lisa AI) | ${dataFmt}`, { width: CONTENT_W, align: 'center' });
      doc.moveDown(0.6);
      doc.moveTo(MARGIN, doc.y).lineTo(PAGE_W - MARGIN, doc.y).strokeColor('#DDDDDD').lineWidth(1).stroke();
      doc.moveDown(0.8);

      // ---- Corpo ----
      sectionHeading('RESUMO EXECUTIVO');
      paragraph(relatorio.resumo);

      relatorio.secoes.forEach((sec, idx) => {
        sectionHeading(`${idx + 1}. ${sec.titulo.toUpperCase()}`);
        if (sec.texto) paragraph(sec.texto);
        if (sec.colunas && sec.colunas.length && sec.linhas && sec.linhas.length) {
          table(sec.colunas, sec.linhas);
        }
      });

      sectionHeading('AVISO LEGAL');
      doc.fontSize(8).fillColor(GRAY).font('Helvetica-Oblique')
        .text(AVISO_LEGAL, MARGIN, doc.y, { width: CONTENT_W, align: 'justify' });

      // ---- Rodapé em todas as páginas ----
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const bottomMargin = doc.page.margins.bottom;
        doc.page.margins.bottom = 0; // pdfkit não desenha texto fora da margem por padrão
        const y = doc.page.height - 45;
        doc.fontSize(8).fillColor(GRAY).font('Helvetica')
          .text(FOOTER_LINE, MARGIN, y, { width: CONTENT_W, align: 'center' });
        doc.text(`Página ${i - range.start + 1} de ${range.count}`, MARGIN, y + 12, { width: CONTENT_W, align: 'center' });
        doc.page.margins.bottom = bottomMargin;
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
