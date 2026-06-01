import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';

import {
    LocalQuery,
    makeStore,
    seedRecords,
    Status,
    Todo,
} from '../helpers.mjs';

const { READY } = Status;

function titlesOf(store, query) {
    return query.getStoreKeys().map((sk) => store.getData(sk).title);
}

describe('LocalQuery', () => {
    let store;
    let flush;
    beforeEach(() => {
        ({ store, flush } = makeStore());
        seedRecords(store, Todo, [
            { id: 't1', title: 'banana', done: false, priority: 2 },
            { id: 't2', title: 'apple', done: false, priority: 1 },
            { id: 't3', title: 'cherry', done: true, priority: 3 },
        ]);
    });

    test('becomes READY and reports its length once fetched', () => {
        const query = new LocalQuery({ store, Type: Todo });
        assert.ok(query.get('status') & READY);
        assert.equal(query.get('length'), 3);
    });

    test('applies the where filter', () => {
        const query = new LocalQuery({
            store,
            Type: Todo,
            where: (data) => !data.done,
        });
        assert.equal(query.get('length'), 2);
        assert.deepEqual(titlesOf(store, query).sort(), ['apple', 'banana']);
    });

    test('applies a named sort order', () => {
        const query = new LocalQuery({ store, Type: Todo, sort: ['title'] });
        assert.deepEqual(titlesOf(store, query), ['apple', 'banana', 'cherry']);
    });

    test('sorts by multiple properties (tie-break)', () => {
        // seedRecords does a full (isAll) fetch, so re-seed the complete set
        // including a second "apple" with a higher priority.
        seedRecords(store, Todo, [
            { id: 't1', title: 'banana', done: false, priority: 2 },
            { id: 't2', title: 'apple', done: false, priority: 1 },
            { id: 't3', title: 'cherry', done: true, priority: 3 },
            { id: 't4', title: 'apple', done: false, priority: 5 },
        ]);
        const query = new LocalQuery({
            store,
            Type: Todo,
            sort: ['title', 'priority'],
        });
        const rows = query
            .getStoreKeys()
            .map(
                (sk) =>
                    `${store.getData(sk).title}:${store.getData(sk).priority}`,
            );
        // Both "apple" rows come first, ordered by priority within the tie.
        assert.deepEqual(rows.slice(0, 2), ['apple:1', 'apple:5']);
    });

    test('accepts a custom comparator function', () => {
        const query = new LocalQuery({
            store,
            Type: Todo,
            sort: (a, b) => b.priority - a.priority,
        });
        assert.deepEqual(titlesOf(store, query), ['cherry', 'banana', 'apple']);
    });

    test('auto-refreshes when a matching record changes', () => {
        const query = new LocalQuery({
            store,
            Type: Todo,
            where: (data) => !data.done,
            sort: ['title'],
        });
        assert.deepEqual(titlesOf(store, query), ['apple', 'banana']);

        // Mark the done one as not-done: it should enter the results.
        const cherry = store.getRecord('acc1', Todo, 't3');
        cherry.set('done', false);
        flush();

        assert.deepEqual(titlesOf(store, query), ['apple', 'banana', 'cherry']);
        assert.equal(query.get('length'), 3);
    });

    test('drops a record from the results when it stops matching', () => {
        const query = new LocalQuery({
            store,
            Type: Todo,
            where: (data) => !data.done,
            sort: ['title'],
        });
        const apple = store.getRecord('acc1', Todo, 't2');
        apple.set('done', true);
        flush();
        assert.deepEqual(titlesOf(store, query), ['banana']);
    });

    test('getObjectAt returns the record at an index', () => {
        const query = new LocalQuery({ store, Type: Todo, sort: ['title'] });
        const record = query.getObjectAt(0);
        assert.equal(record.get('title'), 'apple');
    });

    test('indexOfStoreKey finds a store key in the results', () => {
        const query = new LocalQuery({ store, Type: Todo, sort: ['title'] });
        const sk = store.getStoreKey('acc1', Todo, 't3'); // cherry, last
        assert.equal(query.indexOfStoreKey(sk, 0), 2);
    });
});
