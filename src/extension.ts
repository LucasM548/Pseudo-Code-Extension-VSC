import * as vscode from 'vscode';
import { formatDocument } from './formatter';
import { refreshDiagnostics } from './diagnostics'; // On importe notre nouvelle logique

// Une "collection de diagnostics" est le conteneur de VS Code pour toutes nos erreurs
const diagnosticsCollection = vscode.languages.createDiagnosticCollection('psc');

export function activate(context: vscode.ExtensionContext) {
    console.log('PSC Language Support is now active!');

    // --- On garde le code du formateur ---
    const formattingProvider = vscode.languages.registerDocumentFormattingEditProvider('psc', {
        provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
            return formatDocument(document);
        }
    });
    context.subscriptions.push(formattingProvider);

    // --- NOUVELLE PARTIE : DÉCLENCHER L'ANALYSE ---

    // Analyser le document dès son ouverture
    if (vscode.window.activeTextEditor) {
        refreshDiagnostics(vscode.window.activeTextEditor.document, diagnosticsCollection);
    }
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            refreshDiagnostics(editor.document, diagnosticsCollection);
        }
    }));

    // Analyser le document à chaque modification
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
        refreshDiagnostics(event.document, diagnosticsCollection);
    }));

    // Nettoyer les diagnostics quand un fichier est fermé
    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(doc => {
        diagnosticsCollection.delete(doc.uri);
    }));
}

export function deactivate() {}