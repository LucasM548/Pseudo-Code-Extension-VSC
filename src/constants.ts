/**
 * Configuration centralisée pour l'extension Pseudo-Code
 * Tous les patterns regex et mots-clés sont définis ici pour éviter la duplication
 */

// Mots-clés du langage
export const KEYWORDS = {
    CONTROL: ['si', 'alors', 'sinon', 'fsi', 'tant', 'que', 'ftq', 'pour', 'de', 'à', 'faire', 'fpour', 'décroissant'],
    BLOCKS: ['début', 'fin', 'algorithme', 'fonction'],
    TYPES: ['entier', 'réel', 'booléen', 'booleen', 'chaîne', 'chaine', 'caractère', 'caractere', 'tableau'],
    BOOLEAN: ['vrai', 'faux'],
    OPERATORS: ['et', 'ou', 'non', 'mod'],
    IO: ['écrire', 'lire', 'retourner', 'retourne'],
    STRING_OPS: ['longueur', 'concat', 'souschaîne', 'ième'],
    FILE_OPS: ['fichierouvrir', 'fichierfermer', 'fichierlire', 'fichierfin', 'chaineversentier', 'fichiercreer', 'fichierecrire'],
    MODIFIERS: ['inout']
} as const;

// Tous les identifiants connus (pour le linter)
export const KNOWN_IDENTIFIERS = new Set([
    ...KEYWORDS.CONTROL,
    ...KEYWORDS.BLOCKS,
    ...KEYWORDS.TYPES,
    ...KEYWORDS.BOOLEAN,
    ...KEYWORDS.OPERATORS,
    ...KEYWORDS.IO,
    ...KEYWORDS.STRING_OPS,
    ...KEYWORDS.FILE_OPS,
    ...KEYWORDS.MODIFIERS,
    'lexique', 'fin_ligne'
]);

// Patterns regex réutilisables
export const PATTERNS = {
    // Identifiants
    IDENTIFIER: /[\p{L}_][\p{L}0-9_]*/u,
    IDENTIFIER_GLOBAL: /[\p{L}_][\p{L}0-9_]*/gu,
    WORD_BOUNDARY_IDENTIFIER: /(?<![\p{L}0-9_])[\p{L}_][\p{L}0-9_]*(?![\p{L}0-9_])/gu,

    // Fonction
    FUNCTION_DECLARATION: /^\s*Fonction\s+([\p{L}_][\p{L}0-9_]*)\s*\((.*)\)/iu,
    FUNCTION_CALL: /([\p{L}_][\p{L}0-9_]+)\s*\(([^)]*)\)/gu,

    // Variables
    VARIABLE_DECLARATION: /^([\p{L}0-9_,\s]+?)\s*:\s*([\p{L}0-9_]+)/iu,
    ASSIGNMENT: /←/,
    READ_ASSIGNMENT: /^\s*[\p{L}0-9_]+\s*←\s*lire\s*\(\s*\)\s*$/iu,

    // Types composites
    COMPOSITE_TYPE: /^([\p{L}_][\p{L}0-9_]*)\s*=\s*<\s*(.+?)\s*>$/iu,
    COMPOSITE_FIELD: /^([\p{L}_][\p{L}0-9_]*)\s*:\s*(.+)$/iu,
    COMPOSITE_LITERAL: /(?<![\w\s])<([^>]+)>/g,

    // Tableaux
    ARRAY_LITERAL: /(?<![\p{L}0-9_])\[([^\]]*)\]/gu,
    ARRAY_ACCESS: /([\p{L}0-9_]+)\[([^\]]+)\]/gu,

    // Structures de contrôle
    FOR_LOOP: /^\s*Pour\s+([\p{L}0-9_]+)\s+(?:allant de|de)\s+(.+)\s+(?:a|à)\s+(.+)\s+Faire\s*:?/iu,
    WHILE_LOOP: /^\s*Tant que\b/i,
    IF_STATEMENT: /^\s*Si\b/i,
    ELSE_IF: /^\s*Sinon\s+si\b/i,
    ELSE: /^\s*Sinon\b/i,

    // Blocs
    ALGORITHM: /^\s*algorithme\b/i,
    BEGIN: /^\s*Début\b/i,
    END: /^\s*Fin\b/i,
    CLOSING_KEYWORDS: /^\s*(Fin|fsi|fpour|ftq|ftant)\b/i,
    OPENING_BLOCK: /^\s*(Si|Tant que|Début)(?![\p{L}0-9_])/iu,

    // Commentaires
    LINE_COMMENT: /\/\/.*/,
    BLOCK_COMMENT: /\/\*[\s\S]*?\*\//g,
    LEXIQUE: /Lexique\s*:?[\s\S]*/i,

    // Strings
    DOUBLE_QUOTES: /"[^"]*"/g,
    SINGLE_QUOTES: /'(?:\\.|[^\\'])'/g,
    SMART_QUOTES: /[""]/g,

    // Accès aux champs d'objets
    FIELD_ACCESS: /([\p{L}_][\p{L}0-9_]*)\.([\p{L}_][\p{L}0-9_]*)/gu,
    BRACKET_FIELD_ACCESS: /(\])\.([\p{L}_][\p{L}0-9_]*)/gu,
    DOT_FIELD: /\.[\p{L}_][\p{L}0-9_]*/gu
} as const;

// Mapping des types normalisés
export const TYPE_MAPPING: Record<string, string> = {
    'booléen': 'booléen',
    'booleen': 'booléen',
    'réel': 'réel',
    'reel': 'réel',
    'entier': 'entier',
    'chaîne': 'chaîne',
    'chaine': 'chaîne',
    'caractère': 'caractère',
    'caractere': 'caractère',
    'tableau': 'tableau'
};

// Remplacements de symboles pour Lua
export const LUA_REPLACEMENTS: Record<string, string> = {
    // Booléens
    'vrai': 'true',
    'faux': 'false',

    // Opérateurs logiques
    'non': 'not',
    'ou': 'or',
    'et': 'and',

    // Opérateurs arithmétiques
    'mod': '%',
    '≠': '~=',
    '≤': '<=',
    '≥': '>=',
    '÷': '//',

    // IO
    'lire()': 'io.read()',

    // Symboles spéciaux
    'FIN_LIGNE': "'\n'"
} as const;

// Fonctions PSC mappées vers des helpers Lua
export const FUNCTION_MAPPING: Record<string, string> = {
    'fichierOuvrir': '__psc_fichierOuvrir',
    'fichierFermer': '__psc_fichierFermer',
    'fichierLire': '__psc_fichierLire',
    'fichierFin': '__psc_fichierFin',
    'chaineVersEntier': '__psc_chaineVersEntier',
    'fichierCreer': '__psc_fichierCreer',
    'fichierEcrire': '__psc_fichierEcrire',
    'écrire': '__psc_write'
} as const;

// Helpers Lua
export const LUA_HELPERS = `local __psc_file_handles = {}
local __psc_file_current_handle = 1

local function __psc_fichierCreer(nomFichier)
    return __psc_fichierOuvrir(nomFichier, "w")
end

local function __psc_fichierEcrire(handle, value)
    if __psc_file_handles[handle] then
        __psc_file_handles[handle]:write(tostring(value))
    end
end

local function __psc_fichierOuvrir(nomFichier, mode)
    mode = mode or "r"
    local file, err = io.open(nomFichier, mode)
    if not file then
        print("Erreur d'ouverture du fichier: " .. tostring(err))
        return nil
    end
    local handle = __psc_file_current_handle
    __psc_file_handles[handle] = file
    __psc_file_current_handle = __psc_file_current_handle + 1
    return handle
end

local function __psc_fichierFermer(handle)
    if __psc_file_handles[handle] then
        __psc_file_handles[handle]:close()
        __psc_file_handles[handle] = nil
    end
end

local function __psc_fichierLire(handle)
    if __psc_file_handles[handle] then
        return __psc_file_handles[handle]:read()
    end
    return nil
end

local function __psc_fichierFin(handle)
    if __psc_file_handles[handle] then
        local pos = __psc_file_handles[handle]:seek()
        local _, err = __psc_file_handles[handle]:read(0)
        __psc_file_handles[handle]:seek("set", pos)
        return err == "end of file"
    end
    return true
end

local function __psc_chaineVersEntier(chaine)
    return tonumber(chaine) or 0
end

local function __psc_is_array(t)
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
        return v
    elseif type(v) == 'boolean' then
        return v and 'Vrai' or 'Faux'
    else
        return tostring(v)
    end
end

local function __psc_write(...)
    local args = {...}
    local parts = {}
    for i = 1, #args do
        parts[i] = __psc_serialize(args[i])
    end
    print(table.concat(parts, ''))
end
`;
