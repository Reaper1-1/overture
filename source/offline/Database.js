import { platform } from '../ua/UA.js';

// ---

/*global indexedDB */

// https://bugs.webkit.org/show_bug.cgi?id=288682
// In WebKit, if the worker running the transaction is killed, it does not
// perform micro tasks, so promise resolution never happens, and it ends up
// thinking there are no more requests so automatically commits the transaction.
const needsKeepAlive = platform === 'ios';

class Database {
    // name: string
    // version: number
    // setup: (db,oldVersion,newVersion)
    // needsUpdate (optional)
    constructor(mixin) {
        this._db = null;
        this._transactions = new Set();
        Object.assign(this, mixin);
    }

    needsUpdate() {}

    open() {
        if (this._db) {
            return this._db;
        }
        const _db = new Promise((resolve, reject) => {
            const name = this.name;
            const request = indexedDB.open(name, this.version);
            request.onupgradeneeded = (event) => {
                const db = request.result;
                this.setup(
                    db,
                    event.newVersion,
                    event.oldVersion,
                    request.transaction,
                );
            };
            request.onsuccess = () => {
                const db = request.result;
                this.objectStoreNames = Array.from(db.objectStoreNames);
                db.onversionchange = () => this.needsUpdate();
                db.onclose = () => {
                    if (this._db === _db) {
                        this._db = null;
                    }
                };
                resolve(db);
            };
            request.onerror = () => reject(request.error);
        });
        _db.catch(() => {
            if (this._db === _db) {
                this._db = null;
            }
        });
        this._db = _db;
        return _db;
    }

    // Mode = readwrite or readonly
    async transaction(storeNames, mode, fn) {
        const db = await this.open();
        if (!storeNames) {
            storeNames = this.objectStoreNames;
        } else if (typeof storeNames === 'string') {
            storeNames = [storeNames];
        }
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve, reject) => {
            const transaction = db.transaction(storeNames, mode);
            this._transactions.add(transaction);
            transaction.onabort = () => {
                this._transactions.delete(transaction);
                reject(transaction.error);
            };
            transaction.oncomplete = () => {
                this._transactions.delete(transaction);
                resolve();
            };

            // Keep-alive for WebKit bug
            let shouldKeepTransactionAlive =
                needsKeepAlive && mode === 'readwrite';
            function keepTransactionAlive(txn) {
                if (!shouldKeepTransactionAlive) {
                    return;
                }
                const request = txn.objectStore(storeNames[0]).get('');
                request.onsuccess = (event) => {
                    keepTransactionAlive(event.target.transaction);
                };
            }

            try {
                keepTransactionAlive(transaction);
                await fn(transaction);
                shouldKeepTransactionAlive = false;
                transaction.commit();
            } catch (error) {
                reject(error);
                shouldKeepTransactionAlive = false;
                transaction.abort();
            }
        });
    }

    async close() {
        const _db = this._db;
        if (_db) {
            this._transactions.forEach((transaction) => {
                // This will throw an InvalidStateError if the transaction
                // has already completed/aborted
                try {
                    transaction.abort();
                } catch (error) {}
            });
            this._db = null;
            const db = await _db;
            db.close();
        }
    }
}

const promisify = (request) =>
    new Promise((resolve, reject) => {
        if (request.readyState === 'done') {
            if (request.error) {
                reject(request.error);
            } else {
                resolve(request.result);
            }
            return;
        }
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

const iterate = async function* (cursor) {
    while (true) {
        const result = await promisify(cursor);
        if (!result) {
            break;
        }
        yield result;
        result.continue();
    }
};

export { Database, promisify, iterate };
