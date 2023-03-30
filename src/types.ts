import * as vscode from 'vscode';

export interface SpaceInsertedPromiseResolution {
    passedSelections: readonly vscode.Selection[];
    spaceInsertedAt: vscode.Range[];
}

export type RangeIndexList = Array<number>;

export interface testOptions {
	customTag?: boolean;
	autoDeselectClosingTag?: boolean;
	additionalTestActions?: (editor: vscode.TextEditor) => void;
}

/**
 * A cursor selection is a StartPosition : EndPosition couple
 */
export type CursorSelection = [vscode.Position, vscode.Position]; 

export interface ExtensionCommandOptions {
	isInTestingMode?: boolean
}
