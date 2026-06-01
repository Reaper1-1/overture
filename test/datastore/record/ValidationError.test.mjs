import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
    FIRST_CUSTOM_ERROR,
    INVALID_CHAR,
    REQUIRED,
    TOO_LONG,
    TOO_SHORT,
    ValidationError,
} from '../../../source/datastore/record/ValidationError.js';

describe('ValidationError', () => {
    test('stores its type and explanation', () => {
        const error = new ValidationError(REQUIRED, 'This field is required');
        assert.equal(error.type, REQUIRED);
        assert.equal(error.explanation, 'This field is required');
    });

    test('the built-in error codes are distinct single bits', () => {
        const codes = [REQUIRED, TOO_SHORT, TOO_LONG, INVALID_CHAR];
        for (const code of codes) {
            assert.equal(code & (code - 1), 0, `${code} is a single bit`);
        }
        assert.equal(new Set(codes).size, 4);
    });

    test('error codes can be combined and tested as a bitfield', () => {
        const combined = TOO_SHORT | INVALID_CHAR;
        assert.ok(combined & TOO_SHORT);
        assert.ok(combined & INVALID_CHAR);
        assert.equal(combined & REQUIRED, 0);
    });

    test('FIRST_CUSTOM_ERROR sits above all the built-in codes', () => {
        for (const code of [REQUIRED, TOO_SHORT, TOO_LONG, INVALID_CHAR]) {
            assert.ok(code < FIRST_CUSTOM_ERROR);
        }
    });
});
