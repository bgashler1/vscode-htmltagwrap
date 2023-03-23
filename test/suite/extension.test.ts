//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

import {expect} from 'chai';
import {workspace, window, Selection, Position, commands, extensions, Uri, TextEditor, Range, WorkspaceConfiguration} from 'vscode';
import {copySync, CopyOptions, emptyDir} from 'fs-extra';
import * as extension from '../../src/extension';

// A cursor selection is a StartPosition : EndPosition couple
type CursorSelection = [Position, Position]; 

extension.activate();
let extensionID = 'bradgashler.htmltagwrap';
let samplesFolder = extensions.getExtension(extensionID).extensionPath + '/test/suite/sampleFiles/';
let tempFolder = samplesFolder + 'temp/';

interface testOptions {
	customTag?: boolean;
}
function parametrizedSingleSelectionTest(startFilePath: string, expectedResultFilePath: string, selectionStart: Position, selectionEnd: Position, failMessage: string) {
	const selection:CursorSelection = [selectionStart, selectionEnd];
	const selections: Array<CursorSelection> = [selection];

	return parametrizedMultiSelectionTest(startFilePath, expectedResultFilePath, selections, failMessage);
}

function parametrizedMultiSelectionTest(startFilePath: string, expectedResultFilePath: string, selections: Array<CursorSelection>, failMessage: string, options?: testOptions) {
	let result: string;
	let expectedResult: string;
	let editor: any;
	let workingFilePath = tempFolder + startFilePath;
	let tagWasUpdatedByTest: boolean;
	const tagConfig = workspace.getConfiguration('htmltagwrap');

	copySync(samplesFolder + startFilePath, workingFilePath, { clobber: true });

	let testPromise = workspace.openTextDocument(workingFilePath).then((workingDocument) => {
		return window.showTextDocument(workingDocument);
	}).then((_editor) => {
		return new Promise(resolve => {
			editor = _editor;
			if (options) {
				tagConfig.update('tag','helloworld', true).then(success => {
					tagWasUpdatedByTest = true;
					resolve('✔ Updated tag to "helloworld"');
				}, rejected => {
					rejected('failed to update tag to "helloworld"');
				});
			}
			else {
				resolve('No need to update tag');
			}
		}).then(success => {
			editor.selections = selections.map(s => new Selection(s[0], s[1]));
			return commands.executeCommand('extension.htmlTagWrap').then(() => new Promise((f) => setTimeout(f, 500)));
		}, failure => {
			console.error(failure);
		}).then(() => {
			return new Promise(resolve => {
				if (tagWasUpdatedByTest) {
					tagConfig.update('tag', undefined, true).then(success => {
						resolve('✔ Removed temporary tag setting for "helloworld" tag');
						tagWasUpdatedByTest = false;
					}, rejected => {
						rejected('failed to remove temporary tag setting for "helloworld"');
					});
				} else {
					resolve(null);
				}
			}).then(() => {
				result = editor.document.getText();
			},failure => {
				console.error(failure)
			});
		}).then(() => {
			return workspace.openTextDocument(samplesFolder + expectedResultFilePath);
		}).then((expectedResultDocument: any) => {
			expectedResult = expectedResultDocument.getText();
		}).then(() => {
			return commands.executeCommand('workbench.action.closeActiveEditor').then(() => new Promise((f) => setTimeout(f, 500)));
		});
	});

	return testPromise.then(() => {
		expect(result).not.to.be.equal(undefined, 'File loding error');
		expect(expectedResult).not.to.be.equal(undefined, 'File loding error');
		expect(result).to.be.equal(expectedResult, failMessage);
	});
}


suite('Extension Tests', function () {
	
	// Single selection tests
	test('HTML with tabs block wrap test', function () {
		return parametrizedSingleSelectionTest('tabFile.html', 'expectedTabBlockWrapFileResult.html', new Position(1, 1), new Position(6, 6), 'Tab using block wrap does not work');
	});
	test('HTML with spaces block wrap test', function () {
		return parametrizedSingleSelectionTest('spaceFile.html', 'expectedSpaceBlockWrapFileResult.html', new Position(1, 4), new Position(7, 9), 'Space using block wrap does not work');
	});
	test('HTML with tabs line wrap test', function () {
		return parametrizedSingleSelectionTest('tabFile.html', 'expectedTabLineWrapFileResult.html', new Position(2, 2), new Position(2, 11), 'Tab using line wrap does not work');
	});
	test('HTML with spaces line wrap test', function () {
		return parametrizedSingleSelectionTest('spaceFile.html', 'expectedSpaceLineWrapFileResult.html', new Position(2, 8), new Position(2, 17), 'Space using line wrap does not work');
	});
	test('Empty selection line wrap test', function() {
		return parametrizedSingleSelectionTest('emptyFile.html', 'expectedEmptyFileSingleCursorResult.html', new Position(0, 0), new Position(0, 0), 'Empty selection tag wrap does not work');
	});

	// Multiple selecetion tests
	test('Multiple Empty selections line wrap test', function() {
		const selections: Array<CursorSelection> = [ 
			[new Position(1, 0), new Position(1, 0)], 
			[new Position(2, 0), new Position(2, 0)], 
			[new Position(3, 0), new Position(3, 0)] 
		];
		return parametrizedMultiSelectionTest('emptySelectionMultipleCursors.html', 'expectedEmptySelectionMultipleCursorsResult.html', selections, 'Empty selection tag wrap does not work with multiple selections');
	});

	test('Multiple selections block wrap test', function() {
		const selections: Array<CursorSelection> = [ 
			[new Position(1, 4), new Position(2, 17)], 
			[new Position(5, 0), new Position(6, 13)], 
			[new Position(10, 8), new Position(11, 15)] 
		];
		return parametrizedMultiSelectionTest('textBlocks.html', 'expectedMultiSelectionTextBlocksFileResult.html', selections, 'Multiple selections text block wrap does not work');
	});

	test('Multiple selections block wrap test', function() {
		const selections: Array<CursorSelection> = [ 
			[new Position(1, 4), new Position(2, 17)], 
			[new Position(5, 0), new Position(6, 13)], 
			[new Position(10, 8), new Position(11, 15)] 
		];
		return parametrizedMultiSelectionTest('textBlocks.html', 'expectedMultiSelectionTextBlocksFileResult.html', selections, 'Multiple selections text block wrap does not work');
	});

	test('Multiple selections mix block / text wrap test', function() {
		const selections: Array<CursorSelection> = [ 
			[new Position(1, 4), new Position(1, 21)],
			[new Position(2, 4), new Position(2, 17)], 
			[new Position(5, 0), new Position(6, 13)], 
			[new Position(10, 8), new Position(10, 19)],
			[new Position(11, 11), new Position(11, 15)] 
		];
		return parametrizedMultiSelectionTest('textBlocks.html', 'expectedMultiSelectionMixedLineBlockFileResult.html', selections, 'Multiple selections mixed (text and block) does not work');
	});

	test('Custom tag test', function() {
		const selections: Array<CursorSelection> = [ 
			[new Position(1, 4), new Position(1, 21)],
			[new Position(2, 4), new Position(2, 17)], 
			[new Position(5, 0), new Position(6, 13)], 
			[new Position(10, 8), new Position(10, 19)],
			[new Position(11, 11), new Position(11, 15)] 
		];
		const options = {
			customTag: true
		}
		return parametrizedMultiSelectionTest('textBlocks.html', 'expectedCustomTagFileResult.html', selections, 'Custom tag value "helloworld" does not work', options);
	});

	test('Multiple same line selections (regression test)', function() {
		const selections: Array<CursorSelection> = [ 
			[new Position(10, 8), new Position(10, 12)],
			[new Position(10, 13), new Position(10, 15)],
			[new Position(10, 16), new Position(10, 19)],
			[new Position(10, 20), new Position(10, 25)],
			[new Position(10, 26), new Position(10, 31)],
		];
		const options = {
			customTag: true
		}
		return parametrizedMultiSelectionTest('textBlocks.html', 'expectedMultipleSameLineSelectionsFileResult.html', selections, 'Multiple same line selections error. (regression)', options);
	});


	teardown((done) => emptyDir(tempFolder, done));
});