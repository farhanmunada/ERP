import { describe, expect, test } from 'bun:test';

import { buildApp } from './app.ts';

describe('app bootstrap', () => {
  test('GET /health mengembalikan status ok', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ status: 'ok' });

    await app.close();
  });

  test('rute tidak dikenal mengembalikan error standar 404', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/tidak-ada' });

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body).error.code).toBe('NOT_FOUND');

    await app.close();
  });
});
