import { describe, expect, it } from 'vitest';
import headers from '../../public/_headers?raw';
import indexHtml from '../../index.html?raw';

async function sha256(body: string): Promise<string> {
  // The HTML parser normalises CRLF and lone CR to LF before the script text is
  // hashed, so a Windows checkout must hash the same bytes the browser sees.
  const parsed = body.replace(/\r\n?/g, '\n');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parsed));
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

function policyLine(): string {
  const prefix = 'content-security-policy-report-only:';
  const line = headers
    .split(/\r?\n/)
    .find((entry) => entry.trim().toLowerCase().startsWith(prefix));
  return line ? line.slice(line.indexOf(':') + 1).trim() : '';
}

describe('report-only CSP header', () => {
  it('is present in the static host headers', () => {
    expect(policyLine()).toContain("default-src 'self'");
    expect(policyLine()).toContain("object-src 'none'");
  });

  it('is not enforced yet', () => {
    expect(headers).not.toMatch(/^\s*content-security-policy:/im);
  });

  it('allows every inline script in index.html by hash', async () => {
    const bodies = [...indexHtml.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
      .map((match) => match[1])
      .filter((body) => body.trim());

    expect(bodies.length).toBeGreaterThan(0);
    for (const body of bodies) {
      expect(policyLine()).toContain(`'sha256-${await sha256(body)}'`);
    }
  });

  it('does not allow inline scripts by keyword', () => {
    const scriptSrc = policyLine()
      .split(';')
      .map((directive) => directive.trim())
      .find((directive) => directive.startsWith('script-src'));

    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });
});