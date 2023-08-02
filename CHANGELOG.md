# Changelog
## **[1.0.0]** - 2023-8-1
Fixed the `command 'extension.htmlTagWrap' not found` error for people using VS Code versions that were released before January 2023. Backwards compatibility restored for VS Code versions 1.7.5+ (Oct 2016 and later).

## **[0.0.9]** - 2023-4-8
Bugfix: no more garbled closing tags when you start typing tag attributes after pressing spacebar (with `htmltagwrap.autoDeselectClosingTag` set to true, the default setting).

## **[0.0.8]** - 2023-4-6
Several bug fixes, such as being able to correctly wrap an empty selection.

## **[0.0.7]** - 2017-12-16
* After wrapping, you can add attributes to just the opening tags.
* Upon `spacebar` press, cursors in the closing tags go away.

## **[0.0.6]** - 2017-11-25
Supports **multiple selections.**

*(Thanks hmigneron)*

## **[0.0.5]** - 2017-10-25
You can now configure the default **type of HTML tag** that is inserted (see README).

Bug fix:
Extension now also works if you have an empty selection.
`"htmltagwrap.autoDeselectClosingTag": true` will no longer result in duplicate closing tags being inserted.

*(Thanks Spoofardio)*

## **[0.0.3]** - 2016-08-18
Spaces and tabs for indentation are now both supported.