import * as vscode from 'vscode';
export interface SpaceInsertedPromiseResolution {
    spaceInsertedAt: vscode.Range;
    initialSelections: readonly vscode.Selection[];
}