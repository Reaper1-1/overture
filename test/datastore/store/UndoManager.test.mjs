import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
    ACCOUNT_ID,
    Class,
    makeStore,
    seedRecords,
    Todo,
} from '../helpers.mjs';
import { UndoManager } from '../../../source/datastore/store/UndoManager.js';
import { StoreUndoManager } from '../../../source/datastore/store/StoreUndoManager.js';

// A concrete UndoManager that records how the base class drives the
// getUndoData / applyChange contract. applyChange returns a synthetic inverse
// ('inv:<data>') which the base class pushes onto the opposite stack, so we
// can follow exactly what is undone and redone.
function makeSpyManager(mixin) {
    const applied = [];
    const manager = new (Class({
        Name: 'SpyUndoManager',
        Extends: UndoManager,
        getUndoData() {
            return this._next;
        },
        applyChange(data, isRedo) {
            applied.push({ data, isRedo });
            return 'inv:' + data;
        },
    }))(mixin);
    return { manager, applied };
}

describe('UndoManager (base)', () => {
    test('a fresh manager cannot undo or redo', () => {
        const { manager } = makeSpyManager();
        assert.equal(manager.get('canUndo'), false);
        assert.equal(manager.get('canRedo'), false);
    });

    test('dataDidChange makes the state undoable', () => {
        const { manager } = makeSpyManager();
        manager.dataDidChange();
        assert.equal(manager.get('canUndo'), true);
        assert.equal(manager.get('canRedo'), false);
    });

    test('undo pops the latest checkpoint and redo replays it', () => {
        const { manager, applied } = makeSpyManager({ maxUndoCount: 10 });
        manager.saveUndoCheckpoint('s1');
        manager.saveUndoCheckpoint('s2');
        assert.equal(manager.get('canUndo'), true);
        assert.equal(manager.get('canRedo'), false);

        manager.undo();
        assert.deepEqual(applied.at(-1), { data: 's2', isRedo: false });
        assert.equal(manager.get('canUndo'), true); // s1 still there
        assert.equal(manager.get('canRedo'), true);

        manager.redo();
        // redo applies the inverse that undo produced.
        assert.deepEqual(applied.at(-1), { data: 'inv:s2', isRedo: true });

        manager.undo();
        assert.deepEqual(applied.at(-1), { data: 'inv:inv:s2', isRedo: false });
    });

    test('saving a new checkpoint clears the redo stack', () => {
        const { manager } = makeSpyManager({ maxUndoCount: 10 });
        manager.saveUndoCheckpoint('s1');
        manager.undo();
        assert.equal(manager.get('canRedo'), true);

        manager.saveUndoCheckpoint('s2');
        assert.equal(manager.get('canRedo'), false);
    });

    test('maxUndoCount bounds how far back undo can go', () => {
        const { manager, applied } = makeSpyManager({ maxUndoCount: 2 });
        manager.saveUndoCheckpoint('a');
        manager.saveUndoCheckpoint('b');
        manager.saveUndoCheckpoint('c'); // 'a' drops off the bottom

        manager.undo();
        manager.undo();
        assert.equal(
            manager.get('canUndo'),
            false,
            'only two checkpoints kept',
        );
        assert.deepEqual(
            applied.map((call) => call.data),
            ['c', 'b'],
        );
    });
});

describe('StoreUndoManager', () => {
    test('undo reverts a committed record edit and redo re-applies it', () => {
        const { store, flush } = makeStore();
        const [sk] = seedRecords(store, Todo, [{ id: 't1', title: 'orig' }]);
        const manager = new StoreUndoManager({ store });

        store.getRecord(ACCOUNT_ID, Todo, 't1').set('title', 'edited');
        store.commitChanges();
        flush();
        store.sourceDidCommitUpdate([sk]);
        flush();

        assert.equal(store.getData(sk).title, 'edited');
        assert.equal(manager.get('canUndo'), true);

        manager.undo();
        flush();
        assert.equal(store.getData(sk).title, 'orig');
        assert.equal(manager.get('canRedo'), true);

        store.sourceDidCommitUpdate([sk]);
        flush();
        manager.redo();
        flush();
        assert.equal(store.getData(sk).title, 'edited');
    });
});
