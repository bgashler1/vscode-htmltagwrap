import { EndOfLine, Selection, TextEditor, workspace, window } from 'vscode';

export interface WrapSnippet {
	name: string;
	before: string;
	after: string;
}

export async function wrapWithSnippet(editor: TextEditor, requestedName?: string): Promise<void> {
	const configured = workspace.getConfiguration('htmltagwrap').get<WrapSnippet[]>('snippets', []);
	const snippets = configured.filter(snippet => snippet && typeof snippet.name === 'string' &&
		typeof snippet.before === 'string' && typeof snippet.after === 'string');
	if (snippets.length === 0) {
		window.showInformationMessage('Configure htmltagwrap.snippets to wrap with a saved snippet.');
		return;
	}
	const name = requestedName || await window.showQuickPick(snippets.map(snippet => snippet.name), {
		placeHolder: 'Choose a wrap snippet'
	});
	if (!name) return;
	const snippet = snippets.find(candidate => candidate.name === name);
	if (!snippet) {
		window.showErrorMessage(`No htmltagwrap snippet named "${name}".`);
		return;
	}
	const document = editor.document;
	const eol = document.eol === EndOfLine.CRLF ? '\r\n' : '\n';
	const before = snippet.before.replace(/\r\n|\r|\n/g, eol);
	const after = snippet.after.replace(/\r\n|\r|\n/g, eol);
	const plans = editor.selections.map(selection => ({
		selection,
		start: document.offsetAt(selection.start),
		end: document.offsetAt(selection.end),
		selected: document.getText(selection)
	}));
	const applied = await editor.edit(builder => {
		for (const plan of plans) {
			builder.replace(plan.selection, before + plan.selected + after);
		}
	});
	if (!applied) return;
	const addedLength = before.length + after.length;
	editor.selections = plans.map(plan => {
		const precedingSelections = plans.filter(previous => previous.end <= plan.start && previous.start < plan.start).length;
		const shift = precedingSelections * addedLength;
		const start = document.positionAt(plan.start + shift + before.length);
		const end = document.positionAt(plan.start + shift + before.length + plan.selected.length);
		return new Selection(start, end);
	});
}
