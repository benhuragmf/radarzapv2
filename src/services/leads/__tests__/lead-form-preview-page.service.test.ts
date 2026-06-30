import {
  injectAfterSection,
  sanitizePreviewHtml,
  countSections,
  injectPreviewHeadFixes,
  absolutizeRootRelativeUrls,
} from '@/services/leads/lead-form-preview-page.service';

describe('lead-form-preview-page.service', () => {
  const sample = `<!DOCTYPE html><html><head><title>T</title></head><body>
    <section id="a">A</section>
    <section id="b">B</section>
    <section id="c">C</section>
    <footer>F</footer>
    </body></html>`;

  it('injectAfterSection inserts after Nth section close', () => {
    const slot = '<div id="form-mount"></div>';
    const out = injectAfterSection(sample, 2, slot);
    expect(out.indexOf('</section>', out.indexOf('id="b"'))).toBeLessThan(out.indexOf(slot));
    expect(out.indexOf(slot)).toBeLessThan(out.indexOf('id="c"'));
  });

  it('injectAfterSection at 0 inserts after body open', () => {
    const slot = '<div id="rz"></div>';
    const out = injectAfterSection(sample, 0, slot);
    expect(out.indexOf('<body>')).toBeLessThan(out.indexOf(slot));
    expect(out.indexOf(slot)).toBeLessThan(out.indexOf('id="a"'));
  });

  it('sanitizePreviewHtml removes scripts', () => {
    const html = '<div onclick="alert(1)">x</div><script>evil()</script>';
    const out = sanitizePreviewHtml(html);
    expect(out).not.toContain('<script');
    expect(out).not.toContain('onclick');
  });

  it('injectPreviewHeadFixes reveals content and adds marker styles', () => {
    const out = injectPreviewHeadFixes('<html><head></head><body></body></html>');
    expect(out).toContain('rz-lead-preview-fix');
    expect(out).toContain('.reveal');
    expect(out).toContain('data-theme="dark"');
  });

  it('absolutizeRootRelativeUrls rewrites site assets', () => {
    const out = absolutizeRootRelativeUrls(
      '<link href="/brand.css" /><img src="/x.png" />',
      'https://radarchat.com.br',
    );
    expect(out).toContain('href="https://radarchat.com.br/brand.css"');
    expect(out).toContain('src="https://radarchat.com.br/x.png"');
  });
});
