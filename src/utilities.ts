import { window, workspace, ExtensionContext, TextEditor } from 'vscode';


export function announceNotableUpdate (extensionContext: ExtensionContext) {
    // Announce notable changes. Update the `lastNotableUpdate` to current version to announce. Use sparingly.
    if (extensionContext) {
        // Prevents tests from breaking
        const lastNotableUpdate = '0.0.7';
        const hasUserSeenCurrentUpdateMessage: boolean = extensionContext.globalState.get('lastUpdateSeen') === lastNotableUpdate ? true : false;
        if (!hasUserSeenCurrentUpdateMessage) {
            window.showInformationMessage('htmltagwrap now supports adding attributes on opening tags');
            extensionContext.globalState.update('lastUpdateSeen', lastNotableUpdate);
            console.log('lastUpdateSeen = ', extensionContext.globalState.get('lastUpdateSeen'));
        }
    }
}

export function getTag() {
    const tagSetting = workspace.getConfiguration().get<string>("htmltagwrap.tag");
    if (!tagSetting) {
        return 'p'; 
    }
    return tagSetting;
}

export function getTabString(editor: TextEditor): string {
	const spacesUsed = <boolean>editor.options.insertSpaces;
	if (spacesUsed) {
		const numOfUsedSpaces = <number>editor.options.tabSize;
		return ' '.repeat(numOfUsedSpaces);
	}
	return '\t';
}