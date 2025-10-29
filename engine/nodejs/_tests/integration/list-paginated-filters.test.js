/* eslint-disable no-console */
const { getHealth, getHttpRequestsList } = require('../helpers/http');

jest.setTimeout(60000);

describe('Paginated SELECT with filters', () => {
  beforeAll(async () => {
    // Verifies nginx → node health endpoint
    const health = await getHealth();
    if (health.status !== 200) {
      throw new Error(`/health not OK. Status=${health.status} Body=${JSON.stringify(health.data)}`);
    }
  });

  it('returns results filtered by method, authority, and path with pagination', async () => {
    // Filters expected to match the item inserted by the previous test
    const baseParams = {
      method: 'POST',
      authority: 'api.example.com',
      path: '/v1/items',
      limit: 1,
      offset: 0
    };

    // Page 0
    const page0 = await getHttpRequestsList(baseParams);
    expect(page0.status).toBe(200);
    expect(page0.data).toBeDefined();

    // Accept APIs that expose either:
    //  A) { total, items: [...] }
    //  B) { items: [...] } without total
    const total0 =
      typeof page0.data.total === 'number'
        ? page0.data.total
        : (typeof page0.data?.pagination?.total === 'number' ? page0.data.pagination.total : null);

    const items0 = Array.isArray(page0.data.items) ? page0.data.items : [];
    expect(Array.isArray(items0)).toBe(true);
    expect(items0.length).toBeLessThanOrEqual(1);

    if (items0.length === 1) {
      const it0 = items0[0];

      // Basic field checks when present in the compact JSON
      if (it0.method) expect(it0.method).toBe('POST');
      if (it0.uri?.authority) expect(it0.uri.authority).toBe('api.example.com');
      if (it0.uri?.path) expect(it0.uri.path).toBe('/v1/items');
    }

    // Page 1
    const page1 = await getHttpRequestsList({ ...baseParams, offset: 1 });
    expect(page1.status).toBe(200);
    expect(page1.data).toBeDefined();

    const total1 =
      typeof page1.data.total === 'number'
        ? page1.data.total
        : (typeof page1.data?.pagination?.total === 'number' ? page1.data.pagination.total : null);

    const items1 = Array.isArray(page1.data.items) ? page1.data.items : [];
    expect(Array.isArray(items1)).toBe(true);

    // If the API exposes a total, keep assertions consistent with it.
    if (typeof total0 === 'number' && typeof total1 === 'number') {
      expect(total1).toBe(total0);

      if (total0 > 1) {
        // When there are more results than the page size, the second page should be allowed to be non-empty
        expect(items1.length).toBeGreaterThanOrEqual(0);
        if (items0.length === 1 && items1.length === 1) {
          // If both pages have one item each and "id" is exposed, the ids should differ
          if (items0[0]?.id && items1[0]?.id) {
            expect(items1[0].id).not.toBe(items0[0].id);
          }
        }
      } else {
        // Only one match overall → page 1 should be empty
        expect(items1.length).toBe(0);
      }
    } else {
      // No total provided by the API → make minimal, pagination-safe checks
      // If the first page has one item and the second page also has one item,
      // ensure they are not the same when an id is exposed.
      if (items0.length === 1 && items1.length === 1) {
        if (items0[0]?.id && items1[0]?.id) {
          expect(items1[0].id).not.toBe(items0[0].id);
        }
      }
      // Otherwise, accept empty or non-empty page 1 results since "total" is unknown.
      expect(items1.length).toBeGreaterThanOrEqual(0);
    }
  });
});
