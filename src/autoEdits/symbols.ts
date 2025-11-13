import * as vscode from 'vscode';

export function handleSymbolReplacement(event: vscode.TextDocumentChangeEvent): void {
    const changes = event.contentChanges;
    if (changes.length === 0) return;

    const lastChange = changes[0];
    if (lastChange.rangeLength > 0) return;
    if (!lastChange.text || lastChange.text.length > 1) return;

    const insertPos = lastChange.range.start;
    const line = event.document.lineAt(insertPos.line);

    const lineCommentIndex = line.text.indexOf('//');
    if (lineCommentIndex !== -1 && insertPos.character > lineCommentIndex) return;

    const textBefore = line.text.substring(0, insertPos.character);
    const quoteCount = (textBefore.match(/\"/g) || []).length;
    if (quoteCount % 2 === 1) return;

    const startIndex = Math.max(0, insertPos.character - 1);
    const endIndex = insertPos.character + lastChange.text.length;
    const twoChars = line.text.substring(startIndex, endIndex);

    const replacements: { [k: string]: string } = {
        '<-': '←',
        '<=': '≤',
        '>=': '≥',
        '!=': '≠',
        '=/': '≠'
    };

    const replacement = replacements[twoChars];
    if (!replacement) return;

    const rangeToReplace = new vscode.Range(
        insertPos.with({ character: startIndex }),
        insertPos.with({ character: endIndex })
    );

    const edit = new vscode.WorkspaceEdit();
    edit.replace(event.document.uri, rangeToReplace, replacement);
    vscode.workspace.applyEdit(edit);
}
