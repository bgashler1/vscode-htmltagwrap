import { window, ExtensionContext } from 'vscode';


export default function announceNotableUpdate (extensionContext: ExtensionContext) {
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