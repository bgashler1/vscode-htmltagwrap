import * as vscode from 'vscode';
import { announceNotableUpdate } from './utilities';
import { wrapInTagsAndSelect } from './wrap';
import { autoDeselectClosingTag } from './autoDeselectClosingTag';
import { getTag } from './utilities';
import { ExtensionCommandOptions } from './types';


export function activate(extensionContext?: vscode.ExtensionContext) {
	// Code in this function runs each time extension is activated
	// The command's name is pre-declared in package.json
	const disposable = vscode.commands.registerCommand('extension.htmlTagWrap', async (options: ExtensionCommandOptions) => {
		const editor = vscode.window.activeTextEditor;
		if(editor == null) return;
		const isInTestingMode = options?.isInTestingMode ? options.isInTestingMode : false;
		const tag = getTag();
		const passedSelections = await wrapInTagsAndSelect(editor, tag);

		const isEnabledAutodeselectClosingTag = vscode.workspace.getConfiguration().get<boolean>("htmltagwrap.autoDeselectClosingTag");
		if (!isEnabledAutodeselectClosingTag) return;
		await autoDeselectClosingTag(editor, passedSelections);
	});
	extensionContext?.subscriptions.push(disposable);
}