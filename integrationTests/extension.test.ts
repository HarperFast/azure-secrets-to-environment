/**
 * Integration tests for the azure-secrets-to-environment Harper extension.
 *
 * SCOPE: These tests verify the parts of the extension that do NOT require
 * live Azure Key Vault credentials or network access:
 *   - Harper boots successfully with the extension loaded (managedCredentials: true)
 *   - The extension's start() hook runs without error when managedCredentials is true
 *     (the hook returns { handleFile } without contacting Azure)
 *   - Basic Harper health check passes
 *
 * SKIPPED (Azure-specific flows):
 *   - Actual secret fetching from Azure Key Vault (requires real AZURE_VAULT_NAME,
 *     AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET credentials)
 *   - The managedCredentials: false path (calls Azure at startup — no CI credentials)
 *   - The handleFile() dotfile path (calls Azure vault at runtime)
 *
 * The fixture (integrationTests/fixtures/azure-extension) copies extension.js and its
 * dependencies into the Harper component directory and sets managedCredentials: true.
 */
import { suite, test, before, after } from 'node:test';
import { ok, strictEqual } from 'node:assert/strict';
import { setupHarperWithFixture, teardownHarper, type ContextWithHarper } from '@harperfast/integration-testing';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));

// harper's `exports` map only exposes ".", so 'harper/dist/bin/harper.js' is not
// resolvable via require.resolve.  Resolve the CLI from the exported main entry
// and pass it explicitly as harperBinPath (documented harness escape hatch).
const require = createRequire(import.meta.url);
const harperBinPath = resolve(dirname(require.resolve('harper')), 'bin/harper.js');

const FIXTURE_PATH = resolve(__dirname, 'fixtures', 'azure-extension');

const harperCtx = {} as ContextWithHarper;

function authHeaders(ctx: ContextWithHarper): Record<string, string> {
    const creds = Buffer.from(
        `${ctx.harper.admin.username}:${ctx.harper.admin.password}`
    ).toString('base64');
    return { Authorization: `Basic ${creds}` };
}

suite('azure-secrets-to-environment extension (managedCredentials: true)', () => {
    before(async () => {
        await setupHarperWithFixture(harperCtx, FIXTURE_PATH, { harperBinPath });
    });

    after(async () => {
        await teardownHarper(harperCtx);
    });

    test('Harper starts successfully with the extension loaded', async () => {
        // A successful before() means the extension's start() hook returned without
        // throwing (managedCredentials: true — no Azure call at startup).
        ok(harperCtx.harper.httpURL, 'httpURL should be populated after a successful start');
    });

    test('Harper HTTP endpoint responds (basic health check)', async () => {
        const res = await fetch(`${harperCtx.harper.httpURL}/`, {
            headers: authHeaders(harperCtx),
        });
        // The extension adds no HTTP routes of its own, so the root may return
        // 200 (Operations API default) or 404.  Any non-5xx status confirms
        // Harper is running and the extension did not break the server.
        ok(
            res.status < 500,
            `Expected a non-5xx status from Harper root, got ${res.status}`
        );
        await res.text(); // consume body
    });

    test('Operations API is reachable', async () => {
        const res = await fetch(`${harperCtx.harper.operationsAPIURL}`, {
            method: 'POST',
            headers: {
                ...authHeaders(harperCtx),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ operation: 'system_information' }),
        });
        strictEqual(res.status, 200, 'Operations API should respond with 200');
        const body = (await res.json()) as { node_name?: string };
        ok(typeof body === 'object' && body !== null, 'Operations API should return a JSON object');
    });

    // Skipped: managedCredentials: false path requires AZURE_VAULT_NAME,
    // AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET to be set.
    // These credentials are not available in CI.
    test('SKIPPED: vault credential fetch (no Azure credentials in CI)', { skip: 'Azure credentials not available in CI' }, async () => {
        // This test would verify that fetchAndSetSecrets() correctly sets
        // process.env variables when given valid Azure credentials.
    });

    // Skipped: handleFile() path requires vault credentials in the dotfile
    test('SKIPPED: handleFile dotfile path (no Azure credentials in CI)', { skip: 'Azure credentials not available in CI' }, async () => {
        // This test would verify that the extension processes a dotfile with
        // AZURE_VAULT_NAME + AZURE_TENANT_ID + AZURE_CLIENT_ID + AZURE_CLIENT_SECRET
        // and sets the resolved secrets into process.env.
    });
});
