import { Class, meta } from '../../core/Core.js';
import { bind, Binding } from '../../foundation/Binding.js';
import { Enumerable } from '../../foundation/Enumerable.js';
import { Obj } from '../../foundation/Object.js';
import { ObservableRange } from '../../foundation/ObservableRange.js';

/* { on, property } from */
import '../../foundation/Decorators.js';

// ---

const all = {};

/**
    Class: O.SubsetQueryProxy

    A SubsetQueryProxy wraps a Query and presents a subset of its results as if
    it were a query in its own right. The results are partitioned into groups
    (as described by the underlying query's `groupByCounts`) and any number of
    those groups may be "collapsed", in which case their members are hidden from
    the proxy's view of the list. The header for a collapsed group remains in
    place (the proxy simply reports a shorter length and remaps indexes); it is
    up to the view layer to keep drawing the header.

    All the index-based accessors translate between the proxy's (collapsed)
    index space and the underlying query's (full) index space. Range and
    `query:updated` notifications from the underlying query are likewise
    translated before being re-emitted to the proxy's own observers.
*/
const SubsetQueryProxy = Class({
    Name: 'SubsetQueryProxy',

    Extends: Obj,

    Mixin: [Enumerable, ObservableRange],

    init: function () {
        this.collapsedGroups = new Set();
        SubsetQueryProxy.parent.init.apply(this, arguments);
        const query = this.query;
        query.nextEventTarget = this;
        query.addObserverForRange(all, this, 'proxyRangeChange');
        // The views observe ranges on us, not the query, so tell the query
        // what is actually in use rather than letting it see our catch-all
        // observer and conclude the whole list is.
        if (query.getObservedRanges) {
            this._getObservedRanges = () => this.getObservedRealRanges();
            query.getObservedRanges = this._getObservedRanges;
        }
    },

    destroy() {
        const query = this.query;
        query.removeObserverForRange(all, this, 'proxyRangeChange');
        // Only relinquish the event target and range hook if they're still
        // ours: a newer proxy may already have taken over this query.
        if (query.nextEventTarget === this) {
            query.nextEventTarget = null;
        }
        if (query.getObservedRanges === this._getObservedRanges) {
            delete query.getObservedRanges;
        }
        SubsetQueryProxy.parent.destroy.call(this);
    },

    error: bind(null, 'query*error'),
    status: bind(null, 'query*status'),

    get(key) {
        if (!(key in this)) {
            return this.query.get(key);
        }
        return SubsetQueryProxy.parent.get.call(this, key);
    },

    // --- Group geometry ---

    /**
        Method (private): O.SubsetQueryProxy#_groupRanges

        Returns an array describing each group as a range in the underlying
        query's index space: `{ group, start, count }`. There is always a final
        "other" group (index === groupByCounts.length) covering everything not
        in an explicit category.
    */
    _groupRanges: function () {
        const counts = this.get('groupByCounts');
        const length = this.query.get('length') || 0;
        const ranges = [];
        let index = 0;
        if (counts) {
            for (let i = 0, l = counts.length; i < l; i += 1) {
                const count = counts[i] || 0;
                ranges.push({ start: index, count });
                index += count;
            }
        }
        ranges.push({
            start: index,
            count: Math.max(0, length - index),
        });
        return ranges;
    }.property('groupByCounts', 'queryLength'),

    /**
        Method (private): O.SubsetQueryProxy#_toRealIndex

        Translates an index in the proxy (collapsed) space into the equivalent
        index in the underlying query. Returns -1 if out of bounds.
    */
    _toRealIndex(proxyIndex) {
        if (proxyIndex < 0) {
            return -1;
        }
        const collapsed = this.collapsedGroups;
        const ranges = this.get('_groupRanges');
        let acc = 0;
        for (let i = 0, l = ranges.length; i < l; i += 1) {
            if (collapsed.has(i)) {
                continue;
            }
            const range = ranges[i];
            if (proxyIndex < acc + range.count) {
                return range.start + (proxyIndex - acc);
            }
            acc += range.count;
        }
        return -1;
    },

    /**
        Method (private): O.SubsetQueryProxy#_toProxyIndex

        Translates an index in the underlying query into the equivalent index in
        the proxy (collapsed) space. Returns -1 if the index falls inside a
        collapsed group (i.e. is not visible) or is out of bounds.
    */
    _toProxyIndex(realIndex) {
        if (realIndex < 0) {
            return -1;
        }
        const collapsed = this.collapsedGroups;
        const ranges = this.get('_groupRanges');
        let acc = 0;
        for (let i = 0, l = ranges.length; i < l; i += 1) {
            const range = ranges[i];
            const end = range.start + range.count;
            if (realIndex < end) {
                if (collapsed.has(i)) {
                    return -1;
                }
                return acc + (realIndex - range.start);
            }
            if (!collapsed.has(i)) {
                acc += range.count;
            }
        }
        return -1;
    },

    /**
        Method (private): O.SubsetQueryProxy#_visibleCountBefore

        Returns the number of visible (non-collapsed) items that come before the
        given index in the underlying query.
    */
    _visibleCountBefore(realIndex) {
        const collapsed = this.collapsedGroups;
        const ranges = this.get('_groupRanges');
        let acc = 0;
        for (let i = 0, l = ranges.length; i < l; i += 1) {
            const range = ranges[i];
            if (range.start >= realIndex) {
                break;
            }
            if (collapsed.has(i)) {
                continue;
            }
            const end = range.start + range.count;
            acc += Math.min(end, realIndex) - range.start;
        }
        return acc;
    },

    /**
        Method: O.SubsetQueryProxy#getVisibleGroupStarts

        Returns the index in the proxy's (collapsed) space of the first item of
        each group that has any visible items, in order. Groups that are empty
        or collapsed contribute nothing, as they have no visible items.

        Returns:
            {Number[]} The index of the first item of each visible group.
    */
    getVisibleGroupStarts() {
        const collapsed = this.collapsedGroups;
        const ranges = this.get('_groupRanges');
        const starts = [];
        let acc = 0;
        for (let i = 0, l = ranges.length; i < l; i += 1) {
            const count = ranges[i].count;
            if (!count || collapsed.has(i)) {
                continue;
            }
            starts.push(acc);
            acc += count;
        }
        return starts;
    },

    /**
        Method: O.SubsetQueryProxy#getObservedRealRanges

        Returns the parts of the underlying query that are covered by our
        range observers, in the query's index space. The union of observed
        proxy ranges is translated to real indexes and then split around
        collapsed groups, so a large collapsed group in the middle of the
        visible area doesn't get fetched.

        Returns:
            {Object[]} A list of { start, end } ranges.
    */
    getObservedRealRanges() {
        const rangeObservers = meta(this).rangeObservers;
        if (!rangeObservers || !rangeObservers.length) {
            return [];
        }
        const length = this.get('length') || 0;
        let start = Infinity;
        let end = 0;
        for (let i = rangeObservers.length - 1; i >= 0; i -= 1) {
            const range = rangeObservers[i].range;
            let observerStart = range.start || 0;
            let observerEnd = 'end' in range ? range.end : length;
            if (observerStart < 0) {
                observerStart += length;
            }
            if (observerEnd < 0) {
                observerEnd += length;
            }
            start = Math.min(start, Math.max(0, observerStart));
            end = Math.max(end, Math.min(length, observerEnd));
        }
        if (start >= end) {
            return [];
        }
        const collapsed = this.collapsedGroups;
        const ranges = this.get('_groupRanges');
        const result = [];
        let acc = 0;
        let current = null;
        for (let i = 0, l = ranges.length; i < l; i += 1) {
            const range = ranges[i];
            if (collapsed.has(i)) {
                current = null;
                continue;
            }
            // Portion of this group's proxy space [acc, acc + count) that is
            // observed, mapped back to real indexes.
            const from = Math.max(start, acc) - acc;
            const to = Math.min(end, acc + range.count) - acc;
            if (from < to) {
                const realStart = range.start + from;
                const realEnd = range.start + to;
                if (current && current.end === realStart) {
                    current.end = realEnd;
                } else {
                    result.push((current = { start: realStart, end: realEnd }));
                }
            }
            acc += range.count;
            if (acc >= end) {
                break;
            }
        }
        return result;
    },

    // --- Updates from the underlying query ---

    queryWasUpdated: function (event) {
        if (!this.collapsedGroups.size) {
            return;
        }
        // The underlying query reports added/removed indexes in its full index
        // space. Translate them into our collapsed space and drop any that fall
        // inside a collapsed group so observers (selection, list animations)
        // see indexes that match what we expose. The group geometry has already
        // been updated (groupByCounts is set before the update fires), so this
        // is a best effort for the removed indexes, which were in the old
        // space.
        const remap = (storeKeys, indexes) => {
            const newStoreKeys = [];
            const newIndexes = [];
            for (let i = 0, l = indexes.length; i < l; i += 1) {
                const proxyIndex = this._toProxyIndex(indexes[i]);
                if (proxyIndex >= 0) {
                    newStoreKeys.push(storeKeys[i]);
                    newIndexes.push(proxyIndex);
                }
            }
            return [newStoreKeys, newIndexes];
        };
        [event.added, event.addedIndexes] = remap(
            event.added,
            event.addedIndexes,
        );
        [event.removed, event.removedIndexes] = remap(
            event.removed,
            event.removedIndexes,
        );
    }.on('query:updated'),

    proxyRangeChange(query, start, end) {
        if (!this.collapsedGroups.size) {
            this.rangeDidChange(start, end);
            return;
        }
        const proxyStart = this._visibleCountBefore(start);
        this.rangeDidChange(proxyStart, this.get('length') || 0);
    },

    // --- Collapsing ---

    toggleGroup(group) {
        const collapsedGroups = this.collapsedGroups;
        const prevLength = this.get('length') || 0;
        if (collapsedGroups.has(group)) {
            collapsedGroups.delete(group);
        } else {
            collapsedGroups.add(group);
        }
        this.computedPropertyDidChange('length');
        const newLength = this.get('length') || 0;
        // Find where the toggled group starts so we only invalidate from there.
        const ranges = this.get('_groupRanges');
        let realStart = 0;
        for (let i = 0, l = ranges.length; i < l; i += 1) {
            if (i === group) {
                realStart = ranges[i].start;
                break;
            }
        }
        const proxyStart = this._visibleCountBefore(realStart);
        this.rangeDidChange(proxyStart, Math.max(prevLength, newLength));
        this.collapsedGroupsDidChange();
    },

    /**
        Method: O.SubsetQueryProxy#collapsedGroupsDidChange

        Called whenever <#collapsedGroups> is mutated via <#toggleGroup>. The
        default implementation does nothing; consumers that wish to persist the
        collapsed state can override this (e.g. by passing it as a method when
        constructing the proxy).
    */
    collapsedGroupsDidChange() {},

    // ---

    queryLength: new Binding({ queue: null }).from(null, 'query*length'),
    groupByCounts: new Binding({ queue: null }).from(
        null,
        'query*groupByCounts',
    ),

    length: function () {
        const queryLength = this.get('queryLength');
        if (queryLength === null || queryLength === undefined) {
            return null;
        }
        const collapsedGroups = this.collapsedGroups;
        if (!collapsedGroups.size) {
            return queryLength;
        }
        let hidden = 0;
        const ranges = this.get('_groupRanges');
        for (let i = 0, l = ranges.length; i < l; i += 1) {
            const range = ranges[i];
            if (collapsedGroups.has(i)) {
                hidden += range.count;
            }
        }
        return queryLength - hidden;
    }.property('queryLength', 'groupByCounts'),

    prefetch: function (value) {
        if (value !== undefined) {
            this.query.set('prefetch', value);
            return value;
        }
        return this.query.get('prefetch');
    }.property(),

    is(status) {
        return this.query.is(status);
    },

    setObsolete() {
        return this.query.setObsolete();
    },

    fetch(force, callback) {
        return this.query.fetch(force, callback);
    },

    reset() {
        return this.query.reset();
    },

    // ---

    getStoreKeys() {
        const storeKeys = this.query.getStoreKeys();
        const collapsed = this.collapsedGroups;
        if (!collapsed.size) {
            return storeKeys;
        }
        const ranges = this.get('_groupRanges');
        const result = [];
        for (let i = 0, l = ranges.length; i < l; i += 1) {
            const range = ranges[i];
            if (collapsed.has(i)) {
                continue;
            }
            const end = range.start + range.count;
            for (let j = range.start; j < end; j += 1) {
                result.push(storeKeys[j]);
            }
        }
        return result;
    },

    getObjectAt(index, doNotFetch) {
        if (!this.collapsedGroups.size) {
            return this.query.getObjectAt(index, doNotFetch);
        }
        const realIndex = this._toRealIndex(index);
        if (realIndex < 0) {
            return undefined;
        }
        return this.query.getObjectAt(realIndex, doNotFetch);
    },

    indexOfStoreKey(storeKey, from, callback) {
        if (!this.collapsedGroups.size) {
            return this.query.indexOfStoreKey(storeKey, from, callback);
        }
        // Store keys are unique within a query, so it's safe to ignore `from`
        // and search the whole (real) list, then map the result back.
        const realIndex = this.query.indexOfStoreKey(
            storeKey,
            0,
            callback ? (real) => callback(this._toProxyIndex(real)) : undefined,
        );
        return this._toProxyIndex(realIndex);
    },

    getStoreKeysForObjectsInRange(start, end, callback) {
        const length = this.get('length');
        if (!this.collapsedGroups.size || length === null) {
            return this.query.getStoreKeysForObjectsInRange(
                start,
                end,
                callback,
            );
        }
        if (start < 0) {
            start = 0;
        }
        if (end > length) {
            end = length;
        }
        if (start >= end) {
            callback([], start, start);
            return false;
        }
        const realStart = this._toRealIndex(start);
        const realEnd = this._toRealIndex(end - 1) + 1;
        const collapsed = this.collapsedGroups;
        const ranges = this.get('_groupRanges');
        const isVisible = (real) => {
            for (let i = 0, l = ranges.length; i < l; i += 1) {
                const range = ranges[i];
                if (real < range.start + range.count) {
                    return !collapsed.has(i);
                }
            }
            return false;
        };
        return this.query.getStoreKeysForObjectsInRange(
            realStart,
            realEnd,
            (storeKeys, rStart, rEnd) => {
                const visible = [];
                for (let real = rStart; real < rEnd; real += 1) {
                    if (isVisible(real)) {
                        visible.push(storeKeys[real - rStart]);
                    }
                }
                callback(visible, start, start + visible.length);
            },
        );
    },

    getStoreKeysForAllObjects(callback) {
        // 0x7fffffff is the largest positive signed 32-bit number.
        return this.getStoreKeysForObjectsInRange(0, 0x7fffffff, callback);
    },
});

// ---

export { SubsetQueryProxy };
