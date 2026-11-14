import { commands, env, Selection, SnippetString, window, workspace } from 'vscode';
import { writeFileSync } from 'fs';

suite('Visual evidence', function () {
	test('issue reproduction and solution', async function () {
		this.timeout(60000);
		const scenario = process.env.HTW_EVIDENCE_CASE;
		const stageName = process.env.HTW_STAGE_NAME;
		if (!scenario || !stageName) return;
		const stageFile = `/private/tmp/htw-stage-${stageName}.txt`;
		const config = workspace.getConfiguration('htmltagwrap');
		const input = scenario === 'block' ? '<section>\n  <img src="xyz" />\n</section>' : 'hello';
		const document = await workspace.openTextDocument({ language: 'html', content: input });
		const editor = await window.showTextDocument(document);
		editor.options = { insertSpaces: true, tabSize: 2 };
		await config.update('tag', scenario === 'space' || scenario === 'block' ? 'div' : scenario === 'attributes' ? 'code translate="no"' : 'p', true);
		await config.update('autoDeselectClosingTag', scenario === 'space' || scenario === 'paste', true);
		if (scenario === 'snippet' && process.env.HTW_FIXED === '1') await config.update('snippets', [{ name: 'Example', before: '<!-- ', after: ' -->' }], true);
		editor.selection = scenario === 'block' ? new Selection(1, 2, 1, 19) : new Selection(0, 0, 0, 5);
		const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
		if (scenario === 'toggle') await commands.executeCommand('extension.htmlTagWrap');
		writeFileSync(stageFile, 'before');
		await wait(9000);
		if (scenario === 'space' || scenario === 'paste') {
			const wrapping = commands.executeCommand('extension.htmlTagWrap');
			const deadline = Date.now() + 3000;
			while (editor.selections.length !== 2 && Date.now() < deadline) await wait(10);
			if (scenario === 'space') await editor.insertSnippet(new SnippetString(' '));
			else {
				await env.clipboard.writeText('span class="comment"');
				await commands.executeCommand('editor.action.clipboardPasteAction');
			}
			await Promise.race([wrapping, wait(500)]);
		} else if (scenario === 'snippet') {
			try { await commands.executeCommand('extension.htmlTagWrapSnippet', 'Example'); } catch { /* command is absent in the parent PR */ }
		} else if (scenario === 'block') {
			await commands.executeCommand(process.env.HTW_FIXED === '1' ? 'extension.htmlTagWrapBlock' : 'extension.htmlTagWrap');
		} else {
			await commands.executeCommand('extension.htmlTagWrap');
		}
		writeFileSync(stageFile, 'after');
		await wait(9000);
		writeFileSync(stageFile, 'done');
	});
});
