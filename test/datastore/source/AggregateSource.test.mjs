import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { AggregateSource, Class, Source, Todo } from '../helpers.mjs';

// A source that handles a request only when `handles` says so, recording any
// call it actually handles.
const ScriptedSource = Class({
    Name: 'ScriptedSource',
    Extends: Source,
    init: function (...mixins) {
        this.handled = [];
        ScriptedSource.parent.constructor.apply(this, mixins);
    },
    fetchRecord(accountId, Type, id) {
        if (this.handles) {
            this.handled.push(id);
            return true;
        }
        return false;
    },
    commitChanges(changes, callback) {
        if (this.handles) {
            this.handled.push('commit');
            // Real sources complete asynchronously; stash the callback so the
            // test can fire it after AggregateSource has finished its fan-out
            // (and incremented its internal waiting counter).
            this.pendingCallback = callback;
            return true;
        }
        return false;
    },
});

describe('Source (base class)', () => {
    test('default methods report the request was not handled', () => {
        const source = new Source();
        assert.equal(source.fetchRecord('a', Todo, 'id'), false);
        assert.equal(source.fetchAllRecords('a', Todo, null), false);
        assert.equal(source.fetchQuery({}), false);
        assert.equal(source.commitChanges({}), false);
    });

    test('refreshRecord falls through to fetchRecord by default', () => {
        const source = new Source();
        let fetched = null;
        source.fetchRecord = (accountId, Type, id) => {
            fetched = id;
            return true;
        };
        assert.equal(source.refreshRecord('a', Todo, 'id-1'), true);
        assert.equal(fetched, 'id-1');
    });
});

describe('AggregateSource', () => {
    test('routes a request to the first source that handles it', () => {
        const aggregate = new AggregateSource();
        const first = new ScriptedSource({ handles: false });
        const second = new ScriptedSource({ handles: true });
        const third = new ScriptedSource({ handles: true });
        aggregate.addSource(first);
        aggregate.addSource(second);
        aggregate.addSource(third);

        const handled = aggregate.fetchRecord('a', Todo, 'id-1');
        assert.equal(handled, true);
        assert.deepEqual(first.handled, []);
        assert.deepEqual(second.handled, ['id-1']);
        // Stops at the first handler — does not also hit the third.
        assert.deepEqual(third.handled, []);
    });

    test('returns falsy when no source handles the request', () => {
        const aggregate = new AggregateSource();
        aggregate.addSource(new ScriptedSource({ handles: false }));
        aggregate.addSource(new ScriptedSource({ handles: false }));
        assert.ok(!aggregate.fetchRecord('a', Todo, 'id-1'));
    });

    test('commitChanges fans out to every source that accepts it', () => {
        const aggregate = new AggregateSource();
        const a = new ScriptedSource({ handles: true });
        const b = new ScriptedSource({ handles: false });
        const c = new ScriptedSource({ handles: true });
        aggregate.addSource(a);
        aggregate.addSource(b);
        aggregate.addSource(c);

        let callbackCount = 0;
        aggregate.commitChanges({}, () => {
            callbackCount += 1;
        });

        assert.deepEqual(a.handled, ['commit']);
        assert.deepEqual(b.handled, []);
        assert.deepEqual(c.handled, ['commit']);

        // Two sources accepted, so the shared callback must wait for both to
        // complete and then fire exactly once.
        a.pendingCallback();
        assert.equal(
            callbackCount,
            0,
            'not yet — one source still outstanding',
        );
        c.pendingCallback();
        assert.equal(callbackCount, 1, 'fires once both have completed');
    });

    test('removeSource takes a source out of the rotation', () => {
        const aggregate = new AggregateSource();
        const only = new ScriptedSource({ handles: true });
        aggregate.addSource(only);
        aggregate.removeSource(only);
        assert.ok(!aggregate.fetchRecord('a', Todo, 'id-1'));
        assert.deepEqual(only.handled, []);
    });
});
