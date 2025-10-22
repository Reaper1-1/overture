import { emailAndQueryParamsPattern, urlPattern } from '../core/RegExp.js';
import { escapeHTML } from '../core/String.js';

// ---

const linkRegExp = new RegExp(
    // Only look on boundaries
    '\\b(?:' +
        // Capture group 1: URLs
        '(' +
        urlPattern +
        // Capture group 2: Emails
        ')|(' +
        emailAndQueryParamsPattern +
        '))',
    'gi',
);

const escapeHTMLPreservingWS = (string) => {
    return escapeHTML(string).replace(/ (?=(?: |$))/g, '&nbsp;');
};

const toHTML = (plainText, style) => {
    const openTag =
        '<div' +
        (style ? ' style="' + style.replace(/"/g, "'") + '"' : '') +
        '>';
    const closeTag = '</div>';
    return (
        openTag +
        plainText
            .split('\n')
            .map((line) => {
                let lineAsHTML = '';
                let doneUpToIndex = 0;
                let match;
                let index;
                let endIndex;
                while ((match = linkRegExp.exec(line))) {
                    index = match.index;
                    endIndex = index + match[0].length;
                    if (doneUpToIndex < index) {
                        lineAsHTML += escapeHTMLPreservingWS(
                            line.slice(doneUpToIndex, index),
                        );
                    }
                    lineAsHTML += '<a href="';
                    lineAsHTML += escapeHTML(
                        match[1]
                            ? /^(?:ht|f)tps?:/i.test(match[1])
                                ? match[1]
                                : 'http://' + match[1]
                            : 'mailto:' +
                                  encodeURIComponent(match[0]).replace(
                                      /%40/g,
                                      '@',
                                  ),
                    ).replace(/"/g, '&quot;');
                    lineAsHTML += '">';
                    lineAsHTML += escapeHTMLPreservingWS(
                        line.slice(index, endIndex),
                    );
                    lineAsHTML += '</a>';
                    doneUpToIndex = endIndex;
                }
                lineAsHTML += escapeHTMLPreservingWS(line.slice(doneUpToIndex));
                return lineAsHTML || '<br>';
            })
            .join(closeTag + openTag) +
        closeTag
    );
};

// ---

export { toHTML, linkRegExp };
