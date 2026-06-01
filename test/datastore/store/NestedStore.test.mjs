import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';

import {
    ACCOUNT_ID,
    makeStore,
    seedRecords,
    Status,
    Todo,
} from '../helpers.mjs';
import { NestedStore } from '../../../source/datastore/store/NestedStore.js';

const { DIRTY, READY } = Status;

describe('NestedStore', () => {
    let store;
    let flush;
    let sk;
    beforeEach(() => {
        ({ store, flush } = makeStore());
        [sk] = seedRecords(store, Todo, [{ id: 't1', title: 'orig' }]);
    });

    test('buffers edits without touching the parent store', () => {
        const nested = new NestedStore(store);
        nested.getRecord(ACCOUNT_ID, Todo, 't1').set('title', 'buffered');

        assert.equal(nested.getData(sk).title, 'buffered');
        assert.ok(nested.getStatus(sk) & DIRTY);

        // Parent is untouched.
        assert.equal(store.getData(sk).title, 'orig');
        assert.equal(store.getStatus(sk) & DIRTY, 0);
    });

    test('inherits parent data and status for unmodified records', () => {
        const nested = new NestedStore(store);
        assert.equal(nested.getData(sk).title, 'orig');
        assert.ok(nested.getStatus(sk) & READY);
    });

    test('discardChanges throws the buffered edits away', () => {
        const nested = new NestedStore(store);
        nested.getRecord(ACCOUNT_ID, Todo, 't1').set('title', 'buffered');
        nested.discardChanges();
        flush();
        assert.equal(nested.getData(sk).title, 'orig');
        assert.equal(nested.getStatus(sk) & DIRTY, 0);
    });

    test('commitChanges propagates the edit up to the parent store', () => {
        const nested = new NestedStore(store);
        nested.getRecord(ACCOUNT_ID, Todo, 't1').set('title', 'committed');
        nested.commitChanges();
        flush();

        assert.equal(store.getData(sk).title, 'committed');
        // The parent now has an uncommitted change of its own to push onward.
        assert.ok(store.getStatus(sk) & DIRTY);
    });

    test('parent and nested share the id <-> store-key mapping', () => {
        const nested = new NestedStore(store);
        assert.equal(nested.getStoreKey(ACCOUNT_ID, Todo, 't1'), sk);
        assert.equal(nested.getIdFromStoreKey(sk), 't1');
    });
});
