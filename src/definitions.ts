/**
 * Registre central des définitions pour le langage Pseudo-Code.
 * Ce fichier sert de source de vérité pour les types, fonctions et mots-clés.
 */

export interface PscType {
    name: string;
    aliases: string[];
}

export interface PscFunction {
    name: string;
    arity: number;
    luaHelper: string;
    isMutator?: boolean; // Si vrai, l'appel est transformé en réaffectation du 1er argument (ex: ajout(l, v) -> l = ajout(l, v))
    description?: string;
}

export interface PscKeyword {
    name: string;
    type: 'control' | 'block' | 'boolean' | 'operator' | 'io' | 'modifier' | 'other';
    luaEquivalent?: string;
}

export const PSC_DEFINITIONS = {
    types: [
        { name: 'entier', aliases: ['entier'] },
        { name: 'réel', aliases: ['réel', 'reel'] },
        { name: 'booléen', aliases: ['booléen', 'booleen'] },
        { name: 'chaîne', aliases: ['chaîne', 'chaine'] },
        { name: 'caractère', aliases: ['caractère', 'caractere'] },
        { name: 'tableau', aliases: ['tableau'] },
        { name: 'liste', aliases: ['liste'] },
        { name: 'pile', aliases: ['pile'] },
        { name: 'file', aliases: ['file'] },
        { name: 'listesym', aliases: ['listesym'] },
        { name: 'table', aliases: ['table'] }
    ] as PscType[],

    keywords: [
        // Contrôle
        { name: 'si', type: 'control', luaEquivalent: 'if' },
        { name: 'alors', type: 'control', luaEquivalent: 'then' },
        { name: 'sinon', type: 'control', luaEquivalent: 'else' },
        { name: 'fsi', type: 'control', luaEquivalent: 'end' },
        { name: 'tant', type: 'control', luaEquivalent: 'while' },
        { name: 'que', type: 'control' },
        { name: 'ftq', type: 'control', luaEquivalent: 'end' },
        { name: 'pour', type: 'control', luaEquivalent: 'for' },
        { name: 'de', type: 'control' },
        { name: 'à', type: 'control' },
        { name: 'faire', type: 'control', luaEquivalent: 'do' },
        { name: 'fpour', type: 'control', luaEquivalent: 'end' },
        { name: 'décroissant', type: 'control' },
        { name: 'retourner', type: 'control', luaEquivalent: 'return' },
        { name: 'retourne', type: 'control', luaEquivalent: 'return' },

        // Blocs
        { name: 'début', type: 'block' },
        { name: 'fin', type: 'block' },
        { name: 'algorithme', type: 'block' },
        { name: 'fonction', type: 'block' },

        // Booléens
        { name: 'vrai', type: 'boolean', luaEquivalent: 'true' },
        { name: 'faux', type: 'boolean', luaEquivalent: 'false' },

        // Opérateurs
        { name: 'et', type: 'operator', luaEquivalent: 'and' },
        { name: 'ou', type: 'operator', luaEquivalent: 'or' },
        { name: 'non', type: 'operator', luaEquivalent: 'not' },
        { name: 'mod', type: 'operator', luaEquivalent: '%' },

        // IO
        { name: 'écrire', type: 'io', luaEquivalent: '__psc_write' },
        { name: 'lire', type: 'io', luaEquivalent: 'io.read' },

        // Modificateurs
        { name: 'inout', type: 'modifier' }
    ] as PscKeyword[],

    functions: [
        // Opérations sur les chaînes
        { name: 'longueur', arity: 1, luaHelper: '#', description: 'Longueur de la chaîne' }, // Traitement spécial dans executor
        { name: 'concat', arity: 2, luaHelper: '..', description: 'Concaténation' }, // Traitement spécial
        { name: 'souschaîne', arity: 3, luaHelper: 'string.sub', description: 'Sous-chaîne' }, // Traitement spécial
        { name: 'ième', arity: 2, luaHelper: 'string.sub', description: 'Caractère à la position i' }, // Traitement spécial

        // Fichiers
        { name: 'fichierouvrir', arity: 2, luaHelper: '__psc_fichierOuvrir' },
        { name: 'fichierfermer', arity: 1, luaHelper: '__psc_fichierFermer' },
        { name: 'fichierlire', arity: 1, luaHelper: '__psc_fichierLire' },
        { name: 'fichierfin', arity: 1, luaHelper: '__psc_fichierFin' },
        { name: 'chaineversentier', arity: 1, luaHelper: '__psc_chaineVersEntier' },
        { name: 'fichiercreer', arity: 1, luaHelper: '__psc_fichierCreer' },
        { name: 'fichierecrire', arity: 2, luaHelper: '__psc_fichierEcrire' },

        // TDA Liste
        { name: 'tete', arity: 1, luaHelper: '__psc_generic_tete' },
        { name: 'val', arity: 2, luaHelper: '__psc_liste_val' },
        { name: 'suc', arity: 2, luaHelper: '__psc_liste_suc' },
        { name: 'finliste', arity: 2, luaHelper: '__psc_liste_fin' },
        { name: 'listevide', arity: 0, luaHelper: '__psc_liste_vide' },
        { name: 'ajoutteteliste', arity: 2, luaHelper: '__psc_liste_ajout_tete', isMutator: true },
        { name: 'suppressionteteliste', arity: 1, luaHelper: '__psc_liste_suppression_tete', isMutator: true },
        { name: 'ajoutqueueliste', arity: 2, luaHelper: '__psc_liste_ajout_queue', isMutator: true },
        { name: 'suppressionqueueliste', arity: 1, luaHelper: '__psc_liste_suppression_queue', isMutator: true },
        { name: 'ajoutliste', arity: 3, luaHelper: '__psc_liste_ajout', isMutator: true },
        { name: 'suppressionliste', arity: 2, luaHelper: '__psc_liste_suppression', isMutator: true },
        { name: 'changeliste', arity: 3, luaHelper: '__psc_liste_change', isMutator: true },

        // TDA ListeSym
        { name: 'tetels', arity: 1, luaHelper: '__psc_listesym_tete' },
        { name: 'queuels', arity: 1, luaHelper: '__psc_listesym_queue' },
        { name: 'valls', arity: 2, luaHelper: '__psc_listesym_val' },
        { name: 'sucls', arity: 2, luaHelper: '__psc_listesym_suc' },
        { name: 'precls', arity: 2, luaHelper: '__psc_listesym_prec' },
        { name: 'finls', arity: 2, luaHelper: '__psc_listesym_fin' },
        { name: 'videls', arity: 0, luaHelper: '__psc_listesym_vide' },
        { name: 'ajouttetels', arity: 2, luaHelper: '__psc_listesym_ajout_tete' }, // Mutator implicite par référence en Lua pour tables, mais on peut le marquer si on veut forcer la réassignation (pas nécessaire pour ListeSym car mutable par ref)
        { name: 'suppressiontetels', arity: 1, luaHelper: '__psc_listesym_suppression_tete' },
        { name: 'ajoutqueuels', arity: 2, luaHelper: '__psc_listesym_ajout_queue' },
        { name: 'suppressionqueuels', arity: 1, luaHelper: '__psc_listesym_suppression_queue' },
        { name: 'ajoutls', arity: 3, luaHelper: '__psc_listesym_ajout' },
        { name: 'suppressionls', arity: 2, luaHelper: '__psc_listesym_suppression' },
        { name: 'changels', arity: 3, luaHelper: '__psc_listesym_change' },

        // TDA Pile
        { name: 'pilevide', arity: 0, luaHelper: '__psc_pile_vide' },
        { name: 'sommet', arity: 1, luaHelper: '__psc_pile_sommet' },
        { name: 'estvidepile', arity: 1, luaHelper: '__psc_pile_est_vide' },
        { name: 'empiler', arity: 2, luaHelper: '__psc_pile_empiler' },
        { name: 'depiler', arity: 1, luaHelper: '__psc_pile_depiler' },

        // TDA File
        { name: 'filevide', arity: 0, luaHelper: '__psc_file_vide' },
        { name: 'estvidefile', arity: 1, luaHelper: '__psc_file_est_vide' },
        { name: 'enfiler', arity: 2, luaHelper: '__psc_file_enfiler' },
        { name: 'defiler', arity: 1, luaHelper: '__psc_file_defiler' },
        { name: 'premier', arity: 1, luaHelper: '__psc_file_premier' },
        { name: 'ajoutfile', arity: 2, luaHelper: '__psc_file_enfiler' }, // Alias
        { name: 'suppressionfile', arity: 1, luaHelper: '__psc_file_defiler' }, // Alias
        { name: 'estfilevide', arity: 1, luaHelper: '__psc_file_est_vide' }, // Alias

        // TDA Table (Dictionnaire/Map: Clé -> Valeur)
        { name: 'tablevide', arity: 0, luaHelper: '__psc_table_vide' },
        { name: 'domaine', arity: 1, luaHelper: '__psc_table_domaine' },
        { name: 'accestable', arity: 2, luaHelper: '__psc_table_acces' },
        { name: 'ajouttable', arity: 3, luaHelper: '__psc_table_ajout', isMutator: true },
        { name: 'suppressiontable', arity: 2, luaHelper: '__psc_table_suppression', isMutator: true },
        { name: 'changetable', arity: 3, luaHelper: '__psc_table_change', isMutator: true },
        { name: 'estdans', arity: 2, luaHelper: '__psc_ensemble_estdans' }
    ] as PscFunction[]
};
