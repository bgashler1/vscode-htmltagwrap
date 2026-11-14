import { Range, Selection, TextEditor } from 'vscode';

interface Wrapper {
	openStart: number;
	openEnd: number;
	closeStart: number;
	closeEnd: number;
}

function openingAt(text: string, start: number): { end: number; name: string } | undefined {
	if (text[start] !== '<') return;
	let quote = '';
	for (let index = start + 1; index < text.length; index++) {
		const character = text[index];
		if (quote) {
			if (character === quote) quote = '';
		} else if (character === '"' || character === "'") {
			quote = character;
		} else if (character === '>') {
			const match = /^<([^\s/>]+)(?:\s[\s\S]*)?>$/.exec(text.substring(start, index + 1));
			return match ? { end: index + 1, name: match[1] } : undefined;
		}
	}
}

function closingAt(text: string, start: number): { end: number; name: string } | undefined {
	const match = /^<\/([^\s>]+)>/.exec(text.substring(start));
	return match ? { end: start + match[0].length, name: match[1] } : undefined;
}

export async function unwrapIfWrapped(editor: TextEditor): Promise<boolean> {
	const document = editor.document;
	const text = document.getText();
	const selections = editor.selections;
	// Only paired tag-name selections created by wrapping may toggle; selected HTML still wraps.
	if (selections.length === 0 || selections.length % 2 !== 0) return false;
	const wrappers: Wrapper[] = [];
	for (let index = 0; index < selections.length; index += 2) {
		const first = selections[index];
		const second = selections[index + 1];
		const name = document.getText(first);
		const openStart = document.offsetAt(first.start) - 1;
		const closeStart = document.offsetAt(second.start) - 2;
		const open = openingAt(text, openStart);
		const close = closingAt(text, closeStart);
		if (!name || name !== document.getText(second) || open?.name !== name || close?.name !== name ||
			open.end > closeStart || document.offsetAt(first.end) > open.end ||
			document.offsetAt(second.end) + 1 !== close.end) return false;
		wrappers.push({ openStart, openEnd: open.end, closeStart, closeEnd: close.end });
	}
	wrappers.sort((a, b) => a.openStart - b.openStart);
	if (wrappers.some((wrapper, index) => index > 0 && wrapper.openStart < wrappers[index - 1].closeEnd)) return false;
	const applied = await editor.edit(builder => {
		for (const wrapper of wrappers) {
			builder.delete(new Range(document.positionAt(wrapper.openStart), document.positionAt(wrapper.openEnd)));
			builder.delete(new Range(document.positionAt(wrapper.closeStart), document.positionAt(wrapper.closeEnd)));
		}
	});
	if (!applied) return false;
	editor.selections = wrappers.map(wrapper => {
		const shift = wrappers.filter(previous => previous.closeEnd <= wrapper.openStart)
			.reduce((total, previous) => total - (previous.openEnd - previous.openStart) - (previous.closeEnd - previous.closeStart), 0);
		const start = document.positionAt(wrapper.openStart + shift);
		const end = document.positionAt(wrapper.closeStart - (wrapper.openEnd - wrapper.openStart) + shift);
		return new Selection(start, end);
	});
	return true;
}
