import { describe, expect, it } from 'vitest';
import { readJsonBody, RequestBodyTooLargeError } from '../../apps/web/lib/request-body';

describe('interaction request boundary', () => {
  it('accepts bounded chunked JSON bodies', async () => {
    const request = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ intent: 'request_information' }) });
    await expect(readJsonBody(request, 2048)).resolves.toEqual({ intent: 'request_information' });
  });
  it('rejects oversized bodies without trusting Content-Length', async () => {
    const request = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ value: 'x'.repeat(100) }) });
    await expect(readJsonBody(request, 32)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });
});
