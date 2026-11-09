import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const profile = process.env.TEST_ENV || 'staging';
const entry = fileURLToPath(new URL('../dist/index.js', import.meta.url));

test(`bundled action renders a ${profile} fixture and leaves README unchanged`, async () => {
    assert.ok(['staging', 'prod'].includes(profile), `Unknown TEST_ENV: ${profile}`);
    const dir = mkdtempSync(join(tmpdir(), 'activity-log-a5-'));
    const calls = [];
    const api = createServer((request, response) => {
        const path = new URL(request.url, 'http://127.0.0.1').pathname;
        calls.push(`${request.method} ${path}`);
        let body;
        if (request.method === 'GET' && path === '/user/starred') {
            body = [];
        } else if (request.method === 'GET' && path === '/users/fixture-user/events') {
            body = [{
                type: 'IssuesEvent',
                public: true,
                repo: { name: `fixtures/${profile}-repo` },
                payload: { action: 'opened', issue: { number: 17, title: 'Fixture issue' } },
                created_at: '2026-10-01T12:00:00Z',
            }];
        } else {
            response.statusCode = 404;
            body = { message: `Unexpected API request: ${request.method} ${path}` };
        }
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify(body));
    });

    try {
        await new Promise((resolve, reject) => {
            api.once('error', reject);
            api.listen(0, '127.0.0.1', resolve);
        });
        const readme = join(dir, 'README.md');
        const original = '# Fixture\n<!--START_SECTION:activity-->\n<!--END_SECTION:activity-->\n';
        writeFileSync(readme, original);
        const output = [];
        const status = await new Promise((resolve, reject) => {
            const child = spawn(process.execPath, [entry], {
                cwd: dir,
                timeout: 15_000,
                env: {
                    ...process.env,
                    NO_PROXY: '127.0.0.1',
                    no_proxy: '127.0.0.1',
                    GITHUB_API_URL: `http://127.0.0.1:${api.address().port}`,
                    INPUT_GITHUB_USERNAME: 'fixture-user',
                    INPUT_GITHUB_TOKEN: 'test-fixture-token',
                    INPUT_EVENT_LIMIT: '1',
                    INPUT_OUTPUT_STYLE: profile === 'prod' ? 'HTML' : 'MARKDOWN',
                    INPUT_IGNORE_EVENTS: '[]',
                    INPUT_EVENT_TEMPLATE: 'Opened issue {number} in {repo}',
                    INPUT_README_PATH: readme,
                    INPUT_DRY_RUN: 'true',
                },
            });
            child.stdout.setEncoding('utf8').on('data', (chunk) => output.push(chunk));
            child.stderr.setEncoding('utf8').on('data', (chunk) => output.push(chunk));
            child.once('error', reject);
            child.once('close', resolve);
        });
        const log = output.join('').replace(/\r\n/g, '\n');
        assert.equal(status, 0, log);
        assert.deepEqual(calls, ['GET /user/starred', 'GET /users/fixture-user/events']);
        assert.match(log, /Dry run mode enabled/);
        const number = profile === 'staging' && process.env.FORCE_TEST_FAILURE === '1' ? 99 : 17;
        const item = `Opened issue #${number} in fixtures/${profile}-repo`;
        const expected = profile === 'prod' ? `<ol>\n<li>${item}</li>\n</ol>` : `1. ${item}`;
        assert.ok(log.includes(expected), `Expected: ${expected}\nActual:\n${log}`);
        assert.equal(readFileSync(readme, 'utf8'), original);
    } finally {
        api.close();
        rmSync(dir, { recursive: true, force: true });
    }
});
