//
// Uses Mocha test framework.
// Refer to their documentation on https://mochajs.org/ for help.
//

import {expect} from 'chai';
import {workspace, window, Selection, Position, commands, extensions, Uri, TextEditor, Range, WorkspaceConfiguration} from 'vscode';
import {copySync, CopyOptions, emptyDir} from 'fs-extra';
import * as extension from '../../src/extension';

// A cursor selection is a StartPosition : EndPosition couple
type CursorSelection = [Position, Position]; 

const extensionID = 'bradgashler.htmltagwrap';
const samplesFolder = extensions.getExtension(extensionID).extensionPath + '/test/suite/sampleFiles/';
const tempFolder = samplesFolder + 'temp/';

interface testOptions{
	customTag?: boolean;
	autoDeselectClosingTag?: boolean;
}
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

	if (options?.autoDeselectClosingTag !== true) {
		// Except for tests that simulate autoDeslectClosingTag, disable this to prevent error spam
		await tagConfig.update('autoDeselectClosingTag', false, true);
	}
	
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
	await commands.executeCommand('extension.htmlTagWrap');
	await new Promise((resolve) => setTimeout(resolve, 500));
	
	if (tagWasUpdatedByTest) {
		try {
			await tagConfig.update('tag', undefined, true);
			tagWasUpdatedByTest = false;
		} catch(error) {
			throw new Error('Failed to remove temporary custom tag setting: ' + error);
		}
	}
	const result = editor.document.getText();
	const expectedResultDocument = await workspace.openTextDocument(samplesFolder + expectedResultFilePath);
	const expectedResult = expectedResultDocument.getText();
	await commands.executeCommand('workbench.action.closeActiveEditor');
	await new Promise((f) => setTimeout(f, 500));

	expect(result).not.to.be.equal(undefined, 'File loding error');
	expect(expectedResult).not.to.be.equal(undefined, 'File loding error');
	expect(result).to.be.equal(expectedResult, failMessage);
}


suite('Extension Tests', function () {
	for (const tag of ['p', 'div', 'CountContext']) {
		test(`space after wrapping preserves the ${tag} closing tag`, async function () {
			this.timeout(10000);
			const config = workspace.getConfiguration('htmltagwrap');
			const document = await workspace.openTextDocument({ language: 'html', content: 'hello' });
			const editor = await window.showTextDocument(document);
			await config.update('tag', tag, true);
			await config.update('autoDeselectClosingTag', true, true);
			try {
				editor.selection = new Selection(0, 0, 0, 5);
				const wrapping = commands.executeCommand('extension.htmlTagWrap');
				const deadline = Date.now() + 5000;
				while (editor.document.getText() !== `<${tag}>hello</${tag}>` ||
					editor.selections.length !== 2 ||
					editor.selections.some(selection => editor.document.getText(selection) !== tag)) {
					if (Date.now() > deadline) throw new Error(`Wrap did not complete: ${editor.document.getText()} ${editor.selections.map(selection => editor.document.getText(selection)).join('|')}`);
					await new Promise(resolve => setTimeout(resolve, 10));
				}
				await new Promise(resolve => setTimeout(resolve, 0));
				await commands.executeCommand('type', { text: ' ' });
				await wrapping;
				expect(editor.document.getText()).to.equal(`<${tag} >hello</${tag}>`);
				expect(editor.selections).to.have.length(1);
				expect(editor.selection.active.character).to.equal(tag.length + 2);
				await commands.executeCommand('type', { text: 'class="x"' });
				expect(editor.document.getText()).to.equal(`<${tag} class="x">hello</${tag}>`);
			} finally {
				await config.update('tag', undefined, true);
				await config.update('autoDeselectClosingTag', undefined, true);
				await commands.executeCommand('workbench.action.closeActiveEditor');
			}
		});
	}
	test('moving the cursor after existing whitespace leaves it in place', async function () {
		this.timeout(10000);
		const config = workspace.getConfiguration('htmltagwrap');
		const document = await workspace.openTextDocument({ language: 'html', content: 'hello world' });
		const editor = await window.showTextDocument(document);
		await config.update('tag', 'div', true);
		await config.update('autoDeselectClosingTag', true, true);
		try {
			editor.selection = new Selection(0, 0, 0, 11);
			const wrapping = commands.executeCommand('extension.htmlTagWrap');
			const deadline = Date.now() + 5000;
			while (editor.document.getText() !== '<div>hello world</div>' || editor.selections.length !== 2) {
				if (Date.now() > deadline) throw new Error('Wrap did not complete');
				await new Promise(resolve => setTimeout(resolve, 10));
			}
			const caret = '<div>hello '.length;
			editor.selection = new Selection(0, caret, 0, caret);
			await wrapping;
			expect(editor.document.getText()).to.equal('<div>hello world</div>');
			expect(editor.selection.active.character).to.equal(caret);
		} finally {
			await config.update('tag', undefined, true);
			await config.update('autoDeselectClosingTag', undefined, true);
			await commands.executeCommand('workbench.action.closeActiveEditor');
		}
	});
	
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
		const options = {
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
		const options = {
			customTag: true
		};
		return parametrizedMultiSelectionTest('textBlocks.html', 'expectedMultipleSameLineSelectionsFile.html', selections, 'Multiple same line selections error. (regression)', options);
	});
	
	test('Block selection ends on blank line (Issue #22)', function() {
		const selections: Array<CursorSelection> = [ 
			[new Position(0, 0), new Position(3, 0)],
		];
		return parametrizedMultiSelectionTest('blockSelectionBlankLastLine.html', 'expectedBlockSelectionBlankLastLine.html', selections, 'See issue #22 (regression)');
	});


	teardown((done) => emptyDir(tempFolder, done));
});
