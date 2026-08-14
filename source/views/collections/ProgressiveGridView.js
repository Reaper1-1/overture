import { Class } from '../../core/Core.js';
import { ListView } from './ListView.js';
import { ProgressiveListView } from './ProgressiveListView.js';

/* { property, observes } from */
import '../../foundation/Decorators.js';

/**
    Class: O.ProgressiveGridView

    Extends: O.ProgressiveListView

    A progressively rendered list laid out as a row-major grid: item views are
    positioned in <#columns> columns of <#itemWidth>-wide cells, wrapping every
    <#columns> items on to a new <O.ListView#itemHeight>-tall row. The number
    of columns is derived from the rendered width of the view, so give the grid
    a full-width layout inside its scroll view, and use an ItemView extending
    <O.GridItemView>, which positions itself on both axes.
*/
const ProgressiveGridView = Class({
    Name: 'ProgressiveGridView',

    Extends: ProgressiveListView,

    /**
        Property: O.ProgressiveGridView#itemWidth
        Type: Number
        Default: 0

        The nominal width of a cell in pixels. As with
        <O.ListView#itemHeight>, this is used for the layout maths only; the
        rendered size of a cell comes from CSS.
    */
    itemWidth: 0,

    init: function (/* ...mixins */) {
        this._pxWidth = 0;
        ProgressiveGridView.parent.constructor.apply(this, arguments);
    },

    /**
        Property: O.ProgressiveGridView#columns
        Type: Number

        The number of columns in the grid, derived from the rendered width of
        the view and <#itemWidth>. May be overridden with a fixed number.
    */
    columns: function () {
        const itemWidth = this.get('itemWidth');
        return itemWidth
            ? Math.max(1, Math.floor(this.get('pxWidth') / itemWidth))
            : 1;
    }.property('pxLayout', 'itemWidth'),

    /**
        Property: O.ProgressiveGridView#columnWidth
        Type: Number

        The distance in pixels between the origins of adjacent columns. The
        columns are spread across the full width of the view, so this is
        <#itemWidth> or a little more.
    */
    columnWidth: function () {
        const pxWidth = this.get('pxWidth');
        return pxWidth ? pxWidth / this.get('columns') : this.get('itemWidth');
    }.property('pxLayout', 'columns'),

    /**
        Method: O.ProgressiveGridView#gridLayoutDidChange

        Calls <O.ListView#itemLayoutDidChange> when the rendered width
        changes, as that moves the cells by changing the pitch and/or the
        column count. <O.View#pxLayout> is invalidated by
        <O.View#didResize> and on entering the document, so this also fires
        when the view first gets real dimensions.
    */
    gridLayoutDidChange: function () {
        const pxWidth = this.get('pxWidth');
        if (pxWidth !== this._pxWidth) {
            this._pxWidth = pxWidth;
            this.itemLayoutDidChange();
        }
    }.observes('pxLayout', 'itemWidth'),

    /**
        Property: O.ProgressiveGridView#numItemsPastVisible
        Type: Number

        Overrides default in <O.ProgressiveListView#numItemsPastVisible> to
        extend the render range by whole rows rather than single items.
    */
    numItemsPastVisible: function () {
        const itemHeight = this.get('itemHeight');
        return itemHeight
            ? Math.ceil(200 / itemHeight) * this.get('columns')
            : 0;
    }.property('itemHeight', 'columns'),

    /**
        Property: O.ProgressiveGridView#batchSize
        Type: Number

        Overrides default in <O.ProgressiveListView#batchSize> to keep the
        boundaries of the render range on row edges.
    */
    batchSize: function () {
        return 2 * this.get('columns');
    }.property('columns'),

    /**
        Method: O.ProgressiveGridView#offsetToIndex

        Overrides default in <O.ListView#offsetToIndex>.

        Parameters:
            yOffsetInPx - {Number} The offset from the top of the grid.
            xOffsetInPx - {Number} (optional) The offset from the left of the
                          grid. Several callers pass a vertical offset only,
                          in which case the first column is assumed.

        Returns:
            {Number} The index of the item in that cell.
    */
    offsetToIndex(yOffsetInPx, xOffsetInPx) {
        const columns = this.get('columns');
        const row = Math.max(
            0,
            Math.floor(yOffsetInPx / this.get('itemHeight')),
        );
        const col = xOffsetInPx
            ? Math.min(
                  columns - 1,
                  Math.max(
                      0,
                      Math.floor(xOffsetInPx / this.get('columnWidth')),
                  ),
              )
            : 0;
        return row * columns + col;
    },

    /**
        Method: O.ProgressiveGridView#indexToOffset

        Overrides default in <O.ListView#indexToOffset>. Returns the vertical
        offset only, as all existing callers expect; the other axis comes from
        <#indexToLeftOffset>.

        Parameters:
            index - {Number} The index of the item.

        Returns:
            {Number} The offset in pixels from the top of the grid of the row
            containing the item.
    */
    indexToOffset(index /* , itemView */) {
        return Math.floor(index / this.get('columns')) * this.get('itemHeight');
    },

    /**
        Method: O.ProgressiveGridView#indexToLeftOffset

        The extra axis a grid has over a list; used by
        <O.GridItemView#layout>.

        Parameters:
            index - {Number} The index of the item.

        Returns:
            {Number} The offset in pixels from the left of the grid of the
            column containing the item.
    */
    indexToLeftOffset(index) {
        return (index % this.get('columns')) * this.get('columnWidth');
    },

    /**
        Method: O.ProgressiveGridView#contentWasUpdated

        Overrides default in <O.ProgressiveListView#contentWasUpdated>, whose
        scroll compensation assumes one item per row. In a grid an insertion
        also shifts items along a row, so no scroll adjustment can keep the
        content visually still; skip straight to
        <O.ListView#contentWasUpdated> for the bookkeeping.

        Parameters:
            event - {Object} The query:updated event.
    */
    contentWasUpdated(event) {
        return ListView.prototype.contentWasUpdated.call(this, event);
    },
});

export { ProgressiveGridView };
