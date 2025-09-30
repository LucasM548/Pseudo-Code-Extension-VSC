import * as vscode from 'vscode';

export function formatDocument(document: vscode.TextDocument): vscode.TextEdit[] {
    const edits: vscode.TextEdit[] = [];
    let indentationLevel = 0;
    const tabChar = '\t'; // ou '    ' si vous préférez les espaces

    // Expressions régulières pour chaque type d'instruction
    const openingPattern = /^\s*(Début|Sinon|.*(Alors|Faire)\s*:)\s*$/i;
    const closingPattern = /^\s*(Fin|fsi|fpour|ftq|ftant|Sinon)\s*$/i;

    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        const originalText = line.text;
        const trimmedText = originalText.trim();

        // On ignore les lignes vides
        if (trimmedText === '') {
            if (!line.isEmptyOrWhitespace) {
                 edits.push(vscode.TextEdit.delete(line.range));
            }
            continue;
        }

        // --- NOUVELLE LOGIQUE D'INDENTATION ---

        // RÈGLE 1 : Si la ligne est un mot-clé de fermeture (Fin, fsi, Sinon...),
        // on doit DIMINUER le niveau d'indentation AVANT de l'écrire.
        if (closingPattern.test(trimmedText) && indentationLevel > 0) {
            indentationLevel--;
        }

        // On applique l'indentation calculée à la ligne actuelle
        const newText = tabChar.repeat(indentationLevel) + trimmedText;
        if (newText !== originalText) {
            edits.push(vscode.TextEdit.replace(line.range, newText));
        }

        // RÈGLE 2 : Si la ligne est un mot-clé d'ouverture (Début, Faire:, Alors:),
        // on doit AUGMENTER le niveau d'indentation pour les lignes SUIVANTES.
        if (openingPattern.test(trimmedText)) {
            indentationLevel++;
        }
    }

    return edits;
}