import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
    ACCOUNT_ID,
    attr,
    Class,
    makeStore,
    Record,
    seedRecords,
} from '../helpers.mjs';
import { toOne } from '../../../source/datastore/record/toOne.js';
import { toMany } from '../../../source/datastore/record/toMany.js';
import {
    REQUIRED,
    TOO_SHORT,
    ValidationError,
} from '../../../source/datastore/record/ValidationError.js';

describe('RecordAttribute', () => {
    const Thing = Class({
        Name: 'Thing',
        Extends: Record,
        // Stored under a different key in the data object.
        label: attr(String, { key: 'lbl', defaultValue: 'none' }),
        count: attr(Number, { defaultValue: 0 }),
    });

    test('reads through a custom data key', () => {
        const { store } = makeStore();
        seedRecords(store, Thing, [{ id: 'x', lbl: 'hello' }]);
        assert.equal(
            store.getRecord(ACCOUNT_ID, Thing, 'x').get('label'),
            'hello',
        );
    });

    test('falls back to defaultValue when the attribute is absent', () => {
        const { store } = makeStore();
        seedRecords(store, Thing, [{ id: 'y' }]);
        const record = store.getRecord(ACCOUNT_ID, Thing, 'y');
        assert.equal(record.get('label'), 'none');
        assert.equal(record.get('count'), 0);
    });

    test('throws when set to a value of the wrong type', () => {
        const { store } = makeStore();
        seedRecords(store, Thing, [{ id: 'x', lbl: 'hello' }]);
        const record = store.getRecord(ACCOUNT_ID, Thing, 'x');
        assert.throws(
            () => record.set('count', 'not a number'),
            /Incorrect value type/,
        );
    });

    test('writing an attribute updates the underlying data', () => {
        const { store } = makeStore();
        const [sk] = seedRecords(store, Thing, [{ id: 'x', lbl: 'hello' }]);
        store.getRecord(ACCOUNT_ID, Thing, 'x').set('label', 'world');
        // Data is keyed by the attribute's `key`, not its property name.
        assert.equal(store.getData(sk).lbl, 'world');
    });
});

describe('RecordAttribute validation', () => {
    const Item = Class({
        Name: 'Item',
        Extends: Record,
        title: attr(String, {
            defaultValue: '',
            validate(value) {
                if (!value) {
                    return new ValidationError(REQUIRED, 'required');
                }
                if (value.length < 3) {
                    return new ValidationError(TOO_SHORT, 'too short');
                }
                return null;
            },
        }),
    });

    test('validate returns a ValidationError or null', () => {
        const titleAttr = Item.prototype.title;
        assert.equal(titleAttr.validate('', 'title', null).type, REQUIRED);
        assert.equal(titleAttr.validate('ab', 'title', null).type, TOO_SHORT);
        assert.equal(titleAttr.validate('abcd', 'title', null), null);
    });

    test('a record with valid data reports isValid', () => {
        const { store } = makeStore();
        seedRecords(store, Item, [{ id: 'i1', title: 'hello' }]);
        assert.equal(
            store.getRecord(ACCOUNT_ID, Item, 'i1').get('isValid'),
            true,
        );
    });
});

describe('toOne attribute', () => {
    const Author = Class({
        Name: 'Author',
        Extends: Record,
        name: attr(String, { defaultValue: '' }),
    });
    const Book = Class({
        Name: 'Book',
        Extends: Record,
        title: attr(String, { defaultValue: '' }),
        author: toOne({ Type: Author, key: 'authorId', isNullable: true }),
    });

    test('resolves a stored foreign key to the referenced record', () => {
        const { store } = makeStore();
        seedRecords(store, Author, [{ id: 'a1', name: 'Asimov' }]);
        seedRecords(store, Book, [
            { id: 'b1', title: 'Foundation', authorId: 'a1' },
        ]);
        const author = store.getRecord(ACCOUNT_ID, Book, 'b1').get('author');
        assert.ok(author instanceof Author);
        assert.equal(author.get('name'), 'Asimov');
    });

    test('can be set to another record and to null', () => {
        const { store } = makeStore();
        seedRecords(store, Author, [
            { id: 'a1', name: 'Asimov' },
            { id: 'a2', name: 'Clarke' },
        ]);
        seedRecords(store, Book, [
            { id: 'b1', title: 'Foundation', authorId: 'a1' },
        ]);
        const book = store.getRecord(ACCOUNT_ID, Book, 'b1');

        book.set('author', store.getRecord(ACCOUNT_ID, Author, 'a2'));
        assert.equal(book.get('author').get('name'), 'Clarke');

        book.set('author', null);
        assert.equal(book.get('author'), null);
    });
});

describe('toMany attribute', () => {
    const Book = Class({
        Name: 'Book',
        Extends: Record,
        title: attr(String, { defaultValue: '' }),
    });
    const Shelf = Class({
        Name: 'Shelf',
        Extends: Record,
        books: toMany({ recordType: Book, key: 'bookIds', defaultValue: [] }),
    });

    test('exposes referenced records as an enumerable record array', () => {
        const { store } = makeStore();
        seedRecords(store, Book, [
            { id: 'b1', title: 'Foundation' },
            { id: 'b2', title: 'Dune' },
        ]);
        seedRecords(store, Shelf, [{ id: 's1', bookIds: ['b1', 'b2'] }]);

        const books = store.getRecord(ACCOUNT_ID, Shelf, 's1').get('books');
        assert.equal(books.get('length'), 2);
        assert.equal(books.getObjectAt(0).get('title'), 'Foundation');
        assert.equal(books.getObjectAt(1).get('title'), 'Dune');
    });

    test('defaults to an empty array', () => {
        const { store } = makeStore();
        seedRecords(store, Shelf, [{ id: 's2' }]);
        assert.equal(
            store.getRecord(ACCOUNT_ID, Shelf, 's2').get('books').get('length'),
            0,
        );
    });
});
