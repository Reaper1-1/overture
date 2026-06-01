import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { Status } from './helpers.mjs';

const {
    EMPTY,
    READY,
    DESTROYED,
    NON_EXISTENT,
    LOADING,
    COMMITTING,
    NEW,
    DIRTY,
    OBSOLETE,
    UNSAVED,
} = Status;

describe('Status', () => {
    test('core states are distinct single bits', () => {
        const coreStates = [EMPTY, READY, DESTROYED, NON_EXISTENT];
        for (const state of coreStates) {
            // power of two => exactly one bit set
            assert.equal(state & (state - 1), 0, `${state} is a single bit`);
        }
        assert.equal(new Set(coreStates).size, 4, 'core states are distinct');
    });

    test('property bits do not overlap each other or core states', () => {
        const all = [
            EMPTY,
            READY,
            DESTROYED,
            NON_EXISTENT,
            LOADING,
            COMMITTING,
            NEW,
            DIRTY,
            OBSOLETE,
        ];
        let union = 0;
        for (const bit of all) {
            assert.equal(
                union & bit,
                0,
                `${bit} does not overlap earlier bits`,
            );
            union |= bit;
        }
        // Nine distinct bits => popcount 9.
        assert.equal(
            union
                .toString(2)
                .split('')
                .filter((c) => c === '1').length,
            9,
        );
    });

    test('UNSAVED is sugar for READY|NEW|DIRTY', () => {
        assert.equal(UNSAVED, READY | NEW | DIRTY);
        assert.ok(UNSAVED & READY);
        assert.ok(UNSAVED & NEW);
        assert.ok(UNSAVED & DIRTY);
        assert.equal(UNSAVED & COMMITTING, 0);
    });

    test('bitwise composition and testing behaves as the store uses it', () => {
        let status = READY;
        status |= DIRTY;
        assert.ok(status & READY);
        assert.ok(status & DIRTY);

        // clearing a bit
        status &= ~DIRTY;
        assert.equal(status & DIRTY, 0);
        assert.ok(status & READY);
    });
});
