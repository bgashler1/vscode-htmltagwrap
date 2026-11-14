import * as vscode from 'vscode';
import { announceNotableUpdate } from './utilities';
import { wrapInTagsAndSelect, wrapInBlockTagsAndSelect } from './wrap';
import { autoDeselectClosingTag, cancelAutoDeselectClosingTag } from './autoDeselectClosingTag';
import { getTagDefinition } from './utilities';
import { wrapWithSnippet } from './snippets';
import { unwrapIfWrapped } from './toggle';


export function activate(extensionContext?: vscode.ExtensionContext) {
	const wrapGeneration = new WeakMap<vscode.TextEditor, number>();
	const inlineWrapVersion = new WeakMap<vscode.TextEditor, number>();
	const lastBlockWrap = new WeakMap<vscode.TextEditor, { version: number; text: string; selections: readonly vscode.Selection[]; tagSelections: readonly vscode.Selection[] }>();
	// Code in this function runs each time extension is activated
	// The command's name is pre-declared in package.json
	const runWrap = async (block: boolean) => {
		const editor = vscode.window.activeTextEditor;
		if(editor == null) return;
		const generation = (wrapGeneration.get(editor) || 0) + 1;
		wrapGeneration.set(editor, generation);
		cancelAutoDeselectClosingTag(editor);
		const previousBlock = lastBlockWrap.get(editor);
		if (!block && previousBlock?.version === editor.document.version &&
			editor.selections.length === previousBlock.tagSelections.length &&
			editor.selections.every((selection, index) => selection.isEqual(previousBlock.tagSelections[index]))) {
			lastBlockWrap.delete(editor);
			const document = editor.document;
			await editor.edit(builder => builder.replace(new vscode.Range(new vscode.Position(0, 0), document.positionAt(document.getText().length)), previousBlock.text));
			editor.selections = [...previousBlock.selections];
			return;
		}
		lastBlockWrap.delete(editor);
		if (!block && inlineWrapVersion.get(editor) === editor.document.version && await unwrapIfWrapped(editor)) {
			inlineWrapVersion.delete(editor);
			return;
		}
		inlineWrapVersion.delete(editor);
		announceNotableUpdate(extensionContext);
		
		const tag = getTagDefinition();
		const originalBlock = block ? { text: editor.document.getText(), selections: editor.selections.slice() } : undefined;
		const passedSelections = block
			? await wrapInBlockTagsAndSelect(editor, tag.name, tag.attributes)
			: await wrapInTagsAndSelect(editor, tag.name, tag.attributes);
		if (!block) inlineWrapVersion.set(editor, editor.document.version);
		if (block && originalBlock) lastBlockWrap.set(editor, { ...originalBlock, version: editor.document.version, tagSelections: passedSelections.slice() });

		const isEnabledAutodeselectClosingTag = vscode.workspace.getConfiguration().get<boolean>("htmltagwrap.autoDeselectClosingTag");
		if (!isEnabledAutodeselectClosingTag || wrapGeneration.get(editor) !== generation) return;
		await autoDeselectClosingTag(editor, passedSelections);
	};
	const wrapCommand = vscode.commands.registerCommand('extension.htmlTagWrap', () => runWrap(false));
	const blockCommand = vscode.commands.registerCommand('extension.htmlTagWrapBlock', () => runWrap(true));
	const snippetCommand = vscode.commands.registerCommand('extension.htmlTagWrapSnippet', (name?: string) => {
		const editor = vscode.window.activeTextEditor;
		if (editor) return wrapWithSnippet(editor, name);
	});
	extensionContext?.subscriptions.push(wrapCommand, blockCommand, snippetCommand);
}
