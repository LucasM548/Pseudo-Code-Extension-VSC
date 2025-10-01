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

        // On exécute la logique de remplacement pour la flèche
        handleArrowReplacement(event);
    }));
}

/**
 * Gère le remplacement automatique de "<--" par "←".
 */
function handleArrowReplacement(event: vscode.TextDocumentChangeEvent): void {
    const changes = event.contentChanges;
    if (changes.length === 0) {
        return;
    }

    const lastChange = changes[0];

    // On ne s'active que si l'utilisateur a ajouté du texte (pas s'il en a supprimé)
    // et que le texte ajouté est le tiret final de la séquence "<--"
    if (lastChange.text !== '-' || lastChange.rangeLength > 0) {
        return;
    }

    const currentPosition = lastChange.range.start;
    const line = event.document.lineAt(currentPosition.line);
    
    // On vérifie si les deux caractères précédents sont bien "<" et "-"
    if (currentPosition.character > 1 && line.text.substring(currentPosition.character - 2, currentPosition.character) === '<-') {
        const rangeToReplace = new vscode.Range(
            currentPosition.with({ character: currentPosition.character - 2 }),
            currentPosition.translate(0, 1)
        );

        // On crée la modification et on l'applique
        const edit = new vscode.WorkspaceEdit();
        edit.replace(event.document.uri, rangeToReplace, '←');
        vscode.workspace.applyEdit(edit);
    }
}


export function deactivate() {}