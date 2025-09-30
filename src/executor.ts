import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';

function transpileToLua(pscCode: string): string {
    let cleanedCode = pscCode
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/Lexique\s*:?[\s\S]*/i, '');

    let luaCode = '';
    const lines = cleanedCode.split('\n');

    for (const line of lines) {
        let trimmedLine = line.trim();
        if (trimmedLine === '' || /^\s*!\s*Question/i.test(trimmedLine)) continue;

        if (/^\s*\/\//.test(trimmedLine)) {
            luaCode += line.replace(/^\s*\/\//, '--') + '\n';
            continue;
        }
        
        if (/^\s*Début\b/i.test(trimmedLine)) continue;
        if (/^\s*Fin\b/i.test(trimmedLine)) {
            luaCode += 'end\n';
            continue;
        }

        let isForLoop = false;

        // --- NOUVELLE LOGIQUE ROBUSTE POUR LES FONCTIONS ---
        if (trimmedLine.toLowerCase().startsWith('fonction ')) {
            // 1. Isoler le nom et les parenthèses
            const signature = trimmedLine.substring('fonction '.length);
            const openParenIndex = signature.indexOf('(');
            const closeParenIndex = signature.indexOf(')');

            if (openParenIndex !== -1 && closeParenIndex !== -1) {
                const funcName = signature.substring(0, openParenIndex).trim();
                const paramsString = signature.substring(openParenIndex + 1, closeParenIndex);

                if (paramsString.trim() === '') {
                    trimmedLine = `function ${funcName}()`;
                } else {
                    const paramsArray = paramsString.split(',');
                    const cleanedParams = paramsArray.map((param: string) => param.trim().split(/\s*:/)[0].replace(/\bInOut\b/g, '').trim());
                    trimmedLine = `function ${funcName}(${cleanedParams.join(', ')})`;
                }
            }
        }
        else if (/^\s*Pour\s*.*Faire\s*:?/i.test(trimmedLine)) {
            isForLoop = true;
            let step = '';
            if (/\bdécroissant\b/i.test(trimmedLine)) {
                step = ', -1';
                trimmedLine = trimmedLine.replace(/\bdécroissant\b/i, '');
            }
            trimmedLine = trimmedLine.replace(
                /^\s*Pour\s+([a-zA-Z0-9_]+)\s+de\s+(.+)\s+à\s+(.+)\s+Faire\s*:?/i,
                `for $1 = $2, $3${step} do`
            );
        }
        else if (/^\s*Tant que\b/i.test(trimmedLine)) {
            trimmedLine = trimmedLine.replace(/^\s*Tant que\b/i, 'while').replace(/\bFaire\s*:?/i, 'do');
        }
        else if (/^\s*Si\b/i.test(trimmedLine)) {
            trimmedLine = trimmedLine.replace(/^\s*Si\b/i, 'if').replace(/\b(Alors|Faire)\b\s*:?/i, 'then');
        }
        
        trimmedLine = trimmedLine
            .replace(/\bfsi\b/gi, 'end')
            .replace(/\bfpour\b/gi, 'end')
            .replace(/\bftq\b/gi, 'end')
            .replace(/\bvrai\b/gi, 'true')
            .replace(/\bfaux\b/gi, 'false')
            .replace(/\bnon\b/gi, 'not')
            .replace(/\bou\b/gi, 'or')
            .replace(/\bet\b/gi, 'and')
            .replace(/\bretourner\b/gi, 'return')
            .replace(/≠/g, '~=')
            .replace(/≤/g, '<=')
            .replace(/≥/g, '>=')
            .replace(/÷/g, '//');

        if (!isForLoop) {
            trimmedLine = trimmedLine.replace(/(?<![<>~=])=(?!=)/g, '==');
        }

        trimmedLine = trimmedLine.replace(/\s*←\s*/g, ' = ');
        
        trimmedLine = trimmedLine
            .replace(/\[\s*\]/g, '{}')
            .replace(/lire\s*\(\)/gi, 'tonumber(io.read())')
            .replace(/écrire\s*\((.*)\)/gi, 'print($1)')
            .replace(/(\w+)\[(\w+)\s*,\s*(\w+)\]/g, '$1[$2][$3]')
            .replace(/(\w+)\[0\]/g, '$1[1]');

        const indentation = line.match(/^\s*/)?.[0] || '';
        luaCode += indentation + trimmedLine + '\n';
    }

    return luaCode;
}

// Le reste de la fonction executeCode est inchangé.
export function executeCode(document: vscode.TextDocument) {
    const pscCode = document.getText();
    const luaCode = transpileToLua(pscCode);
    console.log("--- Generated Lua Code ---\n", luaCode, "\n--------------------------");

    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `psc_temp_${Date.now()}.lua`);
    fs.writeFileSync(tempFilePath, luaCode);

    // --- NOUVELLE PARTIE : Afficher le chemin du fichier pour un accès facile ---
    // On notifie l'utilisateur pour qu'il puisse trouver le fichier
    vscode.window.showInformationMessage(`Fichier Lua temporaire généré ici : ${tempFilePath}`);

    const terminal = vscode.window.createTerminal("Pseudo-Code Execution");
    terminal.show();
    
    const command = `lua "${tempFilePath}"`;
    terminal.sendText(command);

    // --- CORRECTION CLÉ ---
    // On commente cette section pour que le fichier ne soit plus supprimé
    /*
    setTimeout(() => {
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
    }, 5000);
    */
}