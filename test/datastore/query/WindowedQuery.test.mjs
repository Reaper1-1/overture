import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { firstDuplicate, makeWindowedQuery } from '../helpers.mjs';
import * as Sentry from './windowed-query-sentry.fixture.mjs';

// Build a contiguous list of synthetic ids ('id0', 'id1', ...).
function range(from, count) {
    const result = [];
    for (let i = 0; i < count; i += 1) {
        result.push('id' + (from + i));
    }
    return result;
}

describe('WindowedQuery: fetching ids', () => {
    test('a single packet populates the list and sets length', () => {
        const wq = makeWindowedQuery({ windowSize: 30 });
        wq.ids(range(0, 30), 0, 'qs1', 75);
        assert.equal(wq.query.get('length'), 75);
        assert.deepEqual(wq.idsAt(wq.query.getStoreKeys().slice(0, 5)), [
            'id0',
            'id1',
            'id2',
            'id3',
            'id4',
        ]);
        // First window fully loaded; later windows not yet.
        assert.equal(wq.query.checkIfWindowIsFetched(0), true);
    });

    test('non-contiguous packets leave a gap until the middle is filled', () => {
        const wq = makeWindowedQuery({ windowSize: 30 });
        wq.ids(range(0, 30), 0, 'qs1', 90);
        wq.ids(range(60, 30), 60, 'qs1', 90);
        const list = wq.query.getStoreKeys();
        // The middle window is still empty.
        assert.equal(list[45], undefined);
        assert.equal(firstDuplicate(list), null);

        wq.ids(range(30, 30), 30, 'qs1', 90);
        const full = wq.query.getStoreKeys();
        assert.equal(full.length, 90);
        assert.equal(firstDuplicate(full), null);
        assert.deepEqual(wq.idsAt(full.slice(0, 3)), ['id0', 'id1', 'id2']);
        assert.deepEqual(wq.idsAt(full.slice(-2)), ['id88', 'id89']);
    });

    test('re-delivering the same packet is idempotent', () => {
        const wq = makeWindowedQuery({ windowSize: 30 });
        wq.ids(range(0, 30), 0, 'qs1', 30);
        wq.ids(range(0, 30), 0, 'qs1', 30);
        assert.equal(wq.query.getStoreKeys().length, 30);
        assert.equal(firstDuplicate(wq.query.getStoreKeys()), null);
    });

    test('a packet from a newer query state is deferred and triggers a refetch', () => {
        const wq = makeWindowedQuery({ windowSize: 30 });
        wq.ids(range(0, 30), 0, 'qs1', 30);
        const fetchesBefore = wq.fetchCount();

        // queryState no longer matches -> packet must wait for an update.
        wq.ids(range(0, 30), 0, 'qs2', 30);
        assert.equal(
            wq.query._waitingPackets.length,
            1,
            'packet is queued, not applied',
        );
        assert.ok(wq.fetchCount() > fetchesBefore, 'a refetch was requested');
    });
});

describe('WindowedQuery: source updates', () => {
    test('applies a server remove with no preemptives', () => {
        const wq = makeWindowedQuery({ windowSize: 30 });
        wq.ids(range(0, 10), 0, 'qs1', 10);
        wq.sourceUpdate('qs1', 'qs2', ['id3', 'id4'], [], 8, 'id9');
        const list = wq.query.getStoreKeys();
        assert.equal(wq.query.get('length'), 8);
        assert.equal(firstDuplicate(list), null);
        assert.ok(!wq.idsAt(list).includes('id3'));
        assert.ok(!wq.idsAt(list).includes('id4'));
    });

    test('applies a server add with no preemptives', () => {
        const wq = makeWindowedQuery({ windowSize: 30 });
        wq.ids(range(0, 5), 0, 'qs1', 5);
        wq.sourceUpdate(
            'qs1',
            'qs2',
            [],
            [{ index: 2, id: 'idNew' }],
            6,
            'id4',
        );
        const list = wq.query.getStoreKeys();
        assert.equal(wq.query.get('length'), 6);
        assert.equal(firstDuplicate(list), null);
        assert.equal(wq.idsAt([list[2]])[0], 'idNew');
    });

    test('resets when an update arrives for an unknown query state', () => {
        const wq = makeWindowedQuery({ windowSize: 30 });
        wq.ids(range(0, 10), 0, 'qs1', 10);
        // oldQueryState does not match the query's current state.
        wq.sourceUpdate('other', 'qs9', ['id1'], [], 9, 'id9');
        // The query goes obsolete rather than corrupting the list.
        assert.equal(firstDuplicate(wq.query.getStoreKeys()), null);
    });
});

describe('WindowedQuery: preemptive (client) updates', () => {
    test('a client remove is applied optimistically and confirmed by the server', () => {
        const wq = makeWindowedQuery({ windowSize: 30 });
        wq.ids(range(0, 10), 0, 'qs1', 10);

        wq.clientRemove(['id2', 'id3']);
        let list = wq.query.getStoreKeys();
        assert.equal(wq.query.get('length'), 8);
        assert.ok(!wq.idsAt(list).includes('id2'));
        assert.equal(firstDuplicate(list), null);

        // Server confirms exactly the same removal.
        wq.commitRoundTrip();
        wq.sourceUpdate('qs1', 'qs2', ['id2', 'id3'], [], 8, 'id9');
        list = wq.query.getStoreKeys();
        assert.equal(wq.query.get('length'), 8);
        assert.equal(list.length, 8);
        assert.equal(firstDuplicate(list), null);
        assert.equal(wq.query._preemptiveUpdates.length, 0);
    });

    test('an incorrect client guess is unwound when the server disagrees', () => {
        const wq = makeWindowedQuery({ windowSize: 30 });
        wq.ids(range(0, 10), 0, 'qs1', 10);

        // Client guesses id2 is removed...
        wq.clientRemove(['id2']);
        assert.ok(!wq.idsAt(wq.query.getStoreKeys()).includes('id2'));

        // ...but the server actually removed id7 instead.
        wq.commitRoundTrip();
        wq.sourceUpdate('qs1', 'qs2', ['id7'], [], 9, 'id9');
        const list = wq.query.getStoreKeys();
        assert.equal(firstDuplicate(list), null);
        const ids = wq.idsAt(list);
        // id2 is restored, id7 is gone.
        assert.ok(ids.includes('id2'));
        assert.ok(!ids.includes('id7'));
        assert.equal(wq.query._preemptiveUpdates.length, 0);
    });
});

describe('WindowedQuery: Sentry 7380278134 regression', () => {
    // Reproduces the exact event sequence that produced a duplicated run of
    // store keys (and a _storeKeys array longer than the query length), which
    // crashed ListView reconciliation. See the fix in WindowedQuery.js: the
    // preemptive set must be cleared before _applyUpdate(invertUpdate(...))
    // drains the deferred id packet.
    test('a deferred packet drained while unwinding a preemptive must not duplicate keys', () => {
        const wq = makeWindowedQuery({ windowSize: 30 });
        const checkpoint = (label) => {
            const list = wq.query.getStoreKeys();
            const dup = firstDuplicate(list);
            assert.equal(
                dup,
                null,
                `${label}: duplicate store key ${dup && dup.storeKey}`,
            );
            const length = wq.query.get('length');
            if (length !== null) {
                assert.ok(
                    list.length <= length,
                    `${label}: _storeKeys (${list.length}) longer than length (${length})`,
                );
            }
        };

        wq.ids(Sentry.E1_ids, 0, Sentry.QS.s791, 98);
        checkpoint('E1');
        wq.ids(Sentry.E2_ids, 30, Sentry.QS.s791, 98);
        checkpoint('E2');
        wq.ids(Sentry.E3_ids, 60, Sentry.QS.s791, 98);
        checkpoint('E3');
        wq.clientRemove(Sentry.E4_removed);
        checkpoint('E4');
        wq.clientRemove(Sentry.E5_removed);
        checkpoint('E5');
        wq.ids(Sentry.E6_ids, 30, Sentry.QS.s840, 49);
        checkpoint('E6');
        wq.commitRoundTrip();
        wq.sourceUpdate(
            Sentry.QS.s791,
            Sentry.QS.s840,
            Sentry.E7_removed,
            [],
            49,
            'Stot4McWczmk',
        );
        checkpoint('E7 (drains deferred packet)');
        wq.sourceUpdate(
            Sentry.QS.s791,
            Sentry.QS.s848,
            Sentry.E9_removed,
            [],
            41,
            'Stot4McWczmk',
        );
        checkpoint('E9 (rejected)');
        wq.sourceUpdate(
            Sentry.QS.s840,
            Sentry.QS.s848,
            Sentry.E10_removed,
            [],
            41,
            'StpSEpJKSrqk',
        );
        checkpoint('E10');
        wq.clientRemove(Sentry.E11_removed);
        checkpoint('E11');
        wq.commitRoundTrip();
        wq.sourceUpdate(
            Sentry.QS.s848,
            Sentry.QS.s856,
            Sentry.E12_removed,
            [],
            33,
            'StpSEpJKSrqk',
        );
        checkpoint('E12');
        wq.clientRemove(Sentry.E13_removed);
        checkpoint('E13');
        wq.commitRoundTrip();
        wq.sourceUpdate(
            Sentry.QS.s856,
            Sentry.QS.s864,
            Sentry.E14_removed,
            [],
            25,
            'StpSEpJKSrqk',
        );
        checkpoint('E14');
        wq.sourceUpdate(
            Sentry.QS.s864,
            Sentry.QS.s865,
            [],
            Sentry.E15_added,
            26,
            'StpSEpJKSrqk',
        );
        checkpoint('E15');

        const finalList = wq.query.getStoreKeys();
        assert.equal(wq.query.get('length'), 26, 'final length');
        assert.equal(finalList.length, 26, 'final _storeKeys length');
        assert.deepEqual(
            wq.idsAt(finalList),
            Sentry.EXPECTED_FINAL_IDS,
            'final list matches the correct, de-duplicated result',
        );
    });
});
