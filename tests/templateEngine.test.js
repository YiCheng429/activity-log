import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applyTemplate, extractEventData, getEventAction } from '../src/utils/templateEngine.js';

const emojiMap = { PushEvent: 'P', IssuesEvent: { opened: 'I' } };

test('applyTemplate returns null without a template', () => {
    assert.equal(applyTemplate('', {}), null);
    assert.equal(applyTemplate(undefined, {}), null);
});

test('applyTemplate fills placeholders', () => {
    const out = applyTemplate('{emoji} {action} [{repo}]({url})', {
        emoji: 'X',
        action: 'Opened',
        repo: 'a/b',
        url: 'https://github.com/a/b',
    });
    assert.equal(out, 'X Opened [a/b](https://github.com/a/b)');
});

test('applyTemplate drops broken links and empty placeholders', () => {
    assert.equal(applyTemplate('[{repo}]({url})', { repo: 'a/b' }), 'a/b');
    assert.equal(applyTemplate('{emoji} {action} {ref} done', { emoji: 'X', action: 'Opened' }), 'X Opened done');
});

test('applyTemplate keeps replacement patterns literal', () => {
    assert.equal(applyTemplate('Paid {subject}', { subject: 'cost $& more' }), 'Paid cost $& more');
});

test('getEventAction resolves merged, forced and default actions', () => {
    assert.equal(getEventAction('PullRequestEvent', { action: 'closed', pull_request: { merged: true } }), 'merged');
    assert.equal(getEventAction('WatchEvent', { action: 'started' }), 'watched');
    assert.equal(getEventAction('PushEvent', {}), 'committed');
});

test('extractEventData for a public push', () => {
    const data = extractEventData(
        {
            type: 'PushEvent',
            repo: { name: 'a/b' },
            public: true,
            payload: { head: 'abc123', ref: 'refs/heads/main' },
            created_at: '2026-10-01T12:00:00Z',
        },
        emojiMap,
    );
    assert.equal(data.emoji, 'P');
    assert.equal(data.action, 'Committed to');
    assert.equal(data.repo, 'a/b');
    assert.equal(data.url, 'https://github.com/a/b/commit/abc123');
    assert.equal(data.ref, 'main');
    assert.equal(data.date, 'Oct 1, 2026');
});

test('extractEventData hides details of private repos', () => {
    const data = extractEventData(
        {
            type: 'IssuesEvent',
            repo: { name: 'secret/repo' },
            public: false,
            payload: { action: 'opened', issue: { number: 5 }, ref: 'x' },
            created_at: '2026-10-01T12:00:00Z',
        },
        emojiMap,
        true,
    );
    assert.equal(data.repo, 'a private repository');
    assert.equal(data.url, '');
    assert.equal(data.number, '');
    assert.equal(data.ref, '');
    assert.equal(data.action, 'Opened');
});
