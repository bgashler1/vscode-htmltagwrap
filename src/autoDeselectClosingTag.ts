import { window, workspace, Disposable, Selection, Position, Range, } from 'vscode';
import { SpaceInsertedPromiseResolution } from './types';
import { getTag } from './utilities';

export async function autoDeselectClosingTag (editor) {
    const tag = getTag;
	try {
		// Wait for selections to be made, then listen for changes.
		// Enter a mode to listen for whitespace and remove the second cursor
		let workspaceListener: Disposable;
		let windowListener: Disposable;
		const autoDeselectClosingTagAction: Thenable<SpaceInsertedPromiseResolution | string> = new Promise((resolve, reject) => {
			
			// Have selections changed?
			const initialSelections = editor.selections;			
			windowListener = window.onDidChangeTextEditorSelection((event)=> {
				if (event.kind !== undefined && event.kind !== 1) {
					// Listen for anything that changes selection but keyboard input
					// or an undefined event (such as backspace clearing last selected character)
					resolve('✔ User changed selection. Event type: ' + event.kind);
				}
			});
			
			// Did user enter a space
			workspaceListener = workspace.onDidChangeTextDocument((event)=> {
				const contentChange = event.contentChanges;
				if (contentChange[0].text === ' ') {
					// If the user presses space without typing anything, we need to resolve with a parameter and make sure to add back the tag names that were overwritten with a space
					const resolution: SpaceInsertedPromiseResolution = {
						spaceInsertedAt: contentChange[1].range,
						initialSelections: initialSelections
					};
					resolve(resolution);
				}
			});
		});
		const success = await autoDeselectClosingTagAction;
			//Cleanup memory and processes
			windowListener.dispose();
			workspaceListener.dispose();
			
			const newSelections = new Array<Selection>();
			const spacePressedWithoutTypingNewTag = ():boolean => {
				if (typeof success === 'string') return false;
				const initialSelections = success.initialSelections;
				const spaceInsertedAt = success.spaceInsertedAt;

				// Selections array is in the order user made selections (arbitrary), whereas the spaceInsertedAt (content-edit array) is in logical order, so we must loop to compare.
				let returnValue: boolean;
				for (let i = 0; i < initialSelections.length; i++) {
					if (spaceInsertedAt.isEqual(initialSelections[i])) {
						returnValue = true;
						//console.log('Selection[' + i + '] equal??? ' + returnValue);
						break;
					} else {
						returnValue = false;
					}
				}
				return returnValue;
			};
			await editor.edit((editBuilder) => {
				// Update selections
				const initialSelections = editor.selections;
				const newLine = false;
				const charOffset = 0;
				const addMissingTag: boolean = spacePressedWithoutTypingNewTag();
				for (const [index, selection] of initialSelections.entries()) {
					let tagPosition: Position = selection.start;
					if (index % 2 !== 0) {
						// Remove whitespace on closing tag
						// Since closing tag selection is now length zero and after the whitespace, select a range one character backwards
						const closingTagWhitespace: Range = selection.with({start: selection.end.translate(0,-1), end: undefined});
						editBuilder.delete(closingTagWhitespace);
					} else {
						tagPosition = selection.start.translate(undefined, -1);
					}
					if (addMissingTag) {
						// If the user pressed space and overwrote the default tag with no tag, add the default tag before the space
						editBuilder.insert(tagPosition, tag);
					}
				}
			}, {
				undoStopBefore: false,
				undoStopAfter: false
			});
			// Update selections
			const initialSelections = editor.selections;
			for (const [index, selection] of initialSelections.entries()) {
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