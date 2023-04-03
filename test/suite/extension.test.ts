//
// Uses Mocha test framework.
// Refer to their documentation on https://mochajs.org/ for help.
//

import {expect} from 'chai';
import {workspace, window, Selection, Position, commands, extensions, Uri, TextEditor, Range, WorkspaceConfiguration} from 'vscode';
import {copySync, CopyOptions, emptyDir} from 'fs-extra';
import * as extension from '../../src/extension';
import { testOptions, CursorSelection } from '../../src/types';
import { getTabString } from '../../src/utilities';

extension.activate();
const extensionID = 'bradgashler.htmltagwrap';
const samplesFolder = extensions.getExtension(extensionID).extensionPath + '/test/suite/sampleFiles/';
const tempFolder = samplesFolder + 'temp/';

function parametrizedSingleSelectionTest(startFilePath: string, expectedResultFilePath: string, selectionStart: Position, selectionEnd: Position, failMessage: string) {
	const selection:CursorSelection = [selectionStart, selectionEnd];
	const selections: Array<CursorSelection> = [selection];

	return parametrizedMultiSelectionTest(startFilePath, expectedResultFilePath, selections, failMessage);
}

async function parametrizedMultiSelectionTest(startFilePath: string, expectedResultFilePath: string, selections: Array<CursorSelection>, failMessage: string, options?: testOptions) {
	// 
	// This function is the core test logic
	// 
	const workingFilePath = tempFolder + startFilePath;
	let tagWasUpdatedByTest: boolean;
	const tagConfig = workspace.getConfiguration('htmltagwrap');

	copySync(samplesFolder + startFilePath, workingFilePath, { clobber: true });

	const workingDocument = await workspace.openTextDocument(workingFilePath);
	const editor = await window.showTextDocument(workingDocument);

	// Except for tests that strictly want to test with autoDeslectClosingTag, disable this normally default setting to prevent error spam
	await tagConfig.update('autoDeselectClosingTag', options?.autoDeselectClosingTag === true ? true : false, true);
	
	if (options?.customTag === true) {
		const tag = 'helloworld';
		await tagConfig.update('tag',tag, true).then(success => {
			tagWasUpdatedByTest = true;
			console.log(`✔ Updated tag to ${tag}`);
		}, rejected => {
			throw new Error(`failed to update custom tag to ${tag}`);
		});
	}
	editor.selections = selections.map(s => new Selection(s[0], s[1]));
	await commands.executeCommand('extension.htmlTagWrap', {
		isInTestingMode: true
	});
	await new Promise((resolve) => setTimeout(resolve, 500));

	if (options?.autoDeselectClosingTag === true) {
		// Test what happens when a user hits spacebar
		// TODO: put this stuff in the relevant test(s) and embed it as an optional parameter function that gets called
		console.log('autoDeselectClosingTag test RAN!');
		const editor = window.activeTextEditor;
		if(editor == null) throw new Error('Couldn\'t see the editor');
		const previousSelections = [...editor.selections];
		// Simulate hitting spacebar
		

		console.log('Selection = ', selections);
		
	}
	
	if (tagWasUpdatedByTest) {
		try {
			await tagConfig.update('tag', undefined, true);
			tagWasUpdatedByTest = false;
		} catch(error) {
			throw new Error('Failed to remove temporary custom tag setting: ' + error);
		}
	}
	if (options?.additionalTestActions) await options?.additionalTestActions(editor);
	const result = editor.document.getText();
	const expectedResultDocument = await workspace.openTextDocument(samplesFolder + expectedResultFilePath);
	const expectedResult = expectedResultDocument.getText();
	// await commands.executeCommand('workbench.action.closeActiveEditor');
	await new Promise((f) => setTimeout(f, 500));
	

	expect(result).not.to.be.equal(undefined, 'File loding error');
	expect(expectedResult).not.to.be.equal(undefined, 'File loding error');
	expect(result).to.be.equal(expectedResult, failMessage);
}


suite('Extension Tests', function () {
	// Single selection tests
	test('HTML with tabs block wrap test', function () {
		return parametrizedSingleSelectionTest('tabFile.html', 'expectedTabBlockWrapFile.html', new Position(1, 1), new Position(6, 6), 'Tab using block wrap does not work');
	});
	test('HTML with spaces block wrap test', function () {
		return parametrizedSingleSelectionTest('spaceFile.html', 'expectedSpaceBlockWrapFile.html', new Position(1, 4), new Position(7, 9), 'Space using block wrap does not work');
	});
	test('HTML with tabs line wrap test', function () {
		return parametrizedSingleSelectionTest('tabFile.html', 'expectedTabLineWrapFile.html', new Position(2, 2), new Position(2, 11), 'Tab using line wrap does not work');
	});
	test('HTML with spaces line wrap test', function () {
		return parametrizedSingleSelectionTest('spaceFile.html', 'expectedSpaceLineWrapFile.html', new Position(2, 8), new Position(2, 17), 'Space using line wrap does not work');
	});
	test('Empty selection line wrap test', function() {
		return parametrizedSingleSelectionTest('emptyFile.html', 'expectedEmptyFileSingleCursor.html', new Position(0, 0), new Position(0, 0), 'Empty selection tag wrap does not work');
	});

	// Multiple selecetion tests
	test('Multiple Empty selections line wrap test', function() {
		const selections: Array<CursorSelection> = [ 
			[new Position(1, 0), new Position(1, 0)], 
			[new Position(2, 0), new Position(2, 0)], 
			[new Position(3, 0), new Position(3, 0)] 
		];
		return parametrizedMultiSelectionTest('emptySelectionMultipleCursors.html', 'expectedEmptySelectionMultipleCursors.html', selections, 'Empty selection tag wrap does not work with multiple selections');
	});

	test('Multiple selections block wrap test', function() {
		const selections: Array<CursorSelection> = [ 
			[new Position(1, 4), new Position(2, 17)], 
			[new Position(5, 0), new Position(6, 13)], 
			[new Position(10, 8), new Position(11, 15)] 
		];
		return parametrizedMultiSelectionTest('textBlocks.html', 'expectedMultiSelectionTextBlocksFile.html', selections, 'Multiple selections text block wrap does not work');
	});

	test('Multiple selections block wrap test', function() {
		const selections: Array<CursorSelection> = [ 
			[new Position(1, 4), new Position(2, 17)], 
			[new Position(5, 0), new Position(6, 13)], 
			[new Position(10, 8), new Position(11, 15)] 
		];
		return parametrizedMultiSelectionTest('textBlocks.html', 'expectedMultiSelectionTextBlocksFile.html', selections, 'Multiple selections text block wrap does not work');
	});

	test('Multiple selections mix block / text wrap test', function() {
		const selections: Array<CursorSelection> = [ 
			[new Position(1, 4), new Position(1, 21)],
			[new Position(2, 4), new Position(2, 17)], 
			[new Position(5, 0), new Position(6, 13)], 
			[new Position(10, 8), new Position(10, 19)],
			[new Position(11, 11), new Position(11, 15)] 
		];
		return parametrizedMultiSelectionTest('textBlocks.html', 'expectedMultiSelectionMixedLineBlockFile.html', selections, 'Multiple selections mixed (text and block) does not work');
	});

	test('Custom tag test', function() {
		const selections: Array<CursorSelection> = [ 
			[new Position(1, 4), new Position(1, 21)],
			[new Position(2, 4), new Position(2, 17)], 
			[new Position(5, 0), new Position(6, 13)], 
			[new Position(10, 8), new Position(10, 19)],
			[new Position(11, 11), new Position(11, 15)] 
		];
		const options: testOptions = {
			customTag: true
		};
		return parametrizedMultiSelectionTest('textBlocks.html', 'expectedCustomTag.html', selections, 'Custom tag value "helloworld" does not work', options);
	});

	test('Multiple same line selections (regression test)', function() {
		const selections: Array<CursorSelection> = [ 
			[new Position(10, 8), new Position(10, 12)],
			[new Position(10, 13), new Position(10, 15)],
			[new Position(10, 16), new Position(10, 19)],
			[new Position(10, 20), new Position(10, 25)],
			[new Position(10, 26), new Position(10, 31)],
		];
		const options: testOptions = {
			customTag: true
		};
		return parametrizedMultiSelectionTest('textBlocks.html', 'expectedMultipleSameLineSelectionsFile.html', selections, 'Multiple same line selections error. (regression)', options);
	});
	test('Press spacebar (autoDeslect enabled)', function() {
		// TODO: improve this by using VS Code `Selection[]` instead (maybe a `map` to generate them with `new Selection()`)
		// Then use the `.with(start: Position)` method to offset them perhaps?
		// https://code.visualstudio.com/api/references/vscode-api#Selection
		const selections: CursorSelection[] = [ 
			[new Position(1, 4), new Position(1, 21)],
			[new Position(2, 4), new Position(2, 17)], 
			[new Position(5, 0), new Position(6, 13)], 
			[new Position(10, 8), new Position(10, 19)],
			[new Position(11, 11), new Position(11, 15)] 
		];
		const options: testOptions = {
			autoDeselectClosingTag: true,
			additionalTestActions: simulateSpacebarPress
		};
		async function simulateSpacebarPress (editor: TextEditor) {
			const space = ' ';
			const tabSizeSpace = getTabString(editor);
			const toSelect: Selection[] = [];
			// const properSelections = selections.map((v) => new Selection(v[0], v[1]));
			try {
				const selections = editor.selections;
				await editor.edit((editBuilder)=> {
					for (const [i, selection] of selections.entries()) {
						if (i % 2 !== 0) continue;
						let offsetedStartPositionToInsertSpace;
						if (selection.start.line !== selection.start.line) {
							// Block wrapped
							offsetedStartPositionToInsertSpace = selection.start.with({ line: selection[0].line, character: selection.start.character + 1});
						} else {
							// Inline wrapped
							offsetedStartPositionToInsertSpace = selection.start.with({ character: selection.start.character + 1});
						}
						editBuilder.insert(offsetedStartPositionToInsertSpace, space);
						// Deselect range but keep cursor(s)
						const newSelection = new Selection(new Position(selection.start[0], selection.start[0]), new Position(selection.start[0], selection.start[0]));
						toSelect.push(newSelection);
						new Promise((resolve) => setTimeout(() => resolve, 1000));
					}
				});
			} catch(err) {
				console.error('Failed to simulate space ', err);
			}
			editor.selections = toSelect;
			console.log('waiting done');
		}
		return parametrizedMultiSelectionTest('textBlocks.html', 'expectedAutoDeselect_DefaultTag.html', selections, 'Garbled text after pressing spacebar with default tag', options);
	});
	
	/*
	test('Modify tag, then press spacebar (autoDeslect enabled)', function() {
		const selections: Array<CursorSelection> = [ 
			[new Position(1, 4), new Position(1, 21)],
			[new Position(2, 4), new Position(2, 17)], 
			[new Position(5, 0), new Position(6, 13)], 
			[new Position(10, 8), new Position(10, 19)],
			[new Position(11, 11), new Position(11, 15)] 
		];
		const options: testOptions = {
			autoDeselectClosingTag: true
		};
		return parametrizedMultiSelectionTest('textBlocks.html', 'expectedAutoDeselect_DefaultTag.html', selections, 'Garbled text after typing tag and then pressing spacebar', options);
	});
	*/
	
	teardown((done) => emptyDir(tempFolder, done));
});