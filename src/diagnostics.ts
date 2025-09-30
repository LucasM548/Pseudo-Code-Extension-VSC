import * as vscode from 'vscode';

// Cette fonction est le cœur de notre Linter
export function refreshDiagnostics(doc: vscode.TextDocument, collection: vscode.DiagnosticCollection): void {
    if (doc.languageId !== 'psc') {
        return; // On n'analyse que les fichiers .psc
    }

    const diagnostics: vscode.Diagnostic[] = [];
    const blockStack: { keyword: string; line: number; range: vscode.Range }[] = [];

    // On définit les paires de mots-clés
    const blockPairs: { [key: string]: string } = {
        'Début': 'Fin',
        'Pour': 'fpour',
        'Si': 'fsi',
        'Tant que': 'ftq'
    };
    
    const openingKeywords = Object.keys(blockPairs);
    const closingKeywords = Object.values(blockPairs);

    for (let lineIndex = 0; lineIndex < doc.lineCount; lineIndex++) {
        const line = doc.lineAt(lineIndex);
        const text = line.text;

        // On cherche un mot-clé d'ouverture
        const openingMatch = openingKeywords.find(kw => new RegExp(`\\b${kw}\\b`, 'i').test(text));
        if (openingMatch) {
            blockStack.push({ keyword: openingMatch, line: lineIndex, range: line.range });
        }

        // On cherche un mot-clé de fermeture
        const closingMatch = closingKeywords.find(kw => new RegExp(`\\b${kw}\\b`, 'i').test(text));
        if (closingMatch) {
            const lastOpener = blockStack.pop();
            if (!lastOpener) {
                // Il y a un mot-clé de fermeture en trop
                const diagnostic = new vscode.Diagnostic(
                    line.range,
                    `Mot-clé de fermeture '${closingMatch}' inattendu sans son ouverture.`,
                    vscode.DiagnosticSeverity.Error
                );
                diagnostics.push(diagnostic);
            } else {
                // On vérifie que la paire est correcte
                const expectedCloser = blockPairs[lastOpener.keyword];
                if (closingMatch.toLowerCase() !== expectedCloser.toLowerCase()) {
                    // Erreur de paire (ex: Pour ... fsi)
                    let diagnostic = new vscode.Diagnostic(
                        line.range,
                        `Mot-clé de fermeture incorrect. Attendu : '${expectedCloser}', trouvé : '${closingMatch}'.`,
                        vscode.DiagnosticSeverity.Error
                    );
                    diagnostics.push(diagnostic);
                    // On peut aussi souligner le mot-clé d'ouverture correspondant
                    diagnostic = new vscode.Diagnostic(
                        lastOpener.range,
                        `Ce bloc '${lastOpener.keyword}' n'est pas correctement fermé.`,
                        vscode.DiagnosticSeverity.Error
                    );
                    diagnostics.push(diagnostic);
                }
            }
        }
    }

    // À la fin, si la pile n'est pas vide, il reste des blocs non fermés
    blockStack.forEach(unclosedBlock => {
        const diagnostic = new vscode.Diagnostic(
            unclosedBlock.range,
            `Le bloc '${unclosedBlock.keyword}' n'est pas fermé. Attendu : '${blockPairs[unclosedBlock.keyword]}'.`,
            vscode.DiagnosticSeverity.Error
        );
        diagnostics.push(diagnostic);
    });

    // On met à jour la collection avec les erreurs trouvées
    collection.set(doc.uri, diagnostics);
}