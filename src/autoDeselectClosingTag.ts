import { window, workspace, Disposable, Selection, Range, TextEditor, Position } from 'vscode';
import { SpaceInsertedPromiseResolution } from './types';
import { getTagDefinition } from './utilities';

const pendingCancellation = new WeakMap<TextEditor, () => void>();

export function cancelAutoDeselectClosingTag(editor: TextEditor): void {
	pendingCancellation.get(editor)?.();
}

function lastClosingTagStart(prefix: string): number {
	let quote = '';
	let closingStart = -1;
	for (let i = 0; i < prefix.length - 1; i++) {
		const character = prefix[i];
		if (quote) {
			if (character === quote) quote = '';
		} else if (character === '"' || character === "'") {
			quote = character;
		} else if (character === '<' && prefix[i + 1] === '/') {
			closingStart = i;
		}
	}
	return closingStart;
}

export async function autoDeselectClosingTag (editor: TextEditor, passedSelections: readonly Selection[]) {
    const tag = getTagDefinition().name;
	try {
		let windowListener: Disposable;
		let lastDocumentVersion = editor.document.version;
		let lastContentChanges: string[] = [];
		let cancelWaiting: () => void = () => undefined;
		// Selection events also fire on cursor moves; inspect document changes to detect inserted spaces.
		const documentListener = workspace.onDidChangeTextDocument(event => {
			if (event.document === editor.document) lastContentChanges = event.contentChanges.map(change => change.text);
		});
		const autoDeselectClosingTagAction: Promise<SpaceInsertedPromiseResolution | { kind: 'pasted-attributes'; ranges: Range[]; openingCarets: Position[] } | string> = new Promise(resolve => {
			cancelWaiting = () => resolve('Cancelled by another wrap command');
			windowListener = window.onDidChangeTextEditorSelection(e => {
				if (e.textEditor !== editor || e.selections.length === 0) return;
				const documentChanged = editor.document.version !== lastDocumentVersion;
				lastDocumentVersion = editor.document.version;
				const sample = editor.document.getText(new Selection(e.selections[0].start.translate(undefined, -1), e.selections[0].end));
				const isSpaceInserted = sample.endsWith(' ') || editor.document.getText(e.selections[0]) === ' ';
				const typedSingleSpace = lastContentChanges.length > 0 && lastContentChanges.every(text => text === ' ');
				if (documentChanged && typedSingleSpace && isSpaceInserted) resolve({
					spaceInsertedAt: e.selections.map(selection => editor.document.getText(selection) === ' '
						? new Range(selection.start, selection.end)
						: new Range(selection.start.translate(undefined, -1), selection.end))
				});
				else if (documentChanged && e.selections.length % 2 === 0) {
					const ranges: Range[] = [];
					for (let i = 1; i < e.selections.length; i += 2) {
						const caret = e.selections[i].start;
						const prefix = editor.document.lineAt(caret.line).text.substring(0, caret.character);
						const closingStart = lastClosingTagStart(prefix);
						const closingContents = prefix.substring(closingStart + 2);
						const attributesStart = closingContents.search(/\s/);
						if (closingStart >= 0 && attributesStart > 0) {
							ranges.push(new Range(new Position(caret.line, closingStart + 2 + attributesStart), caret));
						}
					}
					if (ranges.length > 0) resolve({ kind: 'pasted-attributes', ranges, openingCarets: e.selections.filter((_selection, index) => index % 2 === 0).map(selection => selection.start) });
				}
				else if (e.kind === 2 || e.selections.length !== passedSelections.length) {
					resolve('✔ User changed selection. Event type: ' + e.kind);
				}
			});
		});
		pendingCancellation.set(editor, cancelWaiting);
		const selectionsAfterEvent = await autoDeselectClosingTagAction;
		if (pendingCancellation.get(editor) === cancelWaiting) pendingCancellation.delete(editor);
		windowListener.dispose();
		documentListener.dispose();
		if (typeof selectionsAfterEvent === 'string') return;
		if ('kind' in selectionsAfterEvent) {
			const ranges = selectionsAfterEvent.ranges;
			const caretOffsets = selectionsAfterEvent.openingCarets.map(caret => editor.document.offsetAt(caret));
			const deletions = ranges.map(range => ({ start: editor.document.offsetAt(range.start), end: editor.document.offsetAt(range.end) }));
			const applied = await editor.edit(editBuilder => ranges.forEach(range => editBuilder.delete(range)), { undoStopBefore: false, undoStopAfter: false });
			if (!applied) return;
			editor.selections = caretOffsets.map(offset => {
				const shift = deletions.filter(deletion => deletion.end <= offset).reduce((sum, deletion) => sum - (deletion.end - deletion.start), 0);
				const position = editor.document.positionAt(offset + shift);
				return new Selection(position, position);
			});
			return;
		}

		const edits: Array<{ start: number; end: number; replacement: string }> = [];
		const openingCarets: Array<{ start: number; addedLength: number }> = [];
		const spaceRanges = selectionsAfterEvent.spaceInsertedAt;
		for (let i = 0; i < spaceRanges.length; i += 2) {
			const openingSpace = spaceRanges[i];
			const precedingCharacter = editor.document.getText(new Range(openingSpace.start.translate(undefined, -1), openingSpace.start));
			const followingCharacter = editor.document.getText(new Range(openingSpace.end, openingSpace.end.translate(undefined, 1)));
			const replacedName = precedingCharacter === '<';
			openingCarets.push({ start: editor.document.offsetAt(openingSpace.start), addedLength: replacedName ? tag.length + 1 : 1 });
			if (replacedName) {
				for (let j = i; j < Math.min(i + 2, spaceRanges.length); j++) {
					const range = spaceRanges[j];
					const replacement = j === i ? tag + (followingCharacter === ' ' ? '' : ' ') : tag;
					edits.push({ start: editor.document.offsetAt(range.start), end: editor.document.offsetAt(range.end), replacement });
				}
			} else {
				if (followingCharacter === ' ') {
					edits.push({ start: editor.document.offsetAt(openingSpace.start), end: editor.document.offsetAt(openingSpace.end), replacement: '' });
				}
				if (spaceRanges[i + 1]) {
					const range = spaceRanges[i + 1];
					edits.push({ start: editor.document.offsetAt(range.start), end: editor.document.offsetAt(range.end), replacement: '' });
				}
			}
		}
		const applied = await editor.edit((editBuilder) => {
			for (const edit of edits) {
				const range = new Range(editor.document.positionAt(edit.start), editor.document.positionAt(edit.end));
				editBuilder.replace(range, edit.replacement);
			}
		}, {
			undoStopBefore: false,
			undoStopAfter: false
		});
		if (!applied) return;
		editor.selections = openingCarets.map(caret => {
				const shift = edits.filter(edit => edit.end <= caret.start).reduce((sum, edit) => sum + edit.replacement.length - (edit.end - edit.start), 0);
			const position = editor.document.positionAt(caret.start + shift + caret.addedLength);
			return new Selection(position, position);
		});
		console.log('✔︎ Deselected closing tags');
	}
	catch (err) {
		console.error('Edit rejected!' + err);
	}
}
