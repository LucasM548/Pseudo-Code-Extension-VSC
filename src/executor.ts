import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';

/**
 * Transpile le code Pseudo-Code en code Lua exécutable.
 * VERSION CORRIGÉE : Utilise une boucle de remplacement itérative améliorée
 * pour gérer correctement les appels de fonctions imbriquées, corrige l'indexation
 * des tableaux et améliore la traduction des mots-clés.
 * @param pscCode Le code source en Pseudo-Code.
 * @returns Le code Lua transpilé.
 */
function transpileToLua(pscCode: string): string {
    let cleanedCode = pscCode
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/Lexique\s*:?[\s\S]*/i, '');

    let luaCode = '';
    const lines = cleanedCode.split('\n');
    
    let isInsideAlgorithmBlock = false;

    for (const line of lines) {
        let trimmedLine = line.trim();

        if (/^\s*algorithme\b/i.test(trimmedLine)) {
            isInsideAlgorithmBlock = true;
            continue;
        }
        if (isInsideAlgorithmBlock) {
            if (/^\s*Fin\b/i.test(trimmedLine)) {
                isInsideAlgorithmBlock = false;
            }
            continue;
        }

        if (trimmedLine === '' || /^\s*Début\b/i.test(trimmedLine)) {
            continue;
        }
        if (/^\s*\/\//.test(trimmedLine)) {
            luaCode += line.replace(/^\s*\/\//, '--') + '\n';
            continue;
        }
        if (/^\s*(Fin|fsi|fpour|ftq|ftant)\b/i.test(trimmedLine)) {
            luaCode += line.replace(/^\s*\S+/, 'end') + '\n';
            continue;
        }
        
        let isForLoop = false;
        
        trimmedLine = trimmedLine.replace(/[“”]/g, '"');

        if (/^\s*fonction\s/i.test(trimmedLine)) {
            const signaturePart = trimmedLine.substring(trimmedLine.toLowerCase().indexOf('fonction ') + 'fonction '.length);
            const openParenIndex = signaturePart.indexOf('(');
            let closeParenIndex = -1;
            if (openParenIndex !== -1) {
                let balance = 1;
                for (let i = openParenIndex + 1; i < signaturePart.length; i++) {
                    if (signaturePart[i] === '(') balance++;
                    if (signaturePart[i] === ')') balance--;
                    if (balance === 0) { closeParenIndex = i; break; }
                }
            }
            if (openParenIndex !== -1 && closeParenIndex !== -1) {
                const funcName = signaturePart.substring(0, openParenIndex).trim();
                const paramsString = signaturePart.substring(openParenIndex + 1, closeParenIndex);
                if (paramsString.trim() === '') {
                    trimmedLine = `function ${funcName}()`;
                } else {
                    const cleanedParams = paramsString.split(',').map((p) => p.trim().split(/\s*:/)[0].replace(/\bInOut\b/i, '').trim());
                    trimmedLine = `function ${funcName}(${cleanedParams.join(', ')})`;
                }
            } else {
                 trimmedLine = `function ${signaturePart.split(':')[0].trim().replace(/\(\)/g, '')}()`;
            }
        }
        // CORRECTION N°1 : Rendre la regex de la boucle Pour plus flexible
        else if (/^\s*Pour\s/i.test(trimmedLine)) {
            isForLoop = true;
            let step = '';
            if (/\bdécroissant\b/i.test(trimmedLine)) {
                step = ', -1';
                trimmedLine = trimmedLine.replace(/\bdécroissant\b/i, '');
            }
            // Gère "de...à", "allant de...a", etc.
            trimmedLine = trimmedLine.replace(
                /^\s*Pour\s+([a-zA-Z0-9_]+)\s+(?:allant de|de)\s+(.+)\s+(?:a|à)\s+(.+)\s+Faire\s*:?/i,
                `for $1 = $2, $3${step} do`
            );
        }
        else if (/^\s*Tant que\b/i.test(trimmedLine)) {
            trimmedLine = trimmedLine.replace(/^\s*Tant que\b/i, 'while').replace(/\s+Faire\s*:?/i, ' do');
        }
        else if (/^\s*Si\b/i.test(trimmedLine)) {
            trimmedLine = trimmedLine.replace(/^\s*Si\b/i, 'if').replace(/\s+(Alors|Faire)\s*:?/i, ' then');
        }
        else if (/^\s*Sinon\s+si\b/i.test(trimmedLine)) {
             trimmedLine = trimmedLine.replace(/^\s*Sinon\s+si\b/i, 'elseif').replace(/\s+(Alors|Faire)\s*:?/i, ' then');
        }
        else if (/^\s*Sinon\b/i.test(trimmedLine)) {
            trimmedLine = trimmedLine.replace(/^\s*Sinon\b\s*:?/i, 'else');
        }
        
        let previousLine;
        do {
            previousLine = trimmedLine;
            trimmedLine = trimmedLine
                // CORRECTION N°2 : La longueur en Lua est #variable, SANS parenthèses. C'est le point crucial.
                .replace(/longueur\s*\(([^)]+)\)/gi, '#$1')
                .replace(/concat\s*\(([^,]+)\s*,\s*([^)]+)\)/gi, '$1 .. $2')
                .replace(/sousChaîne\s*\(([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\)/gi, 'string.sub($1, $2, ($2) + ($3) - 1)')
                .replace(/ième\s*\(([^,]+)\s*,\s*([^)]+)\)/gi, 'string.sub($1, $2, $2)');
        } while (previousLine !== trimmedLine);

        // CORRECTION N°3 : Gérer toutes les variantes de "retourner" et supprimer les parenthèses
        trimmedLine = trimmedLine
            .replace(/\bretourne(?:r)?\s*\((.*)\)/gi, 'return $1')
            .replace(/\bretourne(?:r)?\b/gi, 'return')
            .replace(/\bvrai\b/gi, 'true').replace(/\bfaux\b/gi, 'false')
            .replace(/\bnon\b/gi, 'not').replace(/\bou\b/gi, 'or')
            .replace(/\bet\b/gi, 'and').replace(/\bmod\b/gi, '%')
            .replace(/≠/g, '~=').replace(/≤/g, '<=').replace(/≥/g, '>=')
            .replace(/÷/g, '//');
        
        // CORRECTION N°4 : Inverser l'ordre pour éviter la double substitution.
        if (!isForLoop) {
            trimmedLine = trimmedLine.replace(/(?<![<>~=])=(?!=)/g, '==');
        }
        trimmedLine = trimmedLine.replace(/\s*←\s*/g, ' = ');
        
        trimmedLine = trimmedLine
            .replace(/écrire\s*\((.*)\)/gi, 'print($1)')
            .replace(/lire\s*\(\)/gi, 'io.read()')
            .replace(/\[\s*\]/g, '{}')
            .replace(/(\w+)\[([^,\]]+)\s*,\s*([^\]]+)\]/g, '$1[$2][$3]')
            .replace(/(\w+)\[([^\]]+)\]/g, '$1[$2]');

        const indentation = line.match(/^\s*/)?.[0] || '';
        luaCode += indentation + trimmedLine + '\n';
    }

    return luaCode;
}

// La fonction executeCode reste inchangée, elle utilise maintenant la nouvelle logique de transpilation.
export function executeCode(document: vscode.TextDocument) {
    const pscCode = document.getText();
    const luaCode = transpileToLua(pscCode);
    
    // Pour le débogage, il est utile d'afficher le code généré dans la console de VS Code
    console.log("--- Code Lua généré ---\n", luaCode, "\n--------------------------");

    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `psc_temp_${Date.now()}.lua`);
    fs.writeFileSync(tempFilePath, luaCode);

    vscode.window.showInformationMessage(`Fichier Lua temporaire généré : ${tempFilePath}`);

    const terminal = vscode.window.createTerminal("Pseudo-Code Execution");
    terminal.show();
    
    // Assurez-vous que la commande 'lua' est accessible dans le PATH de votre système
    const command = `lua "${tempFilePath}"`;
    terminal.sendText(command);
}