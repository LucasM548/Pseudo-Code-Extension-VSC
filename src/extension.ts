import * as vscode from 'vscode';
import { formatDocument } from './formatter';
import { refreshDiagnostics } from './diagnostics';
import { executeCode } from './executor';

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
        refreshDiagnostics(vscode.window.activeTextEditor.document, diagnosticsCollection);
    }
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            refreshDiagnostics(editor.document, diagnosticsCollection);
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
        refreshDiagnostics(event.document, diagnosticsCollection);

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

    // Calculer la plage à remplacer dans le document
    const rangeToReplace = new vscode.Range(
        insertPos.with({ character: startIndex }),
        insertPos.with({ character: endIndex })
    );

    const edit = new vscode.WorkspaceEdit();
    edit.replace(event.document.uri, rangeToReplace, replacement);
    vscode.workspace.applyEdit(edit);
}


export function deactivate() {}