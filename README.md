# vscode-htmltagwrap
[![Build Status](https://travis-ci.org/bgashler1/vscode-htmltagwrap.svg?branch=master)](https://travis-ci.org/bgashler1/vscode-htmltagwrap)

## What is it
Wraps your selection in HTML tags.  Can wrap inline selections and selections that span multiple lines (works with both single selections and multiple selections at once).

To use, select one or many chunks of code and press **"Alt + W" ("Option + W" for Mac).**

![Demo of a user wrapping an inline selection in span tags, followed by the user wrapping a block of text in div tags and lastly wrapping 2 different lines at once in paragraph tags](images/screenshot.gif)

[Download it on the Visual Studio Marketplace](https://marketplace.visualstudio.com/items/bradgashler.htmltagwrap)

## How to Use It
* Select one or more blocks of text or strings of text.
* Press <kbd>Alt</kbd> + <kbd>W</kbd> or <kbd>Option</kbd> + <kbd>W</kbd> for Mac.
* Type the tag name you want.

By default, pressing spacebar will deselect the closing tags, so you can add attributes to the opening tags (you can turn this feature off, see below). If nothing is selected when you run htmltagwrap, it will add an opening and closing tag at the cursor position.

NOTE: This extension works best in files that either use tabs or spaces for indentation.  It may not work as well with mixed tabs/spaces.

## Settings
You can change the default behavior of htmltagwrap with the following settings.

To open VS Code settings, click the "gear" icon ![Settings gear icon](images/settingsIcon.png) > then "Settings"

### Available settings
* `htmltagwrap.tag` -  The default HTML tag to insert.
* `htmltagwrap.autoDeselectClosingTag` -  Automatically deselect the closing tag after inserting a space.

### Defaults
 ```
 {
    "htmltagwrap.tag": "p",
    "htmltagwrap.autoDeselectClosingTag": true
 }
 ```

## Known Issues
When using the default setting `"htmltagwrap.autoDeselectClosingTag": true`:
* If you undo and then redo wrapping, entering a space will not remove the selection on the closing tag as it normally would.
* After wrapping, if you press space (removes the closing tag cursor) and then backspace to the tag element name, you won't get your closing tag cursor back.

I haven't found good solutions to these issues using the current extension API.

## Contributing
Please create an issue on GitHub if you experience a bug.
I also welcome pull requests.

## Recent Updates
### 0.0.7
* After wrapping, you can add attributes to just the opening tags.
* Upon `spacebar` press, cursors in the closing tags go away.

(see previous updates in the changelog)