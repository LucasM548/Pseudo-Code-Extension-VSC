import * as vscode from 'vscode';

export interface Linter {
    refresh(doc: vscode.TextDocument, collection: vscode.DiagnosticCollection): void;
}

export interface Transpiler {
    transpile(code: string): string;
}
