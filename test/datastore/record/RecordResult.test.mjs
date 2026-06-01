import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { ACCOUNT_ID, makeStore, seedRecords, Todo } from '../helpers.mjs';
import { HANDLE_ALL_ERRORS } from '../../../source/datastore/record/RecordResult.js';

// Commit an edit to a seeded record and report the result back to the test.
function editAndCommit(store, flush, mutate) {
    const [sk] = seedRecords(store, Todo, [{ id: 't1', title: 'orig' }]);
    const record = store.getRecord(ACCOUNT_ID, Todo, 't1');
    record.set('title', 'edited');
    const promise = mutate(record);
    store.commitChanges();
    flush();
    return { sk, record, promise };
}

describe('RecordResult / Record promise API', () => {
    test('getResult resolves with the record after a successful commit', async () => {
        const { store, flush } = makeStore();
        const record = new Todo(store);
        record.set('title', 'fresh');
        record.saveToStore();
        const sk = record.get('storeKey');

        const promise = record.getResult();
        store.commitChanges();
        flush();
        store.sourceDidCommitCreate({ [sk]: { id: 'server-1' } });
        flush();

        const result = await promise;
        assert.equal(result.error, null);
        assert.equal(result.record.get('id'), 'server-1');
    });

    test('getResult resolves with the error captured on a commit failure', async () => {
        const { store, flush } = makeStore();
        const { sk, promise } = editAndCommit(store, flush, (record) =>
            record.getResult({ handledErrorTypes: HANDLE_ALL_ERRORS }),
        );

        store.sourceDidNotUpdate([sk], true, [{ type: 'somethingWrong' }]);
        flush();

        const result = await promise;
        assert.ok(result.error);
        assert.equal(result.error.type, 'somethingWrong');
    });

    test('ifSuccess resolves with the record on success', async () => {
        const { store, flush } = makeStore();
        const { sk, promise } = editAndCommit(store, flush, (record) =>
            record.ifSuccess(),
        );

        store.sourceDidCommitUpdate([sk]);
        flush();

        const record = await promise;
        assert.equal(record.get('title'), 'edited');
    });

    test('ifSuccess rejects with the result on a commit error', async () => {
        const { store, flush } = makeStore();
        const { sk, promise } = editAndCommit(store, flush, (record) =>
            record.ifSuccess().then(
                () => ({ outcome: 'resolved' }),
                (result) => ({ outcome: 'rejected', result }),
            ),
        );

        store.sourceDidNotUpdate([sk], true, [{ type: 'boom' }]);
        flush();

        const settled = await promise;
        assert.equal(settled.outcome, 'rejected');
        assert.equal(settled.result.error.type, 'boom');
    });
});
