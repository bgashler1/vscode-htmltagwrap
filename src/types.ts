import * as vscode from 'vscode';

export interface SpaceInsertedPromiseResolution {
    passedSelections: readonly vscode.Selection[];
    spaceInsertedAt: vscode.Range[];
}

export type RangeIndexList = Array<number>;