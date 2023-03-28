import * as vscode from 'vscode';
import announceNotableUpdate from './utilities';

function getTabString(editor: vscode.TextEditor): string {
	const spacesUsed = <boolean>editor.options.insertSpaces;
	if (spacesUsed) {
		const numOfUsedSpaces = <number>editor.options.tabSize;
		return ' '.repeat(numOfUsedSpaces);
	}

	return '\t';
}

export function activate(extensionContext?: vscode.ExtensionContext) {

	vscode.commands.registerCommand('extension.htmlTagWrap', async () => {
		// Code in this function runs each time extension is activated
		// The command's name is pre-declared in package.json

		const editor = vscode.window.activeTextEditor;
		const tabSizeSpace = getTabString(editor);

		if(editor == null) return;

		announceNotableUpdate(extensionContext);

		/*
		First, temporarily leave tags empty if they start/end on the same line to work around VS Code's default setting `html.autoClosingTags,`.
		This setting would autocloses these opening tags if they come with element names already inside them.
		*/
		const openingTags: string = '<' + '>';
		const closingTags: string = '</' + '>';
		const tagsMissingElements: Array<number> = [];
		
		let tag = vscode.workspace.getConfiguration().get<string>("htmltagwrap.tag");
		const autoDeselectClosingTag = vscode.workspace.getConfiguration().get<boolean>("htmltagwrap.autoDeselectClosingTag");

		if (!tag) {
			tag = 'p'; 
		}

		// Start inserting tags
		await editor.edit((editBuilder) => {

			const selections = editor.selections;
			
			for(const [i, selection] of selections.entries()) {

				const selectionStart = selection.start;
				const selectionEnd = selection.end;

				
				if(selectionEnd.line !== selectionStart.line) {
					// ================
					// Wrap it as a block
					// ================

					const selectionStart_spaces = editor.document.lineAt(selectionStart.line).text.substring(0, selectionStart.character);
					
					// Modify last line of selection
					editBuilder.insert(new vscode.Position(selectionEnd.line, selectionEnd.character), '\n' + selectionStart_spaces + '</' + tag + '>');
					editBuilder.insert(new vscode.Position(selectionEnd.line, 0), tabSizeSpace);


					for (let lineNumber = selectionEnd.line - 1; lineNumber > selectionStart.line; lineNumber--) {
						editBuilder.insert(new vscode.Position(lineNumber, 0), tabSizeSpace);
					}

					// Modify first line of selection
					editBuilder.insert(new vscode.Position(selectionStart.line, selectionStart.character), '<' + tag + '>\n' + selectionStart_spaces + tabSizeSpace);
				}
				else {
					// ================
					// Wrap it inline
					// ================
					
					
					const beginningPosition = new vscode.Position(selectionEnd.line, selectionStart.character);
					const endingPosition = new vscode.Position(selectionEnd.line, selectionEnd.character);
					editBuilder.insert(beginningPosition, openingTags);
					editBuilder.insert(endingPosition, closingTags);
					tagsMissingElements.push(i);
				}
			}
		}, {
			undoStopBefore: true,
			undoStopAfter: false
		});
		// Add tag name elements
		// Need to fetch selections again as they are no longer accurate
		let selections = editor.selections;
		try {
			await editor.edit((editBuilder) => {
	
				const tagsMissingElementsSelections: vscode.Selection[] = tagsMissingElements.map(index => {
					return selections[index];
				});
	
				tagsMissingElementsSelections.map(selection => {
					let tagFirst = selection.start.translate(0,-1);
					const tagSecond = selection.end.translate(0,-1);
					if(selection.start.character === selection.end.character) {
						// Empty selection
						// When dealing with an empty selection, both the start and end position end up being *after* the closing tag
						// backtrack to account for that
						tagFirst = tagFirst.translate(0,-3);
					}
					editBuilder.insert(tagFirst, tag);
					editBuilder.insert(tagSecond, tag);
				});
				throw new Error ('BLAHHH!!!');
			}, {
				undoStopBefore: false,
				undoStopAfter: true
			});
			console.log('Edit applied!');
		}
		catch (err) {
			console.error('Element name insertion rejected! ', err);
		}
			
		// Need latest prior selections again or we'll update them incorrectly
		selections = editor.selections;
		const toSelect: Array<vscode.Selection> = new Array<vscode.Selection>();

		await new Promise(resolve => {
			// Need to fetch selections again as they are no longer accurate
			for(const selection of selections) {
				
				// Careful : the selection starts at the beginning of the text but ends *after* the closing tag
				if(selection.end.line !== selection.start.line) {
					// ================
					// Block selection
					// ================
					const lineAbove = selection.start.line - 1;
					const lineBelow = selection.end.line;
					const startPosition = selection.start.character - tabSizeSpace.length + 1;
					const endPosition = selection.end.character - 1 - tag.length;

					toSelect.push(new vscode.Selection(lineAbove, startPosition, lineAbove, startPosition + tag.length));
					toSelect.push(new vscode.Selection(lineBelow, endPosition, lineBelow, endPosition + tag.length));
				}
				else {
					// ================
					// Inline selection
					// ================
					// same line, just get to the tag element by navigating backwards
					let startPosition = selection.start.character - 1 - tag.length;
					const endPosition = selection.end.character - 1 - tag.length;

					if(selection.start.character === selection.end.character) {
						// Empty selection
						startPosition = startPosition - 3 - tag.length;
					}

					toSelect.push(new vscode.Selection(selection.start.line, startPosition, selection.start.line, startPosition + tag.length));
					toSelect.push(new vscode.Selection(selection.end.line, endPosition, selection.end.line, endPosition + tag.length));
				}
				resolve(null);
				
			}
		});
		const selectionsPromiseFulfilled = await new Promise(resolve => {
			editor.selections = toSelect;
			vscode.window.onDidChangeTextEditorSelection((event)=> {
				resolve('✔ Selections updated');
			});
		});
		console.log(selectionsPromiseFulfilled);
		try {
			interface SpaceInsertedPromiseResolution {
				spaceInsertedAt: vscode.Range;
				initialSelections: readonly vscode.Selection[];
			}
			
			if (!autoDeselectClosingTag) {
				return;
			}
			// Wait for selections to be made, then listen for changes.
			// Enter a mode to listen for whitespace and remove the second cursor
			let workspaceListener: vscode.Disposable;
			let windowListener: vscode.Disposable;
			const autoDeselectClosingTagAction: Thenable<SpaceInsertedPromiseResolution | string> = new Promise((resolve, reject) => {
				
				// Have selections changed?
				const initialSelections = editor.selections;			
				windowListener = vscode.window.onDidChangeTextEditorSelection((event)=> {
					if (event.kind !== undefined && event.kind !== 1) {
						// Listen for anything that changes selection but keyboard input
						// or an undefined event (such as backspace clearing last selected character)
						resolve('✔ User changed selection. Event type: ' + event.kind);
					}
				});
				
				// Did user enter a space
				workspaceListener = vscode.workspace.onDidChangeTextDocument((event)=> {
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
				console.warn('typeof success = ');
				
				const newSelections = new Array<vscode.Selection>();
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
						let tagPosition: vscode.Position = selection.start;
						if (index % 2 !== 0) {
							// Remove whitespace on closing tag
							// Since closing tag selection is now length zero and after the whitespace, select a range one character backwards
							const closingTagWhitespace: vscode.Range = selection.with({start: selection.end.translate(0,-1), end: undefined});
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
	});
}