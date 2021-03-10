// Note: This file contains an excerpt of the Markdeep source code. Accordingly,
// the LICENSE of the repository doesn't apply to this file. Its licensing
// information follows below (althought the highlight.js bits aren't relevant).

/**

  Markdeep.js
  Version 1.13

  Copyright 2015-2020, Morgan McGuire, https://casual-effects.com
  All rights reserved.

  -------------------------------------------------------------

  See https://casual-effects.com/markdeep for documentation on how to
  use this script make your plain text documents render beautifully
  in web browsers.

  Markdeep was created by Morgan McGuire. It extends the work of:

   - John Gruber's original Markdown
   - Ben Hollis' Maruku Markdown dialect
   - Michel Fortin's Markdown Extras dialect
   - Ivan Sagalaev's highlight.js
   - Contributors to the above open source projects

  -------------------------------------------------------------

  You may use, extend, and redistribute this code under the terms of
  the BSD license at https://opensource.org/licenses/BSD-2-Clause.

  Contains highlight.js (https://github.com/isagalaev/highlight.js) by Ivan
  Sagalaev, which is used for code highlighting. (BSD 3-clause license)

  There is an invisible Byte-Order-Marker at the start of this file to
  ensure that it is processed as UTF-8. Do not remove this character or it
  will break the regular expressions in highlight.js.
*/
/**See https://casual-effects.com/markdeep for @license and documentation.
markdeep.min.js 1.13 (C) 2020 Morgan McGuire
highlight.min.js 10.5.0 (C) 2020 Ivan Sagalaev https://highlightjs.org */

/** A box of these denotes a diagram */
var DIAGRAM_MARKER = '*';

// http://stackoverflow.com/questions/1877475/repeat-character-n-times
// ECMAScript 6 has a String.repeat method, but that's not available everywhere
var DIAGRAM_START = Array(5 + 1).join(DIAGRAM_MARKER);

var max = Math.max;

/** Extracts one diagram from a Markdown string.

    Returns {beforeString, diagramString, alignmentHint, afterString}
    diagramString will be empty if nothing was found. The
    DIAGRAM_MARKER is stripped from the diagramString.

    alignmentHint may be:
    floatleft
    floatright
    center
    flushleft

    diagramString does not include the marker characters.
    If there is a caption, it will appear in the afterString and not be parsed.
*/
function extractDiagram(sourceString) {
    // Returns the number of wide Unicode symbols (outside the BMP) in string s between indices
    // start and end - 1
    function unicodeSyms(s, start, end) {
        var p = start;
        for (var i = start; i < end; ++i, ++p) {
            var c = s.charCodeAt(p);
            p += (c >= 0xD800) && (c <= 0xDBFF);
        }
        return p - end;
    }

    function advance() {
        nextLineBeginning = sourceString.indexOf('\n', lineBeginning) + 1;
        wideCharacters = unicodeSyms(sourceString, lineBeginning + xMin, lineBeginning + xMax);
        textOnLeft  = textOnLeft  || /\S/.test(sourceString.ss(lineBeginning, lineBeginning + xMin));
        noRightBorder = noRightBorder || (sourceString[lineBeginning + xMax + wideCharacters] !== '*');

        // Text on the right ... if the line is not all '*'
        textOnRight = ! noRightBorder && (textOnRight || /[^ *\t\n\r]/.test(sourceString.ss(lineBeginning + xMax + wideCharacters + 1, nextLineBeginning)));
    }

    var noDiagramResult = {beforeString: sourceString, diagramString: '', alignmentHint: '', afterString: ''};

    // Search sourceString for the first rectangle of enclosed
    // DIAGRAM_MARKER characters at least DIAGRAM_START.length wide
    for (var i = sourceString.indexOf(DIAGRAM_START);
         i >= 0;
         i = sourceString.indexOf(DIAGRAM_START, i + DIAGRAM_START.length)) {

        // We found what looks like a diagram start. See if it has either a full border of
        // aligned '*' characters, or top-left-bottom borders and nothing but white space on
        // the left.

        // Look backwards to find the beginning of the line (or of the string)
        // and measure the start character relative to it
        var lineBeginning = max(0, sourceString.lastIndexOf('\n', i)) + 1;
        var xMin = i - lineBeginning;

        // Find the first non-diagram character on this line...or the end of the entire source string
        var j;
        for (j = i + DIAGRAM_START.length; sourceString[j] === DIAGRAM_MARKER; ++j) {}
        var xMax = j - lineBeginning - 1;

        // We have a potential hit. Start accumulating a result. If there was anything
        // between the newline and the diagram, move it to the after string for proper alignment.
        var result = {
            beforeString: sourceString.ss(0, lineBeginning),
            diagramString: '',
            alignmentHint: 'center',
            afterString: sourceString.ss(lineBeginning, i).rp(/[ \t]+$/, ' ')
        };

        var nextLineBeginning = 0, wideCharacters = 0;
        var textOnLeft = false, textOnRight = false;
        var noRightBorder = false;

        advance();

        // Now, see if the pattern repeats on subsequent lines
        for (var good = true, previousEnding = j; good; ) {
            // Find the next line
            lineBeginning = nextLineBeginning;
            advance();
            if (lineBeginning === 0) {
                // Hit the end of the string before the end of the pattern
                return noDiagramResult;
            }

            if (textOnLeft) {
                // Even if there is text on *both* sides
                result.alignmentHint = 'floatright';
            } else if (textOnRight) {
                result.alignmentHint = 'floatleft';
            }

            // See if there are markers at the correct locations on the next line
            if ((sourceString[lineBeginning + xMin] === DIAGRAM_MARKER) &&
                (! textOnLeft || (sourceString[lineBeginning + xMax + wideCharacters] === DIAGRAM_MARKER))) {

                // See if there's a complete line of DIAGRAM_MARKER, which would end the diagram
                var x;
                for (x = xMin; (x < xMax) && (sourceString[lineBeginning + x] === DIAGRAM_MARKER); ++x) {}

                var begin = lineBeginning + xMin;
                var end   = lineBeginning + xMax + wideCharacters;

                if (! textOnLeft) {
                    // This may be an incomplete line
                    var newlineLocation = sourceString.indexOf('\n', begin);
                    if (newlineLocation !== -1) {
                        end = Math.min(end, newlineLocation);
                    }
                }

                // Trim any excess whitespace caused by our truncation because Markdown will
                // interpret that as fixed-formatted lines
                result.afterString += sourceString.ss(previousEnding, begin).rp(/^[ \t]*[ \t]/, ' ').rp(/[ \t][ \t]*$/, ' ');
                if (x === xMax) {
                    // We found the last row. Put everything else into
                    // the afterString and return the result.

                    result.afterString += sourceString.ss(lineBeginning + xMax + 1);
                    return result;
                } else {
                    // A line of a diagram. Extract everything before
                    // the diagram line started into the string of
                    // content to be placed after the diagram in the
                    // final HTML
                    result.diagramString += sourceString.ss(begin + 1, end) + '\n';
                    previousEnding = end + 1;
                }
            } else {
                // Found an incorrectly delimited line. Abort
                // processing of this potential diagram, which is now
                // known to NOT be a diagram after all.
                good = false;
            }
        } // Iterate over verticals in the potential box
    } // Search for the start

    return noDiagramResult;
}
