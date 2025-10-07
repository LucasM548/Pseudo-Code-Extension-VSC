import * as vscode from 'vscode';

export function formatDocument(document: vscode.TextDocument): vscode.TextEdit[] {
    const edits: vscode.TextEdit[] = [];
    let indentationLevel = 0;
    const tabChar = '\t';

    // Expressions régulières pour chaque type d'instruction
    // 'Sinon' doit être traité comme mot-clé de fermeture (aligné avec Si)
    const openingPattern = /^\s*(Début|.*(Alors|Faire)\s*:)\s*$/i;
    const closingPattern = /^\s*(Fin|fsi|fpour|ftq|ftant|Sinon(?:\s*:)? )\s*$/i;

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

        // RÈGLE 1 : Si la ligne est un mot-clé de fermeture (Fin, fsi...) ou 'Sinon',
        // on doit DIMINUER le niveau d'indentation AVANT de l'écrire.
        const isSinon = /^Sinon(?:\s*:)?$/i.test(trimmedText);
        if ((closingPattern.test(trimmedText) || isSinon) && indentationLevel > 0) {
            indentationLevel--;
        }

        // On applique l'indentation calculée à la ligne actuelle
        const newText = tabChar.repeat(indentationLevel) + trimmedText;
        if (newText !== originalText) {
            edits.push(vscode.TextEdit.replace(line.range, newText));
        }

        // RÈGLE 2 : Si la ligne est un mot-clé d'ouverture (Début, Faire:, Alors:),
        // on doit AUGMENTER le niveau d'indentation pour les lignes SUIVANTES.
        // 'Sinon' crée également un bloc pour les lignes suivantes : on incrémente après l'écriture.
        if (openingPattern.test(trimmedText) || isSinon) {
            indentationLevel++;
        }
    }

    return edits;
}