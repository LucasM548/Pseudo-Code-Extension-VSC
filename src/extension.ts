import * as vscode from 'vscode';
import { formatDocument } from './formatter';
import { executeCode } from './services/runner';
import { linter } from './services/linter';
import { handleSymbolReplacement as handleSymbolReplacementImpl } from './autoEdits/symbols';

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

    // --- GESTION DE L'ANALYSE (DIAGNOSTICS) ---
    if (vscode.window.activeTextEditor) {
        linter.refresh(vscode.window.activeTextEditor.document, diagnosticsCollection);
    }
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            linter.refresh(editor.document, diagnosticsCollection);
        }
    }));

    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(doc => {
        diagnosticsCollection.delete(doc.uri);
    }));

    // --- GESTION DE LA COMMANDE D'EXÉCUTION ---
    const executeCommand = vscode.commands.registerCommand('psc.execute', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'psc') {
            executeCode(editor.document);
        } else {
            vscode.window.showErrorMessage('Aucun fichier Pseudo-Code actif à exécuter.');
        }
    });
    context.subscriptions.push(executeCommand);

    // --- NOUVELLE PARTIE : LOGIQUE DE REMPLACEMENT AUTOMATIQUE ET DIAGNOSTICS ---
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
        // On s'assure que le document est bien du Pseudo-Code
        if (event.document.languageId !== 'psc') {
            return;
        }

        // On déclenche l'analyse des erreurs à chaque modification
        linter.refresh(event.document, diagnosticsCollection);

        // On exécute la logique de remplacement pour symboles (flèche, ≤, ≥, ≠)
        handleSymbolReplacement(event);
    }));
}

/**
 * Remplacements automatiques optimisés pour symboles :
 *  '<-' -> '←'
 *  '<=' -> '≤'
 *  '>=' -> '≥'
 *  '!=' or '=/' -> '≠'
 *
 * Optimisations et garanties :
 * - Ne se déclenche que pour des insertions simples (pas de suppression ou de collage massif).
 * - Ignore les remplacements quand on est dans un commentaire de ligne (//) ou dans une chaîne entre guillemets.
 */
function handleSymbolReplacement(event: vscode.TextDocumentChangeEvent): void {
    handleSymbolReplacementImpl(event);
}

export function deactivate() { }