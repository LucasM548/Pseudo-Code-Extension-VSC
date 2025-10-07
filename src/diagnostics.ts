import * as vscode from 'vscode';

/**
 * Cœur du Linter avec gestion de la portée lexicale et déclaration implicite.
 */
export function refreshDiagnostics(doc: vscode.TextDocument, collection: vscode.DiagnosticCollection): void {
    if (doc.languageId !== 'psc') {
        return;
    }

    const diagnostics: vscode.Diagnostic[] = [];
    const scopeStack: Set<string>[] = [new Set()];
    const declaredFunctions = collectFunctionNames(doc);
    let inBlockComment = false;

    for (let lineIndex = 0; lineIndex < doc.lineCount; lineIndex++) {
        const line = doc.lineAt(lineIndex);
        const nonCommentText = cleanLineFromComments(line.text, inBlockComment);
        const trimmedText = nonCommentText.text.trim();
        inBlockComment = nonCommentText.inBlockComment;

        if (trimmedText === '') continue;

        const isOpeningBlock = /^\s*(Si|Tant que|Début)(?![\p{L}0-9_])/iu.test(trimmedText);
        const funcMatch = /^\s*Fonction\s+([\p{L}_][\p{L}0-9_]*)\s*\((.*)\)/iu.exec(trimmedText);
        const pourMatch = /^\s*Pour\s+([\p{L}_][\p{L}0-9_]*)/iu.exec(trimmedText);

        if (isOpeningBlock || funcMatch || pourMatch) {
            const newScope = new Set<string>();
            if (funcMatch) {
                let paramsString = funcMatch[2];
                const lastParen = paramsString.lastIndexOf(')');
                const returnColon = paramsString.lastIndexOf(':');

                if (returnColon > lastParen) {
                    paramsString = paramsString.substring(0, returnColon).trim();
                }

                const params = paramsString.split(/,(?![^(\[]*[)\]])/g).map(p => p.trim().split(':')[0].replace(/\bInOut\b/i, '').trim());
                params.forEach(p => { if (p) newScope.add(p); });
            }
            if (pourMatch) {
                newScope.add(pourMatch[1]);
            }
            scopeStack.push(newScope);
        }

    const declarationMatch = trimmedText.match(/^([\p{L}0-9_,\s]+?)\s*:\s*([\p{L}0-9_éèêàùçîï]+?)/iu);
        const assignmentIndex = trimmedText.indexOf('←');

        if (declarationMatch && !/^\s*Fonction/i.test(trimmedText)) {
            const varNames = declarationMatch[1].split(',').map(v => v.trim());
            const currentScope = scopeStack[scopeStack.length - 1];
            varNames.forEach(v => { if (v) currentScope.add(v); });
        } else if (assignmentIndex !== -1) {
            const lhsText = trimmedText.substring(0, assignmentIndex).trim();
            const rhsText = trimmedText.substring(assignmentIndex + 1).trim();
            checkVariablesInExpression(rhsText, scopeStack, declaredFunctions, line, diagnostics);
            const lhsVarMatch = lhsText.match(/^([\p{L}_][\p{L}0-9_]*)/u);
            if (lhsVarMatch) {
                const lhsVar = lhsVarMatch[1];
                scopeStack[scopeStack.length - 1].add(lhsVar);
            }
            const lhsIndexVars = lhsText.substring(lhsVarMatch ? lhsVarMatch[0].length : 0);
            checkVariablesInExpression(lhsIndexVars, scopeStack, declaredFunctions, line, diagnostics);
        } else {
            checkVariablesInExpression(trimmedText, scopeStack, declaredFunctions, line, diagnostics);
        }

        const isClosingBlock = /^\s*(fpour|fsi|ftq|Fin)(?![\p{L}0-9_])/iu.test(trimmedText);
        if (isClosingBlock && scopeStack.length > 1) {
            scopeStack.pop();
        }
    }

    collection.set(doc.uri, diagnostics);
}

/**
 * Vérifie tous les identifiants dans une expression donnée (partie de ligne).
 * Crée des diagnostics à la position exacte si un identifiant n'est pas déclaré.
 */
function checkVariablesInExpression(
    expression: string,
    scopeStack: Set<string>[],
    declaredFunctions: Set<string>,
    line: vscode.TextLine,
    diagnostics: vscode.Diagnostic[]
): void {
    // On ne vérifie que le texte qui n'est pas dans des commentaires ou des chaînes
    const textToCheck = expression.replace(/"[^"]*"/g, match => ' '.repeat(match.length));
    const regex = /(?<![\p{L}0-9_])[\p{L}_][\p{L}0-9_]*(?![\p{L}0-9_])/gu;

    // Calculer le décalage entre le texte original de la ligne et l'expression analysée
    const expressionOffsetInLine = line.text.indexOf(expression);
    if (expressionOffsetInLine === -1) return; // Sécurité si l'expression n'est pas trouvée

    let match;
    while ((match = regex.exec(textToCheck)) !== null) {
        const variable = match[0];
        const indexInExpression = match.index;

        if (isKnownIdentifier(variable) || declaredFunctions.has(variable) || /^\d+(\.\d+)?$/.test(variable)) {
            continue;
        }

        let isDeclared = false;
        for (let i = scopeStack.length - 1; i >= 0; i--) {
            if (scopeStack[i].has(variable)) {
                isDeclared = true;
                break;
            }
        }

        if (!isDeclared) {
            // Calculer la position finale et précise de l'erreur
            const finalColumn = expressionOffsetInLine + indexInExpression;
            const range = new vscode.Range(line.lineNumber, finalColumn, line.lineNumber, finalColumn + variable.length);
            diagnostics.push(new vscode.Diagnostic(range, `L'identifiant '${variable}' est utilisé avant d'avoir reçu une valeur.`, vscode.DiagnosticSeverity.Error));
        }
    }
}

function cleanLineFromComments(lineText: string, initialInBlockComment: boolean): { text: string; inBlockComment: boolean; } {
    let nonCommentText = '';
    let currentIndex = 0;
    let inBlockComment = initialInBlockComment;
    if (inBlockComment) {
        const endCommentIndex = lineText.indexOf('*/');
        if (endCommentIndex !== -1) {
            inBlockComment = false;
            currentIndex = endCommentIndex + 2;
        } else { return { text: '', inBlockComment: true }; }
    }
    while (currentIndex < lineText.length) {
        const startBlockIndex = lineText.indexOf('/*', currentIndex);
        const startLineIndex = lineText.indexOf('//', currentIndex);
        if (startBlockIndex !== -1 && (startLineIndex === -1 || startBlockIndex < startLineIndex)) {
            nonCommentText += lineText.substring(currentIndex, startBlockIndex);
            const endBlockIndex = lineText.indexOf('*/', startBlockIndex + 2);
            if (endBlockIndex !== -1) {
                currentIndex = endBlockIndex + 2;
            } else {
                inBlockComment = true;
                break;
            }
        } else if (startLineIndex !== -1) {
            nonCommentText += lineText.substring(currentIndex, startLineIndex);
            break;
        } else {
            nonCommentText += lineText.substring(currentIndex);
            break;
        }
    }
    return { text: nonCommentText, inBlockComment: inBlockComment };
}

function collectFunctionNames(doc: vscode.TextDocument): Set<string> {
    const functions = new Set<string>();
    for (let i = 0; i < doc.lineCount; i++) {
        const line = doc.lineAt(i).text;
        const funcMatch = /^\s*Fonction\s+([\p{L}_][\p{L}0-9_]*)/iu.exec(line);
        if (funcMatch) {
            functions.add(funcMatch[1]);
        }
    }
    return functions;
}

const KNOWN_IDENTIFIERS = new Set([
    'si', 'alors', 'sinon', 'fsi', 'pour', 'de', 'à', 'faire', 'fpour', 'tant', 'que', 'ftq',
    'début', 'fin', 'algorithme', 'fonction', 'lexique', 'inout', 'décroissant', 'vrai', 'faux',
    'et', 'ou', 'non', 'mod', 'écrire', 'lire', 'retourner', 'retourne', 'longueur', 'concat',
    'souschaîne', 'ième', 'entier', 'réel', 'booléen', 'booleen', 'chaîne', 'chaine', 'caractère', 'caractere', 'tableau'
]);

function isKnownIdentifier(word: string): boolean {
    return KNOWN_IDENTIFIERS.has(word.toLowerCase());
}