import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { ACCOUNT_ID, makeStore, seedRecords, Todo } from '../helpers.mjs';
import { MemoryManager } from '../../../source/datastore/store/MemoryManager.js';

// A short cleanup timeout: unloading records fires a deferred type-change that
// re-arms the manager's cleanup timer. A tiny delay lets that follow-up fire
// (and find nothing left to do) so the test process can exit, rather than
// leaving a multi-day timer pinning the event loop open.
const TIMEOUT = 1;

describe('MemoryManager', () => {
    test('cleanup unloads clean records beyond the configured maximum', () => {
        const { store } = makeStore();
        seedRecords(store, Todo, [
            { id: 'a', title: 'A' },
            { id: 'b', title: 'B' },
            { id: 'c', title: 'C' },
        ]);
        assert.equal(store.findAll(Todo).length, 3);

        const manager = new MemoryManager(
            store,
            [{ Type: Todo, max: 1 }],
            TIMEOUT,
        );
        manager.cleanup();

        assert.equal(store.findAll(Todo).length, 1);
    });

    test('cleanup never unloads records with uncommitted changes', () => {
        const { store } = makeStore();
        seedRecords(store, Todo, [
            { id: 'a', title: 'A' },
            { id: 'b', title: 'B' },
            { id: 'c', title: 'C' },
        ]);
        // Two records are dirty and so cannot be unloaded.
        store.getRecord(ACCOUNT_ID, Todo, 'a').set('title', 'dirty-A');
        store.getRecord(ACCOUNT_ID, Todo, 'b').set('title', 'dirty-B');

        const manager = new MemoryManager(
            store,
            [{ Type: Todo, max: 0 }],
            TIMEOUT,
        );
        manager.cleanup();

        // The clean record is gone; the two dirty ones survive.
        assert.equal(store.findAll(Todo).length, 2);
    });

    test('addRestriction registers a type added after construction', () => {
        const { store } = makeStore();
        seedRecords(store, Todo, [
            { id: 'a', title: 'A' },
            { id: 'b', title: 'B' },
        ]);
        const manager = new MemoryManager(store, [], TIMEOUT);
        manager.addRestriction({ Type: Todo, max: 1 });
        manager.cleanup();
        assert.equal(store.findAll(Todo).length, 1);
    });
});
