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
				if (e.kind === undefined || e.kind === 1) {
					// Check if user added a space
					const sample = editor.document.getText(new Selection(e.selections[0].start.translate(undefined, -1), e.selections[0].end));
					const isSpaceInserted = sample.includes(' ', sample.length - 1);
					if (isSpaceInserted === true) resolve({
						passedSelections: passedSelections,
						spaceInsertedAt: e.selections.map(selection => new Range(selection.start.translate(undefined, -1), selection.end))
					});
				} else {
					// Listen for anything that changes selection but keyboard input
					// or an undefined event (such as backspace clearing last selected character)
					resolve('✔ User changed selection. Event type: ' + e.kind);
				}
			});
		});
		const selectionsAfterEvent = await autoDeselectClosingTagAction;
		//Cleanup memory and processes
		windowListener.dispose();
		
		await editor.edit(async (editBuilder) => {
			if (typeof selectionsAfterEvent === 'string') return false;
			// Update selections
			for (let i = 0; i < selectionsAfterEvent.spaceInsertedAt.length; i ++) {
				if (i % 2 !== 0) {
					// Remove whitespace on closing tag
					editBuilder.delete(selectionsAfterEvent.spaceInsertedAt[i]);
				}
				const sampleSelection = selectionsAfterEvent.passedSelections[0];
				const wasSpacebarPressedWithoutChangingTag = selectionsAfterEvent.spaceInsertedAt[0].isEqual(sampleSelection);
				if (wasSpacebarPressedWithoutChangingTag === true) {
					// Restore the tag that was overwritten by pressing spacebar while the tags were selected
					editBuilder.insert(selectionsAfterEvent.passedSelections[i].start, tag);
				}
			}
		}, {
			undoStopBefore: false,
			undoStopAfter: false
		});
		// Update selections
		const newSelections: Selection[] = [];
		for (const [index, selection] of editor.selections.entries()) {
			if (index % 2 === 0) {
				newSelections.push(selection);
			}
		}
		editor.selections = newSelections;
		console.log('✔︎ Deselected closing tags');
	}
	catch (err) {
		console.error('Edit rejected!' + err);
	}
}