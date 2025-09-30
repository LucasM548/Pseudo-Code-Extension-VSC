import * as vscode from 'vscode';
import { formatDocument } from './formatter';

export function activate(context: vscode.ExtensionContext) {

    console.log('PSC Formatter is now active!');

    // Enregistre notre fournisseur de formatage pour le langage 'psc'
    const formattingProvider = vscode.languages.registerDocumentFormattingEditProvider('psc', {
        provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
            return formatDocument(document);
        }
    });

    context.subscriptions.push(formattingProvider);
}

export function deactivate() {}