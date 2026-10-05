import { describe, it, expect } from 'vitest';
import { decodeWafValue, decodeWafPayload, WAF_ENCODED_FIELDS } from './decodeWafPayload';

// Mirrors the dashboard's encoder: btoa(unescape(encodeURIComponent(value)))
function encodeLike(value: string): string {
  return 'b64:' + Buffer.from(value, 'utf8').toString('base64');
}

describe('decodeWafValue', () => {
  it('decodes a base64-wrapped HTML payload', () => {
    const html = '<p>மூட்டுவலி அல்லது கீல்வாதம்</p>';
    expect(decodeWafValue(encodeLike(html))).toBe(html);
  });

  it('preserves Tamil multi-byte text exactly', () => {
    const html = '<p>ஒன்று பட்டால் உண்டு வாழ்வு — தமிழ் செய்திகள்</p>';
    expect(decodeWafValue(encodeLike(html))).toBe(html);
  });

  it('leaves plain HTML untouched', () => {
    const html = '<p>already plain</p>';
    expect(decodeWafValue(html)).toBe(html);
  });

  it('leaves an empty string untouched', () => {
    expect(decodeWafValue('')).toBe('');
  });

  it('keeps the original value when the payload is not valid base64', () => {
    // Round-trip validation must reject this rather than returning empty content.
    const broken = 'b64:!!!not-base64!!!';
    expect(decodeWafValue(broken)).toBe(broken);
  });

  it('keeps the original value when base64 decodes to empty', () => {
    expect(decodeWafValue('b64:')).toBe('b64:');
  });

  it('does not mangle a value that merely starts with b64 but is not encoded', () => {
    const value = 'b64:some-plain-text';
    expect(decodeWafValue(value)).toBe(value);
  });
});

describe('decodeWafPayload', () => {
  const run = (method: string, body: unknown) => {
    const req = { method, body } as { method: string; body: any };
    let called = false;
    decodeWafPayload(req, {}, () => { called = true; });
    return { req, called };
  };

  it('decodes content and excerpt on POST', () => {
    const { req, called } = run('POST', {
      title: 'மூட்டுவலி',
      content: encodeLike('<p>உடல்</p>'),
      excerpt: encodeLike('<p>சுருக்கம்</p>'),
    });
    expect(called).toBe(true);
    expect(req.body).toEqual({ title: 'மூட்டுவலி', content: '<p>உடல்</p>', excerpt: '<p>சுருக்கம்</p>' });
  });

  it('decodes on PUT and PATCH', () => {
    for (const method of ['PUT', 'PATCH']) {
      const { req } = run(method, { content: encodeLike('<p>x</p>') });
      expect(req.body).toEqual({ content: '<p>x</p>' });
    }
  });

  it('does not decode on GET', () => {
    const encoded = encodeLike('<p>should stay</p>');
    const { req } = run('GET', { content: encoded });
    expect(req.body).toEqual({ content: encoded });
  });

  it('decodes nested payloads', () => {
    const { req } = run('POST', {
      article: { content: encodeLike('<p>nested</p>') },
      items: [{ content: encodeLike('<p>in array</p>') }],
    });
    expect(req.body.article.content).toBe('<p>nested</p>');
    expect(req.body.items[0].content).toBe('<p>in array</p>');
  });

  it('leaves other fields alone', () => {
    const { req } = run('POST', { description: encodeLike('<p>not encoded by the dashboard</p>') });
    expect(req.body.description).toBe(encodeLike('<p>not encoded by the dashboard</p>'));
  });

  it('tolerates a missing or non-object body', () => {
    for (const body of [undefined, null, 'string', 42]) {
      const { called } = run('POST', body);
      expect(called).toBe(true);
    }
  });

  it('exports the field names it decodes', () => {
    expect([...WAF_ENCODED_FIELDS]).toEqual(['content', 'excerpt']);
  });
});