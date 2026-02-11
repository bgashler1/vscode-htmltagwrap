import { window, workspace, ExtensionContext, TextEditor } from 'vscode';


export function announceNotableUpdate (extensionContext: ExtensionContext) {
    // Announce notable changes. Update the `lastNotableUpdate` to current version to announce. Use sparingly.
    if (extensionContext) {
        // Prevents tests from breaking
        const lastNotableUpdate = '0.0.7';
        const hasUserSeenCurrentUpdateMessage: boolean = extensionContext.globalState.get('lastUpdateSeen') === lastNotableUpdate ? true : false;
        if (!hasUserSeenCurrentUpdateMessage) {
            window.showInformationMessage('Multiple Htmltagwrap bugfixes have landed. `Auto deselect` closing tags on spacebar press is working again.');
            extensionContext.globalState.update('lastUpdateSeen', lastNotableUpdate);
            console.log('lastUpdateSeen = ', extensionContext.globalState.get('lastUpdateSeen'));
        }
    }
}

export function getTag() {
    // You must call this within a function scope, not globally, or else it will not be updated if a test updates it programmatically.
    const tagSetting = workspace.getConfiguration().get<string>("htmltagwrap.tag");
    if (tagSetting === undefined) {
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
