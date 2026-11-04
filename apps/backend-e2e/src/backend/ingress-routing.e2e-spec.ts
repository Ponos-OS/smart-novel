import axios from 'axios';

const zitadelHost = 'http://auth.localhost:8080';

async function get(url: string) {
  return axios.get<string>(url, {
    validateStatus: () => true,
    responseType: 'text',
  });
}

describe('Ingress routing (e2e)', () => {
  it.each([
    '/admin/novels',
    '/admin/tags',
    '/admin/writers',
    '/admin/licenses',
    '/administrator',
  ])(
    'should serve the frontend for %s, so a refresh keeps the page',
    async (path) => {
      const response = await get(path);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.data).toContain('<div id="root">');
    },
  );

  it('should serve ZITADEL on its own host', async () => {
    const response = await axios.get(
      `${zitadelHost}/.well-known/openid-configuration`,
    );

    expect(response.status).toBe(200);
    expect(response.data.issuer).toBe(zitadelHost);
  });

  it('should serve the admin API of ZITADEL under its own host only', async () => {
    const onZitadel = await get(`${zitadelHost}/admin/v1/healthz`);
    const onFrontend = await get('/admin/v1/healthz');

    expect(onZitadel.status).toBe(200);
    expect(onFrontend.headers['content-type']).toContain('text/html');
  });
});
