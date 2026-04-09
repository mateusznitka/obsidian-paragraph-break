import { Plugin, Editor, MarkdownView } from "obsidian";

export default class ParagraphBreakPlugin extends Plugin {
	async onload() {
		this.addCommand({
			id: "insert-paragraph-break",
			name: "Wstaw nowy akapit (Enter = nowy paragraf)",
			editorCallback: (editor: Editor) => {
				this.insertParagraphBreak(editor);
			},
		});

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

			evt.preventDefault();
			evt.stopPropagation();

			this.insertParagraphBreak(activeView.editor);
		}, { capture: true });
	}

	insertParagraphBreak(editor: Editor) {
		const cursor = editor.getCursor();
		const line = editor.getLine(cursor.line);
		const totalLines = editor.lineCount();

		// Check if we're in a list item
		const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s/);
		if (listMatch) {
			// If line is empty list item — break out of list
			const afterBullet = line.slice(listMatch[0].length);
			if (afterBullet.trim() === "") {
				editor.setLine(cursor.line, "");
				editor.replaceRange("\n", { line: cursor.line, ch: 0 }, { line: cursor.line, ch: 0 });
				editor.setCursor({ line: cursor.line + 1, ch: 0 });
			} else {
				// Continue list with same prefix
				const prefix = listMatch[0];
				// For numbered lists, increment number
				const numberedMatch = line.match(/^(\s*)(\d+)(\.)\s/);
				let newPrefix = prefix;
				if (numberedMatch) {
					const num = parseInt(numberedMatch[2]) + 1;
					newPrefix = `${numberedMatch[1]}${num}${numberedMatch[3]} `;
				}
				const insertPos = { line: cursor.line, ch: cursor.ch };
				editor.replaceRange(`\n${newPrefix}`, insertPos);
				editor.setCursor({ line: cursor.line + 1, ch: newPrefix.length });
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

		// Default: insert paragraph break (empty line)
		const nextLine = cursor.line < totalLines - 1 ? editor.getLine(cursor.line + 1) : null;
		const atLineEnd = cursor.ch >= line.length;

		if (atLineEnd && nextLine === "") {
			// Already followed by empty line — just move cursor past it
			editor.setCursor({ line: cursor.line + 2, ch: 0 });
		} else {
			editor.replaceRange("\n\n", { line: cursor.line, ch: cursor.ch });
			editor.setCursor({ line: cursor.line + 2, ch: 0 });
		}
	}

	onunload() {}
}
