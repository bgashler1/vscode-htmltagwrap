const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

class Position {
  constructor(line, character) { this.line = line; this.character = character; }
  translate(_line, character) { return new Position(this.line, this.character + character); }
  isEqual(other) { return this.line === other.line && this.character === other.character; }
}
class Range {
  constructor(start, end) { this.start = start; this.end = end; }
  isEqual(other) { return this.start.isEqual(other.start) && this.end.isEqual(other.end); }
}
class Selection extends Range {}

function runCase(tag, replacedSelection, mixed = false) {
  let listener;
  const vscode = {
    Position, Range, Selection,
    window: { onDidChangeTextEditorSelection(callback) {
      listener = callback;
      return { dispose() { listener = undefined; } };
    } },
    workspace: { getConfiguration() { return { get() { return tag; } }; } }
  };
  const oldLoad = Module._load;
  Module._load = function (name, ...rest) {
    return name === 'vscode' ? vscode : oldLoad.call(this, name, ...rest);
  };
  const modulePath = require.resolve('../out/src/autoDeselectClosingTag.js');
  delete require.cache[require.resolve('../out/src/utilities.js')];
  delete require.cache[modulePath];
  let autoDeselectClosingTag;
  try { ({ autoDeselectClosingTag } = require(modulePath)); }
  finally { Module._load = oldLoad; }

  const original = `<${tag}>hello</${tag}>` + (mixed ? `|<${tag}>world</${tag}>` : '');
  const nameStart = 1;
  const closingNameStart = original.indexOf('</') + 2;
  const passed = [
    new Selection(new Position(0, nameStart), new Position(0, nameStart + tag.length)),
    new Selection(new Position(0, closingNameStart), new Position(0, closingNameStart + tag.length))
  ];
  const firstContent = replacedSelection ? '< >hello</ >' : `<${tag} >hello</${tag} >`;
  const content = firstContent + (mixed ? '|<span >world</span >' : '');
  const firstSpace = replacedSelection ? 1 : tag.length + 1;
  const secondSpace = firstContent.lastIndexOf('</') + 2 + (replacedSelection ? 0 : tag.length);
  const current = [firstSpace, secondSpace].map(i => new Selection(new Position(0, i + 1), new Position(0, i + 1)));
  if (mixed) {
    const secondOpening = original.lastIndexOf(`<${tag}>`) + 1;
    const secondClosing = original.lastIndexOf(`</${tag}>`) + 2;
    passed.push(new Selection(new Position(0, secondOpening), new Position(0, secondOpening + tag.length)));
    passed.push(new Selection(new Position(0, secondClosing), new Position(0, secondClosing + tag.length)));
    const typedOpeningSpace = content.lastIndexOf('<span ') + '<span'.length;
    const typedClosingSpace = content.lastIndexOf('</span ') + '</span'.length;
    current.push(...[typedOpeningSpace, typedClosingSpace].map(i => new Selection(new Position(0, i + 1), new Position(0, i + 1))));
  }
  const document = { text: content, getText(range) {
    return range ? this.text.slice(range.start.character, range.end.character) : this.text;
  }, offsetAt(position) { return position.character; }, positionAt(offset) { return new Position(0, offset); } };
  const editor = { document, selections: current, async edit(callback) {
    const edits = [];
    callback({
      delete(range) { edits.push({ start: range.start.character, end: range.end.character, text: '' }); },
      replace(range, text) { edits.push({ start: range.start.character, end: range.end.character, text }); },
      insert(position, text) { edits.push({ start: position.character, end: position.character, text }); }
    });
    const mapCaret = (position) => {
      let shift = 0;
      for (const edit of [...edits].sort((a, b) => a.start - b.start)) {
        if (position < edit.start) break;
        if (position <= edit.end) return edit.start + shift + edit.text.length;
        shift += edit.text.length - (edit.end - edit.start);
      }
      return position + shift;
    };
    this.selections = this.selections.map(selection => new Selection(
      new Position(0, mapCaret(selection.start.character)),
      new Position(0, mapCaret(selection.end.character))
    ));
    for (const edit of edits.sort((a, b) => b.start - a.start)) {
      document.text = document.text.slice(0, edit.start) + edit.text + document.text.slice(edit.end);
    }
    return true;
  } };
  const promise = autoDeselectClosingTag(editor, passed);
  listener({ kind: 1, textEditor: editor, selections: current });
  return promise.then(() => {
    const caret = editor.selections[0].start.character;
    const withAttribute = document.text.slice(0, caret) + 'class="x"' + document.text.slice(caret);
    return { text: document.text, selections: editor.selections.length, caret, withAttribute };
  });
}

for (const tag of ['p', 'div', 'CountContext']) {
  test(`space replacing selected ${tag} restores both tags`, async () => {
    const result = await runCase(tag, true);
    assert.deepEqual(result, { text: `<${tag} >hello</${tag}>`, selections: 1, caret: tag.length + 2, withAttribute: `<${tag} class="x">hello</${tag}>` });
  });
  test(`space after typed ${tag} leaves only opening attribute space`, async () => {
    const result = await runCase(tag, false);
    assert.deepEqual(result, { text: `<${tag} >hello</${tag}>`, selections: 1, caret: tag.length + 2, withAttribute: `<${tag} class="x">hello</${tag}>` });
  });
}

test('mixed cursors restore the default tag only where its name was replaced', async () => {
  const result = await runCase('div', true, true);
  assert.deepEqual(result, {
    text: '<div >hello</div>|<span >world</span>',
    selections: 2,
    caret: 5,
    withAttribute: '<div class="x">hello</div>|<span >world</span>'
  });
});
