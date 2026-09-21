import { Plugin, Editor, MarkdownView } from "obsidian";

export default class ParagraphBreakPlugin extends Plugin {
	async onload() {
		this.registerDomEvent(document, "keydown", (evt: KeyboardEvent) => {
			if (evt.key !== "Enter" || evt.shiftKey || evt.ctrlKey || evt.metaKey || evt.altKey) {
				return;
			}

			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!activeView || activeView.getMode() !== "source") {
				return;
			}

			// Check if focused element is inside the editor
			const editorEl = activeView.contentEl.querySelector(".cm-editor");
			if (!editorEl || !editorEl.contains(document.activeElement)) {
				return;
			}

			// Don't intercept Enter when editing the inline title
			if (document.activeElement?.closest(".inline-title")) {
				return;
			}

			evt.preventDefault();
			evt.stopPropagation();

			this.insertParagraphBreak(activeView.editor);
		}, { capture: true });
	}

	insertParagraphBreak(editor: Editor) {
		const cursor = editor.getCursor();
		const line = editor.getLine(cursor.line);
		const totalLines = editor.lineCount();

		// Check if we're in a list item (bullet, "1.", or "1)"), optionally a task ("- [ ]")
		const listMatch = line.match(/^(\s*)([-*+]|\d+[.)])\s/);
		if (listMatch) {
			const rest = line.slice(listMatch[0].length);
			const checkboxMatch = rest.match(/^\[.\]\s/);
			const afterMarker = checkboxMatch ? rest.slice(checkboxMatch[0].length) : rest;

			// If line is an empty list/task item — break out of list
			if (afterMarker.trim() === "") {
				editor.setLine(cursor.line, "");
				editor.replaceRange("\n", { line: cursor.line, ch: 0 });
				editor.setCursor({ line: cursor.line + 1, ch: 0 });
			} else {
				// Continue list with same prefix
				let bulletPrefix = listMatch[0];
				// For numbered lists, increment number (keep "." or ")" delimiter)
				const numberedMatch = line.match(/^(\s*)(\d+)([.)])\s/);
				if (numberedMatch) {
					const num = parseInt(numberedMatch[2]) + 1;
					bulletPrefix = `${numberedMatch[1]}${num}${numberedMatch[3]} `;
				}
				// For tasks, always continue with a fresh unchecked checkbox
				const newPrefix = checkboxMatch ? `${bulletPrefix}[ ] ` : bulletPrefix;
				const insertPos = { line: cursor.line, ch: cursor.ch };
				editor.replaceRange(`\n${newPrefix}`, insertPos);
				editor.setCursor({ line: cursor.line + 1, ch: newPrefix.length });
			}
			return;
		}

		// Check if we're in a blockquote (">", ">>", "> > ", ...)
		const quoteMatch = line.match(/^(\s*)((?:>\s?)+)/);
		if (quoteMatch) {
			const afterQuote = line.slice(quoteMatch[0].length);
			if (afterQuote.trim() === "") {
				// Empty blockquote line — break out of quote
				editor.setLine(cursor.line, "");
				editor.replaceRange("\n", { line: cursor.line, ch: 0 });
				editor.setCursor({ line: cursor.line + 1, ch: 0 });
			} else {
				const prefix = quoteMatch[0];
				const insertPos = { line: cursor.line, ch: cursor.ch };
				editor.replaceRange(`\n${prefix}`, insertPos);
				editor.setCursor({ line: cursor.line + 1, ch: prefix.length });
			}
			return;
		}

		// Check if we're in a code block
		let inCodeBlock = false;
		for (let i = 0; i <= cursor.line; i++) {
			if (editor.getLine(i).startsWith("```")) {
				inCodeBlock = !inCodeBlock;
			}
		}
		if (inCodeBlock) {
			editor.replaceRange("\n", cursor);
			editor.setCursor({ line: cursor.line + 1, ch: 0 });
			return;
		}

		// Default: always create a new paragraph
		if (line.trim() === "") {
			// Cursor is already on a blank paragraph-gap line — just add one more blank line to write into
			editor.replaceRange("\n", { line: cursor.line, ch: cursor.ch });
			editor.setCursor({ line: cursor.line + 1, ch: 0 });
			return;
		}

		const nextLine = cursor.line < totalLines - 1 ? editor.getLine(cursor.line + 1) : null;
		const atLineEnd = cursor.ch >= line.length;

		// Next line has content → file already has \n (line ending), so one more \n gives \n\n = paragraph break.
		// Next line is empty or missing → insert \n\n directly.
		const softBreakOnly = atLineEnd && nextLine !== null && nextLine !== "";
		editor.replaceRange(softBreakOnly ? "\n" : "\n\n", { line: cursor.line, ch: cursor.ch });
		editor.setCursor({ line: cursor.line + 2, ch: 0 });
	}

}
