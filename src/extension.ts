// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

function getTabString(editor: vscode.TextEditor): string {
	let spacesUsed = <boolean>editor.options.insertSpaces;
	if (spacesUsed) {
		let numOfUsedSpaces = <number>editor.options.tabSize;
		return ' '.repeat(numOfUsedSpaces);
	}

	return '\t';
}

// this method is called when your extension is activated
export function activate() {

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	vscode.commands.registerCommand('extension.htmlTagWrap', () => {
		// The code you place here will be executed every time your command is executed

		const editor = vscode.window.activeTextEditor;
		let tabSizeSpace = getTabString(editor);

		if(editor == null) {
			return;
		}

		/*
		First, surround selection with empty tags to avoid a duplicate closing tag in newer VS Code releases:
		`html.autoClosingTags` (a default setting) would normally autoclose the first tag if it has an element name inside
		*/
		let openingTags: string = '<' + '>';
		let closingTags: string = '</' + '>';
			
		let tag = vscode.workspace.getConfiguration().get<string>("htmltagwrap.tag");
		if (!tag) {
			tag = 'p'; 
		}

		
		// We temporarily leave some tags empty to work around a default setting in VS Code that autocloses tags (to avoid duplicate closing tags)
		let tagsMissingElements: Array<number> = [];

		// Start inserting tags
		editor.edit((editBuilder) => {

			const selections = editor.selections;
			
			for(const [i, selection] of selections.entries()) {

				const selectionStart = selection.start;
				const selectionEnd = selection.end;

				
				if(selectionEnd.line !== selectionStart.line) {
					// ================
					// Wrap it as a block
					// ================

					var selectionStart_spaces = editor.document.lineAt(selectionStart.line).text.substring(0, selectionStart.character);
					
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
					
					
					let beginningPosition = new vscode.Position(selectionEnd.line, selectionStart.character);
					let endingPosition = new vscode.Position(selectionEnd.line, selectionEnd.character);
					editBuilder.insert(beginningPosition, openingTags);
					editBuilder.insert(endingPosition, closingTags);
					console.log('Inline index to push = ', i);
					tagsMissingElements.push(i);
				}
			}
		}, {
			undoStopBefore: true,
			undoStopAfter: false
		}).then(() => {
			// Add tag name elements

			const selections = editor.selections;
			console.log('const SELECTIONS = ', selections);
			editor.edit((editBuilder) => {

				let tagsMissingElementsSelections: vscode.Selection[] = tagsMissingElements.map(index => {
					return selections[index];
				});
				console.log('tagsMissingElementsSelections = ', tagsMissingElementsSelections);


				tagsMissingElementsSelections.map(selection => {
					let tagFirst = selection.start.translate(0,-1);
					let tagSecond = selection.end.translate(0,-1);
					if(selection.start.character === selection.end.character) {
						// When the selection is empty
						tagFirst = tagFirst.translate(0,-3);
					}
					editBuilder.insert(tagFirst, tag);
					editBuilder.insert(tagSecond, tag);
				});
			}, {
				undoStopBefore: false,
				undoStopAfter: true
			});
		}, (err) => {
			console.log('Element name insertion rejected!');
			console.error(err);
		}).then(() => {
			console.log('Edit applied!');

			// Need to fetch selections again as they are no longer accurate (since the new tags were inserted)
			const selections = editor.selections;
			const toSelect: Array<vscode.Selection> = new Array<vscode.Selection>();

			for(let selection of selections) {
				
				// Careful : the selection starts at the beginning of the text but ends *after* the closing tag
				if(selection.end.line !== selection.start.line) {
					// ================
					// Block selection
					// ================
					let lineAbove = selection.start.line - 1;
					let lineBelow = selection.end.line;
					let startPosition = selection.start.character - tabSizeSpace.length + 1;
					let endPosition = selection.end.character - 1 - tag.length;

					toSelect.push(new vscode.Selection(lineAbove, startPosition, lineAbove, startPosition + tag.length));
					toSelect.push(new vscode.Selection(lineBelow, endPosition, lineBelow, endPosition + tag.length));
				}
				else {
					// ================
					// Inline selection
					// ================
					// same line, just get to the tag element by navigating backwards
					let startPosition = selection.start.character - 1;
					let endPosition = selection.end.character - 1 + tag.length;

					// ================
					// Empty selection
					// ================					
					// When dealing with an empty selection, both the start and end position end up being *after* the closing tag
					// backtrack to account for that
					if(selection.start.character === selection.end.character) {
						startPosition -= 3;
					}

					toSelect.push(new vscode.Selection(selection.start.line, startPosition, selection.start.line, startPosition + tag.length))
					toSelect.push(new vscode.Selection(selection.end.line, endPosition, selection.end.line, endPosition + tag.length))
				}

				editor.selections = toSelect;
			}

		}, (err) => {
			console.log('Edit rejected!');
			console.error(err);
		});
	});
}