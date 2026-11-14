import { TextEditor, Position, Selection, Range, EndOfLine } from 'vscode';
import { getTabString } from './utilities';

// Insert empty tags first so VS Code's html.autoClosingTags does not add another closing tag.
const openingTags = '<>';
const closingTags = '</>';

export async function wrapInTagsAndSelect(editor: TextEditor, tag: string, attributes = '') {
    const tagsMissingElements = await wrapInEmptyTags(editor, tag, attributes);
    return selectAndAddTags(editor, tag, attributes, tagsMissingElements);
}

export async function wrapInBlockTagsAndSelect(editor: TextEditor, tag: string, attributes = ''): Promise<readonly Selection[]> {
	const document = editor.document;
	const indentation = getTabString(editor);
	const eol = document.eol === EndOfLine.CRLF ? '\r\n' : '\n';
	const plans = editor.selections.map(selection => {
		const firstLine = document.lineAt(selection.start.line);
		const leadingIndent = firstLine.text.substring(0, firstLine.firstNonWhitespaceCharacterIndex);
		let start = selection.start;
		let end = selection.end;
		if (start.character === 0 && leadingIndent && (end.line > start.line || end.character === firstLine.text.length)) {
			start = new Position(start.line, leadingIndent.length);
		}
		if (end.line > start.line && end.character === 0) {
			end = document.lineAt(end.line - 1).range.end;
		}
		const range = new Range(start, end);
		const selectedText = document.getText(range);
		const inner = selectedText.split(/\r?\n/)
			.map((line, index) => index === 0 ? leadingIndent + indentation + line : indentation + line)
			.join(eol);
		const prefix = '<' + tag + attributes + '>' + eol;
		const suffix = eol + leadingIndent + '</' + tag + '>';
		const offset = document.offsetAt(start);
		const endOffset = document.offsetAt(end);
		return {
			range, offset, endOffset,
			replacement: prefix + inner + suffix,
			openingName: offset + 1,
			closingName: offset + prefix.length + inner.length + eol.length + leadingIndent.length + 2
		};
	});
	const applied = await editor.edit(editBuilder => {
		for (const plan of plans) editBuilder.replace(plan.range, plan.replacement);
	});
	if (!applied) return editor.selections;
	const shiftBefore = (offset: number) => plans.filter(plan => plan.endOffset <= offset && plan.offset < offset)
		.reduce((shift, plan) => shift + plan.replacement.length - (plan.endOffset - plan.offset), 0);
	const selections: Selection[] = [];
	for (const plan of plans) {
		const shift = shiftBefore(plan.offset);
		const openingStart = document.positionAt(plan.openingName + shift);
		const openingEnd = document.positionAt(plan.openingName + shift + tag.length);
		const closingStart = document.positionAt(plan.closingName + shift);
		const closingEnd = document.positionAt(plan.closingName + shift + tag.length);
		selections.push(new Selection(openingStart, openingEnd), new Selection(closingStart, closingEnd));
	}
	editor.selections = selections;
	return editor.selections;
}

async function wrapInEmptyTags (editor: TextEditor, tag: string, attributes: string) {
	const tagsMissingElements: number[] = [];
    const tabSizeSpace = getTabString(editor);
	await editor.edit((editBuilder) => {
		for(const [i, selection] of editor.selections.entries()) {
			const selectionStart = selection.start;
			const selectionEnd = selection.end;
			if (selectionEnd.line !== selectionStart.line) {
				const lineIndent = editor.document.lineAt(selectionStart.line).text.substring(0, selectionStart.character);

				editBuilder.insert(new Position(selectionEnd.line, 0), tabSizeSpace);
				editBuilder.insert(new Position(selectionEnd.line, selectionEnd.character), '\n' + lineIndent + '</' + tag + '>');

				for (let lineNumber = selectionEnd.line - 1; lineNumber > selectionStart.line; lineNumber--) {
					editBuilder.insert(new Position(lineNumber, 0), tabSizeSpace);
				}

				editBuilder.insert(new Position(selectionStart.line, selectionStart.character), '<' + tag + attributes + '>\n' + lineIndent + tabSizeSpace);
			} else {
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

async function selectAndAddTags(editor: TextEditor, tag: string, attributes: string, tagsMissingElements: number[]): Promise<readonly Selection[]> {
	const indentation = getTabString(editor);
	const selectionsBeforeEdit = editor.selections;
	try {
		await editor.edit(editBuilder => {
			for (const index of tagsMissingElements) {
				const selection = selectionsBeforeEdit[index];
				let openingName = selection.start.translate(0, -1);
				const closingName = selection.end.translate(0, -1);
				if (selection.isEmpty) {
					// VS Code moves an empty selection past the inserted closing tag.
					openingName = openingName.translate(0, -3);
				}
				editBuilder.insert(openingName, tag + attributes);
				editBuilder.insert(closingName, tag);
			}
		}, { undoStopBefore: false, undoStopAfter: true });
	} catch (error) {
		console.error('Element name insertion rejected!', error);
	}

	// The edit moves VS Code's selections, so calculate tag positions from their updated positions.
	const tagSelections: Selection[] = [];
	for (const selection of editor.selections) {
		if (selection.end.line !== selection.start.line) {
			const openingLine = selection.start.line - 1;
			const closingLine = selection.end.line;
			const openingColumn = selection.start.character - indentation.length + 1;
			const closingColumn = selection.end.character - 1 - tag.length;
			tagSelections.push(new Selection(openingLine, openingColumn, openingLine, openingColumn + tag.length));
			tagSelections.push(new Selection(closingLine, closingColumn, closingLine, closingColumn + tag.length));
		} else {
			let openingColumn = selection.start.character - 1 - tag.length - attributes.length;
			const closingColumn = selection.end.character - 1 - tag.length;
			if (selection.isEmpty) openingColumn -= 3 + tag.length;
			tagSelections.push(new Selection(selection.start.line, openingColumn, selection.start.line, openingColumn + tag.length));
			tagSelections.push(new Selection(selection.end.line, closingColumn, selection.end.line, closingColumn + tag.length));
		}
	}
	editor.selections = tagSelections;
	return editor.selections;
}
