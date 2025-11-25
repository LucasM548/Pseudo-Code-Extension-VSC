"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const definitions_1 = require("../src/definitions");
const grammarPath = path.join(__dirname, '../syntaxes/psc.tmLanguage.json');
// Charger le grammaire existant pour garder la structure
const grammar = JSON.parse(fs.readFileSync(grammarPath, 'utf-8'));
// Générer la liste des fonctions supportées
const supportFunctions = definitions_1.PSC_DEFINITIONS.functions.map(f => f.name).join('|');
// Générer la liste des types
const types = definitions_1.PSC_DEFINITIONS.types.flatMap(t => t.aliases).join('|');
// Générer la liste des mots-clés de contrôle
const controlKeywords = definitions_1.PSC_DEFINITIONS.keywords
    .filter(k => k.type === 'control')
    .map(k => k.name)
    .join('|');
// Générer la liste des opérateurs logiques
const logicalOperators = definitions_1.PSC_DEFINITIONS.keywords
    .filter(k => k.type === 'operator' && ['et', 'ou', 'non'].includes(k.name))
    .map(k => k.name)
    .join('|');
// Mettre à jour les patterns
const repository = grammar.repository;
if (repository['support-functions']) {
    repository['support-functions'].match = `(?i)\\b(${supportFunctions})\\b`;
}
if (repository['storage']) {
    const patterns = repository['storage'].patterns;
    // Trouver le pattern pour les types
    const typePattern = patterns.find((p) => p.name === 'storage.type' && p.match.includes('entier'));
    if (typePattern) {
        typePattern.match = `(?i)\\b(${types}|InOut)\\b(?!\\s*\\()`;
    }
}
if (repository['keywords']) {
    // Note: Le regex original incluait des variantes comme Tant que, ftq, etc.
    // Pour l'instant on garde le regex original ou on le reconstruit intelligemment.
    // Le regex original: (?i)\b(Si|Alors|Sinon|fsi|Pour|Faire|fpour|Tant(?:\s+que)|ftq|ftant|Début|Fin)\b
    // On va essayer de reconstruire mais attention aux espaces (Tant que)
    // On garde 'Tant que' comme cas spécial car c'est deux mots
    const simpleKeywords = controlKeywords.split('|').filter(k => k !== 'tant' && k !== 'que').join('|');
    repository['keywords'].match = `(?i)\\b(${simpleKeywords}|Tant(?:\\s+que)|ftant)\\b`;
}
if (repository['logical-operators']) {
    repository['logical-operators'].match = `(?i)\\b(${logicalOperators})\\b`;
}
// Sauvegarder
fs.writeFileSync(grammarPath, JSON.stringify(grammar, null, 2));
console.log('Grammaire mise à jour avec succès !');
//# sourceMappingURL=generate-grammar.js.map