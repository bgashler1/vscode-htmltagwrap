import { window, Disposable, Selection, Range, TextEditor, } from 'vscode';
import { SpaceInsertedPromiseResolution } from './types';
import { getTag } from './utilities';

export async function autoDeselectClosingTag (editor: TextEditor, passedSelections: readonly Selection[]) {
    const tag = getTag();
	try {
		// Wait for selections to be made, then listen for changes.
		// Enter a mode to listen for whitespace and remove the second cursor
		let windowListener: Disposable;
		const autoDeselectClosingTagAction: Promise<SpaceInsertedPromiseResolution | string> = new Promise((resolve, reject) => {
			// Have selections changed?
			windowListener = window.onDidChangeTextEditorSelection(e => {
				if (e.textEditor !== editor || e.selections.length === 0) return;
				const sample = editor.document.getText(new Selection(e.selections[0].start.translate(undefined, -1), e.selections[0].end));
				const isSpaceInserted = sample.endsWith(' ');
				if (isSpaceInserted) resolve({
					passedSelections: passedSelections,
					spaceInsertedAt: e.selections.map(selection => new Range(selection.start.translate(undefined, -1), selection.end))
				});
				else if (e.kind === 2) {
					// Listen for anything that changes selection but keyboard input
					// or an undefined event (such as backspace clearing last selected character)
					resolve('✔ User changed selection. Event type: ' + e.kind);
				}
			});
		});
		const selectionsAfterEvent = await autoDeselectClosingTagAction;
		//Cleanup memory and processes
		windowListener.dispose();
		if (typeof selectionsAfterEvent === 'string') return;

		const edits: Array<{ start: number; end: number; replacementLength: number }> = [];
		const openingCarets: Array<{ start: number; addedLength: number }> = [];
		const spaceRanges = selectionsAfterEvent.spaceInsertedAt;
		for (let i = 0; i < spaceRanges.length; i += 2) {
			const openingSpace = spaceRanges[i];
			const precedingCharacter = editor.document.getText(new Range(openingSpace.start.translate(undefined, -1), openingSpace.start));
			const replacedName = precedingCharacter === '<';
			openingCarets.push({ start: editor.document.offsetAt(openingSpace.start), addedLength: replacedName ? tag.length + 1 : 1 });
			if (replacedName) {
				for (let j = i; j < Math.min(i + 2, spaceRanges.length); j++) {
					const range = spaceRanges[j];
					edits.push({ start: editor.document.offsetAt(range.start), end: editor.document.offsetAt(range.end), replacementLength: j === i ? tag.length + 1 : tag.length });
				}
			} else if (spaceRanges[i + 1]) {
				const range = spaceRanges[i + 1];
				edits.push({ start: editor.document.offsetAt(range.start), end: editor.document.offsetAt(range.end), replacementLength: 0 });
			}
		}
		const applied = await editor.edit((editBuilder) => {
			for (const edit of edits) {
				const range = new Range(editor.document.positionAt(edit.start), editor.document.positionAt(edit.end));
				const openingEdit = openingCarets.some(caret => caret.start === edit.start);
				const replacement = edit.replacementLength === 0 ? '' : openingEdit ? tag + ' ' : tag;
				editBuilder.replace(range, replacement);
			}
		}, {
			undoStopBefore: false,
			undoStopAfter: false
		});
		if (!applied) return;
		editor.selections = openingCarets.map(caret => {
			const shift = edits.filter(edit => edit.end <= caret.start).reduce((sum, edit) => sum + edit.replacementLength - (edit.end - edit.start), 0);
			const position = editor.document.positionAt(caret.start + shift + caret.addedLength);
			return new Selection(position, position);
		});
		console.log('✔︎ Deselected closing tags');
	}
	catch (err) {
		console.error('Edit rejected!' + err);
	}
}
