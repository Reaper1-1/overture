import { SubsetQueryProxy } from '../../../source/datastore/query/SubsetQueryProxy.js';
import { makeWindowedQuery } from '../helpers.mjs';

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

// Binding#connect checks `toObject instanceof Element`; give Node a stand-in.
globalThis.Element ??= class Element {};

// Build a contiguous list of synthetic ids ('id0', 'id1', ...).
function range(from, count) {
    const result = [];
    for (let i = 0; i < count; i += 1) {
        result.push('id' + (from + i));
    }
    return result;
}

// A 300-item query in three groups of 100, fully loaded, fronted by a proxy.
function makeProxied(windowSize = 30) {
    const wq = makeWindowedQuery({ windowSize });
    wq.query.set('groupByCounts', [100, 100]);
    for (let i = 0; i < 300; i += windowSize) {
        wq.ids(range(i, windowSize), i, 'qs1', 300);
    }
    const proxy = new SubsetQueryProxy({ query: wq.query });
    return { wq, proxy };
}

describe('SubsetQueryProxy: observed ranges', () => {
    test('installs and removes the getObservedRanges hook', () => {
        const { wq, proxy } = makeProxied();
        const query = wq.query;
        assert.notEqual(
            query.getObservedRanges,
            Object.getPrototypeOf(query).getObservedRanges,
        );
        proxy.destroy();
        assert.equal(
            query.getObservedRanges,
            Object.getPrototypeOf(query).getObservedRanges,
        );
    });

    test('a newer proxy keeps its hook when an older one is destroyed', () => {
        const { wq, proxy } = makeProxied();
        const newer = new SubsetQueryProxy({ query: wq.query });
        proxy.destroy();
        const observed = { start: 0, end: 10 };
        newer.addObserverForRange(observed, {}, 'noop');
        assert.deepEqual(wq.query.getObservedRanges(), [{ start: 0, end: 10 }]);
        newer.destroy();
    });

    test('nothing observed on the proxy means nothing observed on the query', () => {
        const { wq, proxy } = makeProxied();
        assert.deepEqual(wq.query.getObservedRanges(), []);
        proxy.destroy();
    });

    test('with no collapsed groups the range passes straight through', () => {
        const { wq, proxy } = makeProxied();
        proxy.addObserverForRange({ start: 10, end: 50 }, {}, 'noop');
        assert.deepEqual(wq.query.getObservedRanges(), [
            { start: 10, end: 50 },
        ]);
        proxy.destroy();
    });

    test('a collapsed group in the middle splits the range around it', () => {
        const { wq, proxy } = makeProxied();
        proxy.toggleGroup(1);
        // Proxy space is now [0,100) = group 0, [100,200) = group 2.
        proxy.addObserverForRange({ start: 90, end: 120 }, {}, 'noop');
        assert.deepEqual(wq.query.getObservedRanges(), [
            { start: 90, end: 100 },
            { start: 200, end: 220 },
        ]);
        proxy.destroy();
    });

    test('an open-ended observer covers to the end, minus collapsed groups', () => {
        const { wq, proxy } = makeProxied();
        proxy.toggleGroup(0);
        proxy.toggleGroup(1);
        proxy.addObserverForRange({ start: 0 }, {}, 'noop');
        assert.deepEqual(wq.query.getObservedRanges(), [
            { start: 200, end: 300 },
        ]);
        proxy.destroy();
    });

    test('multiple observers are unioned and clamped to the visible length', () => {
        const { wq, proxy } = makeProxied();
        proxy.toggleGroup(2);
        proxy.addObserverForRange({ start: 0, end: 20 }, {}, 'noop');
        proxy.addObserverForRange({ start: 150, end: 500 }, {}, 'noop');
        assert.deepEqual(wq.query.getObservedRanges(), [
            { start: 0, end: 200 },
        ]);
        proxy.destroy();
    });

    test('a refresh without delta updates only refetches visible windows', () => {
        const { wq, proxy } = makeProxied(30);
        const query = wq.query;
        query.set('canGetDeltaUpdates', false);
        query.set('prefetch', 0);
        proxy.toggleGroup(1);
        // Observe the last 30 of group 0 and the first 30 of group 2.
        proxy.addObserverForRange({ start: 70, end: 130 }, {}, 'noop');
        query.setObsolete();
        const spec = query.sourceWillFetchQuery();
        assert.equal(spec.refresh, true);
        // Windows 2,3 (60-120) cover real 70-100; windows 6,7 (180-240)
        // cover real 200-230. The collapsed group (100-200) is skipped
        // apart from the windows that straddle its edges.
        assert.deepEqual(spec.ids, [
            { start: 60, count: 60 },
            { start: 180, count: 60 },
        ]);
        proxy.destroy();
    });
});
