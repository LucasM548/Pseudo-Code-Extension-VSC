import * as vscode from 'vscode';
import { refreshDiagnostics } from '../diagnostics';
import { Linter } from './types';

class DefaultLinter implements Linter {
    refresh(doc: vscode.TextDocument, collection: vscode.DiagnosticCollection): void {
        refreshDiagnostics(doc, collection);
    }
}

export const linter: Linter = new DefaultLinter();
