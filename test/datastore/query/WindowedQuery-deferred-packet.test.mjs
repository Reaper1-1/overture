/*
    Regression test for a duplicate-store-key bug in O.WindowedQuery.

    Sentry issue 7380278134 ("Model bug: Unrecoverable error caught"): a
    MessageList ended up with a run of 8 store keys repeated in its results
    (`_storeKeys` 8 entries longer than the query `length`), which then crashed
    ListView reconciliation with "removeChild: node is not a child of this
    node". Replaying the recorded log of changes did NOT reproduce it, because
    the trigger is internal state the log does not capture: the DIRTY flag being
    cleared (by a sourceWillFetchQuery commit round-trip) before the confirming
    source update arrives.

    Root cause: in sourceDidFetchUpdate / sourceDidFetchIds, when a preemptive
    update is unwound via `_applyUpdate(invertUpdate(allPreemptives))`, that
    _applyUpdate drains queued id packets (_applyWaitingPackets) at its tail
    *before* `preemptives.length = 0` ran. The drained, deferred id packet was
    therefore shifted by a preemptive that had already been reverted from the
    list, so its run of store keys was written at the wrong offset, duplicating
    them and leaving the array too long.

    Fix: clear _preemptiveUpdates *before* applying the inverse update.

    This is a standalone Node test (overture/source has no test runner). Run:
        node test/datastore/query/WindowedQuery-deferred-packet.test.mjs
*/
import { WindowedQuery } from '../../../source/datastore/query/WindowedQuery.js';

// --- Status bits (mirror of source/datastore/record/Status.js) ---
const EMPTY = 1;
const READY = 2;
const DIRTY = 4;
const LOADING = 8;
const OBSOLETE = 16;

// --- Mock store: stable store key per id, assigned in first-seen order ---
let nextStoreKey = 1;
const idToStoreKey = new Map();
const storeKeyToId = new Map();
const store = {
    getStoreKey(accountId, Type, id) {
        if (!idToStoreKey.has(id)) {
            const storeKey = nextStoreKey;
            nextStoreKey += 1;
            idToStoreKey.set(id, storeKey);
            storeKeyToId.set(storeKey, id);
        }
        return idToStoreKey.get(id);
    },
    getIdFromStoreKey(storeKey) {
        return storeKeyToId.get(storeKey);
    },
    getRecordFromStoreKey(storeKey) {
        return { storeKey };
    },
    getStatus() {
        return READY;
    },
    hasChangesForType() {
        // The client change has been committed to the server by the time the
        // confirming update arrives, so the query has no outstanding changes.
        return false;
    },
    addQuery() {},
    removeQuery() {},
    on() {
        return this;
    },
    off() {
        return this;
    },
};

let fetchCount = 0;
const source = {
    fetchQuery() {
        fetchCount += 1;
        return this;
    },
};

function Type() {}

// --- The exact event payloads from the Sentry `log` array ---
const QS = {
    s791: '~244791',
    s840: '~244840',
    s848: '~244848',
    s856: '~244856',
    s864: '~244864',
    s865: '~244865',
};

const E1_ids = [
    'StohS7w3QcXJ',
    'StohSAV3thn7',
    'StohSNXuky6g',
    'StohSYIalIiV',
    'StohVAeYd7ho',
    'StohX_DqswlR',
    'Stohhuz2FGz7',
    'StohiwxvXbrc',
    'StohsbpPpRTN',
    'StohvXyR_Quo',
    'StohvZgHxwTN',
    'StohxwkrbBy-',
    'Stohztt0hjZc',
    'Stoi1HJleY4F',
    'Stoi1Y0G7eWN',
    'Stoi5q-qh4yF',
    'Stoi5q38eJC3',
    'Stoi5rkBhPys',
    'Stoi6R1TYkiV',
    'StoiB9bw6Sq7',
    'StoiB9sd8N9Z',
    'StoiCy201-qw',
    'StoiF3zRgMDc',
    'StoiGKQQl6t-',
    'StoiKFNtzQ2F',
    'StoiMymgeafw',
    'StoiOVK9EiKB',
    'StoiOwM8tVS-',
    'StoiQpawYJ3R',
    'StoiRfzB2SJo',
];
const E2_ids = [
    'StoiSQm-9amN',
    'StoiSjS_kPb7',
    'StoiSxjCCVgs',
    'StoiSzJd3-uc',
    'StoiTIvG4QKV',
    'StoiU8Ske3MV',
    'StoiUhfQhxhR',
    'StoiUj0wL9yg',
    'StoiVZbtWdjJ',
    'StoiVZkRr7p3',
    'StoiWdg1LLqc',
    'StoiWeuZECLF',
    'StoiX1wz8WCZ',
    'StoiXX7wjf77',
    'StoiYGJOHSxZ',
    'StoiZh6ZCVoB',
    'StoiaLTaXHG3',
    'StoiahrtkF1-',
    'StoiatSuIwdF',
    'StoicG6RqT1c',
    'StoicfJLetHk',
    'Stoid3Xk1aJV',
    'StoidYd7f0lJ',
    'Stoiir4jiJN3',
    'StoikclfGD6R',
    'StoiqrxWRVWB',
    'StoizURXE4rs',
    'Stoj-RmiVurg',
    'Stoj2smQMyT3',
    'Stoj91IBTRkR',
];
const E3_ids = [
    'Stoj97MYtoYo',
    'Stoj9Y5VBgdg',
    'Stoj9mot5Pq-',
    'StojB63rsJ_-',
    'StojCP1_3ceZ',
    'StojCfs2s1Bo',
    'StojCg0Qcs_Z',
    'StojERkYkcA7',
    'StojEiE4FjXk',
    'StojG81U_Tqs',
    'StojGTM3WMbo',
    'StojK8X7nPpN',
    'StojKXfSFNkk',
    'StojKquanF3V',
    'StojLsJebXo3',
    'StojP_Hj1qWJ',
    'StojPppbS7i3',
    'StojRPoxH8W7',
    'StojT5rwUK4J',
    'StojUreHwqJ3',
    'StojVQpWAbAo',
    'StokresN7NR3',
    'StoksBBs6W0F',
    'Stol_8BLwrsk',
    'StolokCVjtGk',
    'Stom9oJvKVUg',
    'StomAko0hF5c',
    'StonC7Fydtag',
    'StonI4TDUhQk',
    'Stot4McWczmk',
];
const E4_removed = [
    'StohS7w3QcXJ',
    'StoiatSuIwdF',
    'StoiahrtkF1-',
    'StoiaLTaXHG3',
    'StoiZh6ZCVoB',
    'StoiYGJOHSxZ',
    'StoiXX7wjf77',
    'StoiX1wz8WCZ',
    'StoiWeuZECLF',
    'StoiWdg1LLqc',
    'StoiVZkRr7p3',
    'StoiVZbtWdjJ',
    'StoiUj0wL9yg',
    'StoiUhfQhxhR',
    'StoiU8Ske3MV',
    'StoiTIvG4QKV',
    'StoiSzJd3-uc',
    'StoiSxjCCVgs',
    'StoiSjS_kPb7',
    'StoiSQm-9amN',
    'StoiRfzB2SJo',
    'StoiQpawYJ3R',
    'StoiOwM8tVS-',
    'StoiOVK9EiKB',
    'StoiMymgeafw',
    'StoiKFNtzQ2F',
    'StoiGKQQl6t-',
    'StoiF3zRgMDc',
    'StoiCy201-qw',
    'StoiB9sd8N9Z',
    'StoiB9bw6Sq7',
    'Stoi6R1TYkiV',
    'Stoi5rkBhPys',
    'Stoi5q38eJC3',
    'Stoi5q-qh4yF',
    'Stoi1Y0G7eWN',
    'Stoi1HJleY4F',
    'Stohztt0hjZc',
    'StohxwkrbBy-',
    'StohvZgHxwTN',
    'StohvXyR_Quo',
    'StohsbpPpRTN',
    'StohiwxvXbrc',
    'Stohhuz2FGz7',
    'StohX_DqswlR',
    'StohVAeYd7ho',
    'StohSYIalIiV',
    'StohSNXuky6g',
    'StohSAV3thn7',
];
const E5_removed = [
    'StoicG6RqT1c',
    'StoizURXE4rs',
    'StoiqrxWRVWB',
    'StoikclfGD6R',
    'Stoiir4jiJN3',
    'StoidYd7f0lJ',
    'Stoid3Xk1aJV',
    'StoicfJLetHk',
];
const E6_ids = [
    'StojUreHwqJ3',
    'StojVQpWAbAo',
    'StokresN7NR3',
    'StoksBBs6W0F',
    'Stol_8BLwrsk',
    'StolokCVjtGk',
    'Stom9oJvKVUg',
    'StomAko0hF5c',
    'StonC7Fydtag',
    'StonI4TDUhQk',
    'Stot4McWczmk',
    'StotU-VI1Z77',
    'StoudZWIm4zB',
    'Stouf0aYZfxc',
    'StoujDeVDbHc',
    'Stp-lJSEEu4-',
    'Stp4ZfZru2NZ',
    'StpSCUt_4caF',
    'StpSEpJKSrqk',
];
const E7_removed = E4_removed.slice().sort();
const E9_removed = E7_removed.concat(E5_removed);
const E10_removed = [
    'StoicG6RqT1c',
    'StoicfJLetHk',
    'Stoid3Xk1aJV',
    'StoidYd7f0lJ',
    'Stoiir4jiJN3',
    'StoikclfGD6R',
    'StoiqrxWRVWB',
    'StoizURXE4rs',
];
const E11_removed = [
    'Stoj-RmiVurg',
    'StojCP1_3ceZ',
    'StojB63rsJ_-',
    'Stoj9mot5Pq-',
    'Stoj9Y5VBgdg',
    'Stoj97MYtoYo',
    'Stoj91IBTRkR',
    'Stoj2smQMyT3',
];
const E12_removed = [
    'Stoj-RmiVurg',
    'Stoj2smQMyT3',
    'Stoj91IBTRkR',
    'Stoj97MYtoYo',
    'Stoj9Y5VBgdg',
    'Stoj9mot5Pq-',
    'StojB63rsJ_-',
    'StojCP1_3ceZ',
];
const E13_removed = [
    'StojCfs2s1Bo',
    'StojKXfSFNkk',
    'StojK8X7nPpN',
    'StojGTM3WMbo',
    'StojG81U_Tqs',
    'StojEiE4FjXk',
    'StojERkYkcA7',
    'StojCg0Qcs_Z',
];
const E14_removed = [
    'StojCfs2s1Bo',
    'StojCg0Qcs_Z',
    'StojERkYkcA7',
    'StojEiE4FjXk',
    'StojG81U_Tqs',
    'StojGTM3WMbo',
    'StojK8X7nPpN',
    'StojKXfSFNkk',
];
const E15_added = [{ index: 0, id: 'StohQd2G_qPg' }];

// --- Build the query ---
const ACCOUNT = 'u00584147';
const query = new WindowedQuery({
    store,
    source,
    accountId: ACCOUNT,
    Type,
    where: { inMailbox: 'PR-' },
    sort: [{ property: 'receivedAt', isAscending: false }],
});

const sk = (id) => store.getStoreKey(ACCOUNT, Type, id);

function ids(idList, position, queryState, total) {
    query.sourceDidFetchIds({
        accountId: ACCOUNT,
        queryState,
        ids: idList,
        position,
        total,
        canCalculateChanges: true,
        isPartialResult: false,
        isOfflineSearch: false,
    });
}
function clientRemove(removedIds) {
    query.clientDidGenerateUpdate({ added: [], removed: removedIds.map(sk) });
}
function sourceUpdate(oldQS, newQS, removedIds, added, total, upToId) {
    query.sourceDidFetchUpdate({
        accountId: ACCOUNT,
        oldQueryState: oldQS,
        newQueryState: newQS,
        removed: removedIds,
        added,
        total,
        upToId,
    });
}
// Models the round-trip that clears DIRTY/LOADING once the client change has
// been committed to the server. This is the state the Sentry log omits and
// without which the bug does not surface.
function commitRoundTrip() {
    const spec = query.sourceWillFetchQuery();
    if (spec && spec.callback) {
        spec.callback();
    }
}

// --- Assertions ---
const failures = [];
function check(label) {
    const list = query.getStoreKeys();
    const length = query.get('length');
    // Duplicate store key within the live list?
    const seen = new Set();
    for (let i = 0; i < list.length; i += 1) {
        const storeKey = list[i];
        if (!storeKey) {
            continue;
        }
        if (seen.has(storeKey)) {
            failures.push(
                `[${label}] duplicate store key ${storeKey} at index ${i}`,
            );
            break;
        }
        seen.add(storeKey);
    }
    // The backing array must never grow longer than the query length. (It may
    // be shorter while windows are still being fetched — that is normal.)
    if (length !== null && list.length > length) {
        failures.push(
            `[${label}] _storeKeys length ${list.length} exceeds query length ${length}`,
        );
    }
}

// --- Replay the external event sequence ---
ids(E1_ids, 0, QS.s791, 98);
check('E1');
ids(E2_ids, 30, QS.s791, 98);
check('E2');
ids(E3_ids, 60, QS.s791, 98);
check('E3');
clientRemove(E4_removed);
check('E4');
clientRemove(E5_removed);
check('E5');
ids(E6_ids, 30, QS.s840, 49);
check('E6 (deferred)');
commitRoundTrip();
sourceUpdate(QS.s791, QS.s840, E7_removed, [], 49, 'Stot4McWczmk');
check('E7 (drains E6)');
sourceUpdate(QS.s791, QS.s848, E9_removed, [], 41, 'Stot4McWczmk');
check('E9 (rejected)');
sourceUpdate(QS.s840, QS.s848, E10_removed, [], 41, 'StpSEpJKSrqk');
check('E10');
clientRemove(E11_removed);
check('E11');
commitRoundTrip();
sourceUpdate(QS.s848, QS.s856, E12_removed, [], 33, 'StpSEpJKSrqk');
check('E12');
clientRemove(E13_removed);
check('E13');
commitRoundTrip();
sourceUpdate(QS.s856, QS.s864, E14_removed, [], 25, 'StpSEpJKSrqk');
check('E14');
sourceUpdate(QS.s864, QS.s865, [], E15_added, 26, 'StpSEpJKSrqk');
check('E15');

// --- Final-state assertions ---
const finalList = query.getStoreKeys();
const finalLength = query.get('length');

if (finalLength !== 26) {
    failures.push(`final length expected 26, got ${finalLength}`);
}
if (finalList.length !== 26) {
    failures.push(
        `final _storeKeys.length expected 26, got ${finalList.length}`,
    );
}
// The de-duplicated, correct result, expressed as ids (store-key-numbering
// independent), in query order.
const expectedIds = [
    'StohQd2G_qPg',
    'StojKquanF3V',
    'StojLsJebXo3',
    'StojP_Hj1qWJ',
    'StojPppbS7i3',
    'StojRPoxH8W7',
    'StojT5rwUK4J',
    'StojUreHwqJ3',
    'StojVQpWAbAo',
    'StokresN7NR3',
    'StoksBBs6W0F',
    'Stol_8BLwrsk',
    'StolokCVjtGk',
    'Stom9oJvKVUg',
    'StomAko0hF5c',
    'StonC7Fydtag',
    'StonI4TDUhQk',
    'Stot4McWczmk',
    'StotU-VI1Z77',
    'StoudZWIm4zB',
    'Stouf0aYZfxc',
    'StoujDeVDbHc',
    'Stp-lJSEEu4-',
    'Stp4ZfZru2NZ',
    'StpSCUt_4caF',
    'StpSEpJKSrqk',
];
const expectedStoreKeys = expectedIds.map((id) => idToStoreKey.get(id));
const actualMatchesExpectedShape =
    finalList.length === expectedStoreKeys.length &&
    finalList.every((v, i) => v === expectedStoreKeys[i]);
if (!actualMatchesExpectedShape) {
    failures.push(
        'final list does not match expected de-duplicated result:\n' +
            `  expected store keys: ${JSON.stringify(expectedStoreKeys)}\n` +
            `  actual store keys:   ${JSON.stringify(finalList)}`,
    );
}

// --- Report ---
if (failures.length) {
    console.error('FAIL: WindowedQuery deferred-packet regression');
    for (const f of failures) {
        console.error('  - ' + f);
    }
    process.exit(1);
}
console.log(
    'PASS: WindowedQuery deferred-packet regression (no duplicate store keys)',
);
console.log(
    `  final length=${finalLength}, _storeKeys.length=${finalList.length}, fetches=${fetchCount}`,
);
