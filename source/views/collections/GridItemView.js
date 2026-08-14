import { Class } from '../../core/Core.js';
import { ListItemView } from './ListItemView.js';

/* { property } from */
import '../../foundation/Decorators.js';

/**
    Class: O.GridItemView

    Extends: O.ListItemView

    An item view for use inside an <O.ProgressiveGridView>: positions itself
    with both a top and a left offset from the grid's geometry. As with
    <O.ListItemView>, the width and height of the cell come from CSS.
*/
const GridItemView = Class({
    Name: 'GridItemView',

    Extends: ListItemView,

    /**
        Property: O.GridItemView#layout
        Type: Object

        Overrides default in <O.ListItemView#layout> to position the cell
        horizontally as well, using
        <O.ProgressiveGridView#indexToLeftOffset>.
    */
    layout: function () {
        const gridView = this.get('parentView');
        const index = this.get('index');
        let top = gridView.indexToOffset(index, this);
        const left = gridView.indexToLeftOffset(index);
        const animateIn = this.get('animateIn');
        const isNew = animateIn && !this.get('isInDocument');
        if (isNew) {
            top -= gridView.get('itemHeight');
        }

        return {
            top,
            left,
            opacity: animateIn ? (isNew ? 0 : 1) : undefined,
        };
    }.property(),
});

export { GridItemView };
