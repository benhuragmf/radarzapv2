import {
  renderPlatformCatalogTemplate,
  PLATFORM_WA_SAMPLE_VARS,
} from '@/constants/platform-whatsapp-templates';
import { buildPlatformWhatsAppVariables } from '@/utils/platform-wa-variables';

describe('renderPlatformCatalogTemplate', () => {
  it('preenche template de aniversário com variáveis', () => {
    const rendered = renderPlatformCatalogTemplate('pw-aniversario', {
      nome: 'João',
      empresa: 'Loja Teste',
      aniversario: '20/06',
      mensagem: 'Muitas felicidades!',
      rodape: 'Loja Teste • 04/06/2026',
    });

    expect(rendered).not.toBeNull();
    expect(rendered).toContain('João');
    expect(rendered).toContain('Loja Teste');
    expect(rendered).toContain('20/06');
    expect(rendered).toContain('Muitas felicidades!');
    expect(rendered).not.toMatch(/\{nome\}/);
  });

  it('retorna null para nome fora do catálogo', () => {
    expect(renderPlatformCatalogTemplate('inexistente', {})).toBeNull();
  });

  it('buildPlatformWhatsAppVariables + pw-aniversario', () => {
    const vars = buildPlatformWhatsAppVariables(
      {
        name: 'João',
        identifier: '+5511999990000',
        type: 'contact',
        birthday: '1992-03-20',
      },
      { name: 'Loja Teste' },
      { displayName: 'Equipe' },
      { mensagem: 'Parabéns!' },
    );
    const rendered = renderPlatformCatalogTemplate('pw-aniversario', vars);
    expect(rendered).toContain('João');
    expect(rendered).toContain('20/03');
    expect(rendered).toContain('Parabéns!');
  });

  it('amostras cobrem preview sem placeholders', () => {
    const rendered = renderPlatformCatalogTemplate(
      'pw-promo',
      PLATFORM_WA_SAMPLE_VARS as Record<string, string>,
    );
    expect(rendered).toContain('RADAR30');
    expect(rendered).not.toMatch(/\{[a-z_]+\}/);
  });
});
