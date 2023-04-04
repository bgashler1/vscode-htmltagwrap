import { window, workspace, TextEditor, Position, Selection } from 'vscode';
import { getTabString } from './utilities';

/*
First, temporarily leave tags empty if they start/end on the same line to work around VS Code's default setting `html.autoClosingTags,`.
This setting would autocloses these opening tags if they come with element names already inside them.
*/
const openingTags: string = '<' + '>';
const closingTags: string = '</' + '>';

export async function wrapInTagsAndSelect(editor:TextEditor, tag: string) {
    
    const tagsMissingElements = await wrapInEmptyTags(editor, tag);
    await selectAndAddTags(editor, tag, tagsMissingElements);
}

async function wrapInEmptyTags (editor: TextEditor, tag) {
	const tagsMissingElements: Array<number> = [];
    // Start inserting tags
    const tabSizeSpace = getTabString(editor);
	await editor.edit((editBuilder) => {

		const selections = editor.selections;
		
		for(const [i, selection] of selections.entries()) {

			const selectionStart = selection.start;
			const selectionEnd = selection.end;

			
			if(selectionEnd.line !== selection.start.line) {
				// ================
				// Block wrap
				// ================

				const selectionStart_spaces = editor.document.lineAt(selectionStart.line).text.substring(0, selectionStart.character);
				
				// Modify last line of selection
				editBuilder.insert(new Position(selectionEnd.line, selectionEnd.character), '\n' + selectionStart_spaces + '</' + tag + '>');
				editBuilder.insert(new Position(selectionEnd.line, 0), tabSizeSpace);


				for (let lineNumber = selectionEnd.line - 1; lineNumber > selectionStart.line; lineNumber--) {
					editBuilder.insert(new Position(lineNumber, 0), tabSizeSpace);
				}

				// Modify first line of selection
				editBuilder.insert(new Position(selectionStart.line, selectionStart.character), '<' + tag + '>\n' + selectionStart_spaces + tabSizeSpace);
			}
			else {
				// ================
				// Inline wrap
				// ================
				
				const beginningPosition = new Position(selectionEnd.line, selectionStart.character);
				const endingPosition = new Position(selectionEnd.line, selectionEnd.character);
				editBuilder.insert(beginningPosition, openingTags);
				editBuilder.insert(endingPosition, closingTags);
				tagsMissingElements.push(i);
			}
		}
	}, {
		undoStopBefore: true,
		undoStopAfter: false
	});
    return tagsMissingElements;
}

async function selectAndAddTags (editor, tag, tagsMissingElements) {
    const tabSizeSpace = getTabString(editor);
    // Add tag name elements
    // Need to fetch selections again as they are no longer accurate
    let selections = editor.selections;
    try {
        await editor.edit((editBuilder) => {

            const tagsMissingElementsSelections: Selection[] = tagsMissingElements.map(index => {
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
    const toSelect: Array<Selection> = new Array<Selection>();

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

                toSelect.push(new Selection(lineAbove, startPosition, lineAbove, startPosition + tag.length));
                toSelect.push(new Selection(lineBelow, endPosition, lineBelow, endPosition + tag.length));
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

                toSelect.push(new Selection(selection.start.line, startPosition, selection.start.line, startPosition + tag.length));
                toSelect.push(new Selection(selection.end.line, endPosition, selection.end.line, endPosition + tag.length));
            }
            resolve(null);
            
        }
    });
    await new Promise(resolve => {
        editor.selections = toSelect;
        const watcher = window.onDidChangeTextEditorSelection((event)=> {
            resolve('✔ Selections updated');
            watcher.dispose();
        });
    });
}