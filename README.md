# vscode-htmltagwrap
[![Build Status](https://travis-ci.org/Microsoft/vscode-htmltagwrap.svg?branch=master)](https://travis-ci.org/Microsoft/vscode-htmltagwrap)

## What is it
Wraps your selection in HTML tags.  Can wrap inline selections and selections that span multiple lines (works with both single selections and multiple selections at once).

To use, select one or many chunks of code and press **"Alt + W" ("Option + W" for Mac).**

![Wrap text in your images](images/screenshot.gif)

[Download it on the Visual Studio Marketplace](https://marketplace.visualstudio.com/items/bradgashler.htmltagwrap)

## How to Use It
Select a block of text or a string of text.  Press <kbd>Alt</kbd> + <kbd>W</kbd> or <kbd>Option</kbd> + <kbd>W</kbd> for Mac.  Type the tag name you want, and it will populate the beginning and end tag automatically.

This extension works best in files that either use tabs or spaces for indentation.  It may not work as well with mixed tabs/spaces.

## Settings

add htmltagwrap.tag to your settings.json file( <kbd>File</kbd>--><kbd>Preferences</kbd>--><kbd>Settings</kbd> )

setting.json 
 ```
 {
    "htmltagwrap.tag": "p"
 }
 ```

## Report Issues
I welcome pull requests.  Please report an issue on GitHub if you have trouble.

## Recent Updates
### 0.0.6
* Support for multiple selections

# 0.0.5
You can now configure the default **type of HTML tag** that is inserted (see README).

Bug fix:
Extension now also works if you have an empty selection.
`"html.autoClosingTags": true` will no longer result in duplicate closing tags being inserted.

### 0.0.3
* Spaces and tabs for indentation are now both supported.

## Future features being explored
- #5 Once a user hits spacebar, then the second multi-cursor is lost so the user can write attributes like classes or styles. (Idea courtesy of Ruben Rios)

