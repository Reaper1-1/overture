import { Class } from '../core/Core.js';
import { mod } from '../core/Math.js';
import { Obj } from '../foundation/Object.js';
import { ObservableArray } from '../foundation/ObservableArray.js';
import { makeSearchRegExp } from '../localisation/i18n.js';

/* { on, observes } from */
import '../foundation/Decorators.js';

const OptionsController = Class({
    Name: 'OptionsController',

    Extends: Obj,

    init: function () {
        this.isFiltering = false;
        this.focused = null;
        this.selected = null;
        OptionsController.parent.constructor.apply(this, arguments);
        this.setOptions();
    },

    // ---

    search: '',

    resetSearch() {
        this.set('search', '');
    },

    // ---

    setOptions() {
        const options = this.get('options');
        const content = this.get('content');
        const search = this.get('search');
        const isFiltering = this.get('isFiltering');
        const results = this.filterOptions(content, search, isFiltering);

        if (options instanceof ObservableArray) {
            options.set('[]', results);
        } else {
            this.set('options', results);
        }
        this.checkFocus();
    },

    optionsWillChange: function () {
        this.setOptions();
    }
        .queue('before')
        .observes('content', 'search', 'isFiltering'),

    filterOptions(content, search /*, isFiltering*/) {
        const patterns = search
            ? search.split(/\s+/).map(makeSearchRegExp)
            : null;
        return patterns
            ? content.filter((option) => {
                  const name = option.get('name');
                  return patterns.every((pattern) => {
                      return pattern.test(name);
                  });
              })
            : Array.isArray(content)
              ? content
              : content.get('[]');
    },

    // ---

    getAdjacent(step) {
        const options = this.get('options');
        const l = options.get('length');
        let i = options.indexOf(this.get('focused'));

        if (!l) {
            return undefined;
        }

        if (i < 0 && step < 0) {
            i = l;
        }
        const current = mod(i, l);

        do {
            i = mod(i + step, l);
        } while (!this.mayFocus(options.getObjectAt(i)) && i !== current);

        return options.getObjectAt(i);
    },

    focusPrevious() {
        return this.focus(this.getAdjacent(-1));
    },

    focusNext() {
        return this.focus(this.getAdjacent(1));
    },

    mayFocus(option) {
        return !option.get('isDisabled');
    },

    focus(option) {
        const current = this.get('focused');
        if (current !== option) {
            if (option && !this.mayFocus(option)) {
                option = null;
            }
            this.set('focused', option);
        }
        return this;
    },

    checkFocus: function () {
        const focused = this.get('focused');
        if (!this.get('isFiltering')) {
            this.focus(null);
        } else if (
            !focused ||
            !this.mayFocus(focused) ||
            !this.get('options').includes(focused)
        ) {
            this.focus(null).focusNext();
        }
    }.observes('isFiltering'),

    // ---

    collapseFocused() {},
    expandFocused() {},

    selectFocused() {
        const focused = this.get('focused');
        if (focused) {
            this.select(focused);
            this.resetSearch();
        }
    },

    // ---

    select() {},

    done: function () {
        this.set('isFiltering', false).fire('done');
    }.observes('selected'),
});

export { OptionsController };
