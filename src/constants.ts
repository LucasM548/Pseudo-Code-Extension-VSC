/**
 * Configuration centralisée pour l'extension Pseudo-Code
 * Tous les patterns regex et mots-clés sont définis ici pour éviter la duplication
 */

import { PSC_DEFINITIONS } from './definitions';

// Mots-clés du langage
export const KEYWORDS = {
    CONTROL: PSC_DEFINITIONS.keywords.filter(k => k.type === 'control').map(k => k.name),
    BLOCKS: PSC_DEFINITIONS.keywords.filter(k => k.type === 'block').map(k => k.name),
    TYPES: PSC_DEFINITIONS.types.flatMap(t => t.aliases),
    BOOLEAN: PSC_DEFINITIONS.keywords.filter(k => k.type === 'boolean').map(k => k.name),
    OPERATORS: PSC_DEFINITIONS.keywords.filter(k => k.type === 'operator').map(k => k.name),
    IO: PSC_DEFINITIONS.keywords.filter(k => k.type === 'io').map(k => k.name),
    STRING_OPS: ['longueur', 'concat', 'souschaîne', 'ième'], // Gardés ici car traitement spécial
    FILE_OPS: PSC_DEFINITIONS.functions.filter(f => f.name.startsWith('fichier') || f.name === 'chaineversentier').map(f => f.name),
    // Opérations TDA Liste (en minuscules)
    LIST_OPS: PSC_DEFINITIONS.functions.filter(f => f.name.endsWith('liste') || ['tete', 'val', 'suc', 'finliste', 'listevide'].includes(f.name)).map(f => f.name),
    // Opérations TDA ListeSym
    LISTESYM_OPS: PSC_DEFINITIONS.functions.filter(f => f.name.endsWith('ls')).map(f => f.name),
    // Opérations TDA Pile
    STACK_OPS: PSC_DEFINITIONS.functions.filter(f => f.name.includes('pile') || f.name === 'sommet' || f.name === 'empiler' || f.name === 'depiler').map(f => f.name),
    // Opérations TDA File
    QUEUE_OPS: PSC_DEFINITIONS.functions.filter(f => f.name.includes('file') || f.name === 'premier').map(f => f.name),
    MODIFIERS: PSC_DEFINITIONS.keywords.filter(k => k.type === 'modifier').map(k => k.name)
} as const;

// Arité attendue des fonctions intégrées (pour le linter)
// Clés en minuscules (comparaison insensible à la casse côté linter)
export const BUILTIN_FUNCTION_ARITY: Record<string, number> = Object.fromEntries(
    PSC_DEFINITIONS.functions.map(f => [f.name, f.arity])
);

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
    ...KEYWORDS.LIST_OPS,
    ...KEYWORDS.STACK_OPS,
    ...KEYWORDS.QUEUE_OPS,
    ...KEYWORDS.LISTESYM_OPS,
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
    VARIABLE_DECLARATION: /^([\p{L}0-9_,\s]+?)\s*:\s*([\p{L}0-9_]+(?:\([^()]*\))?)/iu,
    ASSIGNMENT: /←/,
    READ_ASSIGNMENT: /^\s*[\p{L}0-9_]+\s*←\s*lire\s*\(\s*\)\s*$/iu,

    // Types composites
    COMPOSITE_TYPE: /^([\p{L}_][\p{L}0-9_]*)\s*(?:=\s*)?<\s*(.+?)\s*>$/iu,
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
export const TYPE_MAPPING: Record<string, string> = Object.fromEntries(
    PSC_DEFINITIONS.types.flatMap(t => t.aliases.map(alias => [alias, t.name]))
);

// Remplacements de symboles pour Lua
export const LUA_REPLACEMENTS: Record<string, string> = {
    ...Object.fromEntries(
        PSC_DEFINITIONS.keywords
            .filter(k => k.luaEquivalent)
            .map(k => [k.name, k.luaEquivalent!])
    ),
    // Opérateurs arithmétiques et spéciaux non couverts par les mots-clés simples
    '≠': '~=',
    '≤': '<=',
    '≥': '>=',
    '÷': '//',
    'lire()': 'io.read()',
    'FIN_LIGNE': "'\n'"
} as const;

// Fonctions PSC mappées vers des helpers Lua
export const FUNCTION_MAPPING: Record<string, string> = Object.fromEntries(
    PSC_DEFINITIONS.functions.map(f => [f.name, f.luaHelper])
);

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

-- Détection d'une liste chaînée TDA (nœud avec champs 'val' et/ou 'suc')
local function __psc_is_liste(t)
    return type(t) == 'table' and (t.val ~= nil or t.suc ~= nil)
end

-- Détection d'une liste symétrique TDA (table avec head/tail ou noeud avec val/suc/prec)
local function __psc_is_listesym(t)
    -- Structure conteneur { head = ..., tail = ... }
    if type(t) == 'table' and (t.head ~= nil or t.tail ~= nil) then return true end
    -- Noeud { val=..., suc=..., prec=... }
    if type(t) == 'table' and (t.val ~= nil and (t.suc ~= nil or t.prec ~= nil)) then return true end
    return false
end

-- Sérialisation générique (incluant listes TDA au format (a, b, c))
local function __psc_serialize(v)
    -- Gestion des valeurs nil (listes vides)
    if v == nil then
        return '()'
    end
    
    if type(v) == 'table' then
        -- Vérifier d'abord si c'est une Pile ou File (avec métadonnée _type)
        if v._type == 'pile' then
            local parts = {}
            for i = 1, #v do
                parts[#parts+1] = __psc_serialize(v[i])
            end
            return 'Pile[' .. table.concat(parts, ', ') .. ']'
        elseif v._type == 'file' then
            local parts = {}
            for i = 1, #v do
                parts[#parts+1] = __psc_serialize(v[i])
            end
            return 'File[' .. table.concat(parts, ', ') .. ']'
        elseif __psc_is_liste(v) then
            local parts = {}
            local node = v
            while node ~= nil do
                parts[#parts+1] = __psc_serialize(node.val)
                node = node.suc
            end
            return '(' .. table.concat(parts, ', ') .. ')'
        elseif __psc_is_listesym(v) then
            -- Si c'est le conteneur {head=..., tail=...}
            if v.head ~= nil or v.tail ~= nil then
                local parts = {}
                local node = v.head
                while node ~= nil do
                    parts[#parts+1] = __psc_serialize(node.val)
                    node = node.suc
                end
                return 'LS(' .. table.concat(parts, ', ') .. ')'
            end
            -- Si c'est un noeud isolé, on l'affiche simplement
            return '{val=' .. tostring(v.val) .. '}'
        elseif __psc_is_array(v) then
            -- Tableau normal
            local parts = {}
            for i = 1, #v do
                parts[#parts+1] = __psc_serialize(v[i])
            end
            return '[' .. table.concat(parts, ', ') .. ']'
        else
            -- Objet/enregistrement générique (filtrer _type interne)
            local parts = {}
            for k, val in pairs(v) do
                if k ~= '_type' then
                    parts[#parts+1] = tostring(k) .. ':' .. __psc_serialize(val)
                end
            end
            return '{' .. table.concat(parts, ', ') .. '}'
        end
    elseif type(v) == 'string' then
        return v
    elseif type(v) == 'boolean' then
        return v and 'Vrai' or 'Faux'
    elseif type(v) == 'number' then
        return tostring(v)
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
-- TDA Liste (places entières)
local function __psc_liste_tete(l)
    return 0
end
local function __psc_liste_val(l, p)
    local node = l
    local i = p or 0
    while node ~= nil and i > 0 do
        node = node.suc
        i = i - 1
    end
    return node and node.val or nil
end
local function __psc_liste_suc(l, p)
    return (p or 0) + 1
end
local function __psc_liste_fin(l, p)
    local node = l
    local i = p or 0
    while node ~= nil and i > 0 do
        node = node.suc
        i = i - 1
    end
    return node == nil
end
local function __psc_liste_vide()
    return nil
end
local function __psc_liste_ajout_tete(l, v)
    return { val = v, suc = l }
end
local function __psc_liste_suppression_tete(l)
    if l == nil then return nil end
    return l.suc
end
local function __psc_liste_ajout_queue(l, v)
    if l == nil then
        return { val = v, suc = nil }
    end
    local head = l
    local node = l
    while node.suc ~= nil do
        node = node.suc
    end
    node.suc = { val = v, suc = nil }
    return head
end
local function __psc_liste_suppression_queue(l)
    if l == nil then return nil end
    if l.suc == nil then return nil end
    local head = l
    local prev = nil
    local node = l
    while node.suc ~= nil do
        prev = node
        node = node.suc
    end
    if prev ~= nil then prev.suc = nil end
    return head
end
local function __psc_liste_ajout(l, p, v)
    if l == nil then
        return { val = v, suc = nil }
    end
    local head = l
    local node = l
    local i = p or 0
    while node ~= nil and i > 0 do
        node = node.suc
        i = i - 1
    end
    if node ~= nil then
        node.suc = { val = v, suc = node.suc }
    end
    return head
end
local function __psc_liste_suppression(l, p)
    if l == nil then return nil end
    local head = l
    local i = p or 0
    if i <= 0 then
        return l.suc
    end
    local prev = l
    local node = l.suc
    i = i - 1
    while node ~= nil and i > 0 do
        prev = node
        node = node.suc
        i = i - 1
    end
    if node ~= nil then
        prev.suc = node.suc
    end
    return head
end
local function __psc_liste_change(l, p, v)
    local node = l
    local i = p or 0
    while node ~= nil and i > 0 do
        node = node.suc
        i = i - 1
    end
    if node ~= nil then
        node.val = v
    end
    return l
end

-- Construit une liste chaînée à partir d'un tableau Lua séquentiel
local function __psc_liste_from_table(t)
    local l = __psc_liste_vide()
    if type(t) ~= 'table' then return l end
    for i = 1, #t do
        l = __psc_liste_ajout_queue(l, t[i])
    end
    return l
end

-- =================================================================================================================
-- TDA Pile (Implémentation par table/tableau)
-- =================================================================================================================
local function __psc_pile_vide()
    return {_type = 'pile'}
end

local function __psc_pile_sommet(p)
    if type(p) ~= 'table' or #p == 0 then return nil end
    return p[#p]
end

local function __psc_pile_est_vide(p)
    return type(p) ~= 'table' or #p == 0
end

local function __psc_pile_empiler(p, v)
    if type(p) == 'table' then
        table.insert(p, v)
    end
end

local function __psc_pile_depiler(p)
    if type(p) == 'table' and #p > 0 then
        table.remove(p)
    end
end

-- Créer une pile à partir d'un tableau de valeurs
local function __psc_pile_from_values(t)
    local p = __psc_pile_vide()
    if type(t) == 'table' then
        for i = 1, #t do
            __psc_pile_empiler(p, t[i])
        end
    end
    return p
end

-- =================================================================================================================
-- TDA File (Implémentation par table/tableau)
-- =================================================================================================================
local function __psc_file_vide()
    return {_type = 'file'}
end

local function __psc_file_est_vide(f)
    return type(f) ~= 'table' or #f == 0
end

local function __psc_file_enfiler(f, v)
    if type(f) == 'table' then
        table.insert(f, v)
    end
end

local function __psc_file_defiler(f)
    if type(f) == 'table' and #f > 0 then
        table.remove(f, 1)
    end
end

-- Créer une file à partir d'un tableau de valeurs
local function __psc_file_from_values(t)
    local f = __psc_file_vide()
    if type(t) == 'table' then
        for i = 1, #t do
            __psc_file_enfiler(f, t[i])
        end
    end
    return f
end

-- Fonction générique pour 'tete' (supporte Liste et File)
local function __psc_generic_tete(obj)
    if __psc_is_liste(obj) then
        return __psc_liste_tete(obj)
    elseif type(obj) == 'table' then
        -- Pour une file (ou tableau), la tête est le premier élément
        return obj[1]
    end
    return nil
end

-- =================================================================================================================
-- TDA ListeSym (Liste Symétrique)
-- =================================================================================================================
local function __psc_listesym_vide()
    return { head = nil, tail = nil }
end

local function __psc_listesym_tete(l)
    return l.head
end

local function __psc_listesym_queue(l)
    return l.tail
end

local function __psc_listesym_val(l, p)
    if p then return p.val end
    return nil
end

local function __psc_listesym_suc(l, p)
    if p then return p.suc end
    return nil
end

local function __psc_listesym_prec(l, p)
    if p then return p.prec end
    return nil
end

local function __psc_listesym_fin(l, p)
    return p == nil
end

local function __psc_listesym_ajout_tete(l, v)
    local new_node = { val = v, suc = l.head, prec = nil }
    if l.head then
        l.head.prec = new_node
    else
        l.tail = new_node
    end
    l.head = new_node
end

local function __psc_listesym_suppression_tete(l)
    if l.head then
        l.head = l.head.suc
        if l.head then
            l.head.prec = nil
        else
            l.tail = nil
        end
    end
end

local function __psc_listesym_ajout_queue(l, v)
    local new_node = { val = v, suc = nil, prec = l.tail }
    if l.tail then
        l.tail.suc = new_node
    else
        l.head = new_node
    end
    l.tail = new_node
end

local function __psc_listesym_suppression_queue(l)
    if l.tail then
        l.tail = l.tail.prec
        if l.tail then
            l.tail.suc = nil
        else
            l.head = nil
        end
    end
end

local function __psc_listesym_ajout(l, p, v)
    if p == nil then
        __psc_listesym_ajout_queue(l, v)
    else
        local new_node = { val = v, suc = p, prec = p.prec }
        if p.prec then
            p.prec.suc = new_node
        else
            l.head = new_node
        end
        p.prec = new_node
    end
end

local function __psc_listesym_suppression(l, p)
    if p == nil then return end
    if p.prec then
        p.prec.suc = p.suc
    else
        l.head = p.suc
    end
    if p.suc then
        p.suc.prec = p.prec
    else
        l.tail = p.prec
    end
end

local function __psc_listesym_change(l, p, v)
    if p then p.val = v end
end

local function __psc_file_premier(f)
    if type(f) == 'table' and #f > 0 then
        return f[1]
    end
    return nil
end

-- Construit une ListeSym à partir d'un tableau Lua séquentiel
local function __psc_listesym_from_table(t)
    local l = __psc_listesym_vide()
    if type(t) ~= 'table' then return l end
    for i = 1, #t do
        __psc_listesym_ajout_queue(l, t[i])
    end
    return l
end

-- =================================================================================================================
-- =================================================================================================================
-- =================================================================================================================

`;
