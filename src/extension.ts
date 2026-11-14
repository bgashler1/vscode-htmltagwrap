import * as vscode from 'vscode';
import { announceNotableUpdate } from './utilities';
import { wrapInTagsAndSelect, wrapInBlockTagsAndSelect } from './wrap';
import { autoDeselectClosingTag } from './autoDeselectClosingTag';
import { getTagDefinition } from './utilities';
import { wrapWithSnippet } from './snippets';


export function activate(extensionContext?: vscode.ExtensionContext) {
	// Code in this function runs each time extension is activated
	// The command's name is pre-declared in package.json
	const runWrap = async (block: boolean) => {
		const editor = vscode.window.activeTextEditor;
		if(editor == null) return;
		announceNotableUpdate(extensionContext);
		
		const tag = getTagDefinition();
		const passedSelections = block
			? await wrapInBlockTagsAndSelect(editor, tag.name, tag.attributes)
			: await wrapInTagsAndSelect(editor, tag.name, tag.attributes);

		const isEnabledAutodeselectClosingTag = vscode.workspace.getConfiguration().get<boolean>("htmltagwrap.autoDeselectClosingTag");
		if (!isEnabledAutodeselectClosingTag) return;
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
