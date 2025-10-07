import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';

/**
 * Analyse le code pseudo-code pour extraire les types de toutes les variables déclarées.
 * @param pscCode Le code source en Pseudo-Code.
 * @returns Un objet associant les noms de variables à leur type.
 */
function collectVariableTypes(pscCode: string): { [key: string]: string } {
    const variableTypes: { [key: string]: string } = {};
    const lines = pscCode.split('\n');

    for (const line of lines) {
        const trimmedLine = line.trim();
        const declarationMatch = trimmedLine.match(/^([\p{L}0-9_,\s]+?)\s*:\s*(entier|réel|booléen|booleen|chaîne|chaine|caractère|caractere|tableau)/iu);
        if (declarationMatch && !/^\s*Fonction/i.test(trimmedLine)) {
            const rawType = declarationMatch[2].toLowerCase();
            const type = normalizeType(rawType);
            const varNames = declarationMatch[1].split(',').map(v => v.trim());
            varNames.forEach(v => {
                if (v) variableTypes[v] = type;
            });
        }
        const funcMatch = trimmedLine.match(/^\s*Fonction\s+[\p{L}0-9_]+\s*\(([^)]*)\)/iu);
        if (funcMatch) {
            const params = funcMatch[1].split(',');
            params.forEach(p => {
                const parts = p.split(':').map(part => part.trim());
                if (parts.length === 2) {
                    const varName = parts[0].replace(/\bInOut\b/i, '').trim();
                    const rawTypeName = parts[1].toLowerCase().replace(/\b(tableau|entier|réel|booléen|booleen|chaîne|chaine|caractère|caractere).*/, '$1');
                    const typeName = normalizeType(rawTypeName);
                    if (varName) variableTypes[varName] = typeName;
                }
            });
        }
    }
    return variableTypes;
}

/**
 * Normalise un nom de type (variantes sans accent, différentes orthographes) en forme canonique.
 */
function normalizeType(raw: string): string {
    const t = (raw || '').toLowerCase();
    if (/^booléen$/.test(t)) return 'booléen';
    if (/^re[ée]l$/.test(t)) return 'réel';
    if (/^entier$/.test(t)) return 'entier';
    if (/^cha(iî)ne$/.test(t)) return 'chaîne';
    if (/^caract[eè]re$/.test(t)) return 'caractère';
    if (/^tableau$/.test(t)) return 'tableau';
    return t;
}

/**
 * Transpile le code Pseudo-Code en code Lua exécutable.
 * @param pscCode Le code source en Pseudo-Code.
 * @returns Le code Lua transpilé.
 */
function transpileToLua(pscCode: string): string {
    const variableTypes = collectVariableTypes(pscCode);
    console.log("Types de variables détectés :", variableTypes);

    let cleanedCode = pscCode.replace(/\/\*[\s\S]*?\*\//g, '').replace(/Lexique\s*:?[\s\S]*/i, '');
    let luaCode = '';
    const lines = cleanedCode.split('\n');
    let isInsideAlgorithmBlock = false;

    for (const line of lines) {
        const originalLineForIndentation = line;
        let textToProcess = line;
        const commentIndex = textToProcess.indexOf('//');
        let commentPart = '';
        if (commentIndex !== -1) {
            commentPart = textToProcess.substring(commentIndex).replace(/^\/\//, '--');
            textToProcess = textToProcess.substring(0, commentIndex);
        }
        let trimmedLine = textToProcess.trim();
        let lineIsFullyProcessed = false;

        if (/^\s*algorithme\b/i.test(trimmedLine)) { isInsideAlgorithmBlock = true; continue; }
        if (isInsideAlgorithmBlock) {
            if (/^\s*Fin\b/i.test(trimmedLine)) isInsideAlgorithmBlock = false;
            continue;
        }
        if (trimmedLine === '' || /^\s*Début\b/i.test(trimmedLine) || /^\s*Lexique\b/i.test(trimmedLine)) continue;
        if (/^\s*(Fin|fsi|fpour|ftq|ftant)\b/i.test(trimmedLine)) {
            trimmedLine = 'end';
            lineIsFullyProcessed = true;
        }
        if (!lineIsFullyProcessed && /^\s*[\p{L}0-9_]+\s*←\s*lire\s*\(\s*\)\s*$/iu.test(trimmedLine)) {
            const varName = trimmedLine.split('←')[0].trim();
            const varType = normalizeType((variableTypes[varName] || '').toLowerCase());
            if (varType === 'entier' || varType === 'réel') {
                trimmedLine = `${varName} = tonumber(io.read())`;
            } else if (varType === 'caractère' || varType === 'caractere') {
                // lire un seul caractère
                trimmedLine = `${varName} = string.sub(io.read(), 1, 1)`;
            } else {
                trimmedLine = `${varName} = io.read()`;
            }
            lineIsFullyProcessed = true;
        }

        if (!lineIsFullyProcessed) {
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
                        const cleanedParams = paramsString.split(',').map(p => p.trim().split(':')[0].replace(/\bInOut\b/i, '').trim()).join(', ');
                        trimmedLine = `function ${funcName}(${cleanedParams})`;
                    }
                } else {
                     trimmedLine = `function ${signaturePart.split(':')[0].trim().replace(/\(\)/g, '')}()`;
                }
            } else if (/^\s*Pour\s/i.test(trimmedLine)) {
                isForLoop = true;
                let step = /\bdécroissant\b/i.test(trimmedLine) ? ', -1' : '';
                trimmedLine = trimmedLine.replace(/\bdécroissant\b/i, '').replace(/^\s*Pour\s+([\p{L}0-9_]+)\s+(?:allant de|de)\s+(.+)\s+(?:a|à)\s+(.+)\s+Faire\s*:?/iu, `for $1 = $2, $3${step} do`);
            } else if (/^\s*Tant que\b/i.test(trimmedLine)) {
                trimmedLine = trimmedLine.replace(/^\s*Tant que\b/i, 'while').replace(/\s+Faire\s*:?/i, ' do');
            } else if (/^\s*Si\b/i.test(trimmedLine)) {
                trimmedLine = trimmedLine.replace(/^\s*Si\b/i, 'if').replace(/\s+(Alors|Faire)\s*:?/i, ' then');
            } else if (/^\s*Sinon\s+si\b/i.test(trimmedLine)) {
                trimmedLine = trimmedLine.replace(/^\s*Sinon\s+si\b/i, 'elseif').replace(/\s+(Alors|Faire)\s*:?/i, ' then');
            } else if (/^\s*Sinon\b/i.test(trimmedLine)) {
                trimmedLine = trimmedLine.replace(/^\s*Sinon\b\s*:?/i, 'else');
            }

            trimmedLine = trimmedLine
                .replace(/longueur\s*\(([^)]+)\)/gi, '#$1')
                .replace(/concat\s*\(([^,]+)\s*,\s*([^)]+)\)/gi, '$1 .. $2')
                .replace(/sousChaîne\s*\(([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\)/gi, 'string.sub($1, 2, ($2) + ($3) - 1)')
                .replace(/ième\s*\(([^,]+)\s*,\s*([^)]+)\)/gi, 'string.sub($1, $2, $2)');

            trimmedLine = trimmedLine
                .replace(/\bretourne(?:r)?\s*\((.*)\)/gi, 'return $1').replace(/\bretourne(?:r)?\b/gi, 'return')
                .replace(/\bvrai\b/gi, 'true').replace(/\bfaux\b/gi, 'false')
                .replace(/\bnon\b/gi, 'not').replace(/\bou\b/gi, 'or').replace(/\bet\b/gi, 'and')
                .replace(/\bmod\b/gi, '%').replace(/≠/g, '~=').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/÷/g, '//');
            
            if (!isForLoop) {
                trimmedLine = trimmedLine.replace(/(?<![<>~=])=(?!=)/g, '==');
            }
            
            trimmedLine = trimmedLine
                .replace(/\s*←\s*/g, ' = ')
                .replace(/écrire\s*\((.*)\)/gi, '__psc_print($1)')
                .replace(/lire\s*\(\)/gi, 'io.read()');

            // --- CORRECTION MAJEURE : Nouvelle logique de remplacement des tableaux ---

            // ÉTAPE 1 : Gérer les littéraux de tableaux (ex: [1,2,3] -> {1,2,3})
            // La regex (?<![\p{L}0-9_])\[ s'assure qu'on ne remplace pas les crochets d'accès comme dans `tab[i]`
            trimmedLine = trimmedLine.replace(/(?<![\p{L}0-9_])\[([^\]]*)\]/gu, '{$1}');

            // ÉTAPE 2 : Gérer les accès aux tableaux (ex: tab[i], tab[i,j])
            trimmedLine = trimmedLine.replace(/([\p{L}0-9_]+)\[([^\]]+)\]/gu, (match, varName, indicesString) => {
                const indices = indicesString.split(',');
                const transformedIndices = indices.map((index: string) => `(${(index || '').trim()}) + 1`);
                return `${varName}[${transformedIndices.join('][')}]`;
            });
        }

        const indentation = originalLineForIndentation.match(/^\s*/)?.[0] || '';
        const finalComment = commentPart ? ' ' + commentPart.trim() : '';
        luaCode += indentation + trimmedLine + finalComment + '\n';
    }

    // Préfixe : helpers Lua pour sérialiser les tableaux et imprimer proprement
    const helpers = `local function __psc_is_array(t)
    if type(t) ~= 'table' then return false end
    local i = 0
    for _ in pairs(t) do
        i = i + 1
    end
    local count = 0
    for k in pairs(t) do
        if type(k) == 'number' then count = count + 1 end
    end
    return count == i
end

local function __psc_serialize(v)
    if type(v) == 'table' then
        if __psc_is_array(v) then
            local parts = {}
            for i = 1, #v do
                parts[#parts+1] = __psc_serialize(v[i])
            end
            return '[' .. table.concat(parts, ', ') .. ']'
        else
            local parts = {}
            for k, val in pairs(v) do
                parts[#parts+1] = tostring(k) .. ':' .. __psc_serialize(val)
            end
            return '{' .. table.concat(parts, ', ') .. '}'
        end
    elseif type(v) == 'string' then
        return '"' .. v .. '"'
    else
        return tostring(v)
    end
end

local function __psc_print(...)
    local args = {...}
    local parts = {}
    for i = 1, #args do
        parts[#parts+1] = __psc_serialize(args[i])
    end
    print(table.concat(parts, '\t'))
end
`;

    return helpers + luaCode;
}

export function executeCode(document: vscode.TextDocument) {
    const pscCode = document.getText();
    const luaCode = transpileToLua(pscCode);
    
    console.log("--- Code Lua généré ---\n", luaCode, "\n--------------------------");

    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `psc_temp_${Date.now()}.lua`);
    fs.writeFileSync(tempFilePath, luaCode);

    vscode.window.showInformationMessage(`Fichier Lua temporaire généré : ${tempFilePath}`);

    const terminal = vscode.window.createTerminal("Pseudo-Code Execution");
    terminal.show();
    
    const command = `lua "${tempFilePath}"`;
    terminal.sendText(command);
}