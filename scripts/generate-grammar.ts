import * as fs from 'fs';
import * as path from 'path';
import { PSC_DEFINITIONS } from '../src/definitions';

/**
 * Générateur automatique de grammaire TextMate
 * Synchronise psc.tmLanguage.json avec definitions.ts pour éliminer la redondance
 */

// Remonter au dossier racine du projet (depuis out/scripts vers la racine)
const projectRoot = path.join(__dirname, '..', '..');
const grammarPath = path.join(projectRoot, 'syntaxes', 'psc.tmLanguage.json');

// Fonction pour parser JSON avec commentaires (JSONC)
function parseJSONC(content: string): any {
    // Retirer les commentaires de type // en début de ligne
    const withoutComments = content.replace(/^\/\/.*$/gm, '');
    return JSON.parse(withoutComments);
}

// Charger la grammaire existante pour conserver la structure
const grammarContent = fs.readFileSync(grammarPath, 'utf-8');
const grammar = parseJSONC(grammarContent);

// Extraire les mots-clés par type
const controlKeywords = PSC_DEFINITIONS.keywords
    .filter(k => k.type === 'control')
    .map(k => k.name);

const blockKeywords = PSC_DEFINITIONS.keywords
    .filter(k => k.type === 'block')
    .map(k => k.name);

const logicalOperators = PSC_DEFINITIONS.keywords
    .filter(k => k.type === 'operator')
    .map(k => k.name);

const ioKeywords = PSC_DEFINITIONS.keywords
    .filter(k => k.type === 'io')
    .map(k => k.name);

const modifierKeywords = PSC_DEFINITIONS.keywords
    .filter(k => k.type === 'modifier')
    .map(k => k.name);

// Extraire les fonctions et types
const supportFunctions = PSC_DEFINITIONS.functions.map(f => f.name);

// Séparer les types normaux de pile/file (traitement spécial)
const baseTypes = PSC_DEFINITIONS.types
    .filter(t => !['pile', 'file'].includes(t.name))
    .flatMap(t => t.aliases);

// Mettre à jour les patterns dans la grammaire
const repository = grammar.repository;

// 1. Mots-clés de contrôle + blocs (Début, Fin, etc.)
if (repository['keywords']) {
    // Combiner control et block keywords, gérer "Tant que" comme cas spécial
    const allKeywords = [...controlKeywords, ...blockKeywords]
        .filter(k => !['tant', 'que'].includes(k)); // On gère "Tant que" séparément
    repository['keywords'].match = `(?i)\\b(${allKeywords.join('|')}|Tant(?:\\s+que)|ftant)\\b`;
}

// 2. Opérateurs logiques
if (repository['logical-operators']) {
    repository['logical-operators'].match = `(?i)\\b(${logicalOperators.join('|')})\\b`;
}

// 3. Fonctions intégrées + I/O (écrire, lire)
if (repository['support-functions']) {
    const allFunctions = [...supportFunctions, ...ioKeywords];
    repository['support-functions'].match = `(?i)\\b(${allFunctions.join('|')})\\b`;
}

// 4. Types et modificateurs
if (repository['storage']) {
    const patterns = repository['storage'].patterns;

    // Mettre à jour le pattern des modificateurs (Lexique, InOut, etc.)
    const modifierPattern = patterns.find((p: any) => p.name === 'storage.modifier');
    if (modifierPattern) {
        modifierPattern.match = `(?i)\\b(${[...modifierKeywords, 'Lexique'].join('|')})\\b`;
    }

    // Mettre à jour le pattern des types de base (sans pile/file)
    const typePatternIndex = patterns.findIndex((p: any) =>
        p.name === 'storage.type' && p.match && p.match.includes('entier')
    );
    if (typePatternIndex !== -1) {
        patterns[typePatternIndex].match = `(?i)\\b(${baseTypes.join('|')}|listesym|InOut)\\b(?!\\s*\\()`;
    }
}

// 5. Constantes (Booléens)
if (repository['constants']) {
    const patterns = repository['constants'].patterns;
    const booleanKeywords = PSC_DEFINITIONS.keywords
        .filter(k => k.type === 'boolean')
        .map(k => k.name);

    const booleanPattern = patterns.find((p: any) => p.name === 'constant.language.boolean');
    if (booleanPattern) {
        booleanPattern.match = `(?i)\\b(${booleanKeywords.join('|')})\\b`;
    }
}

const grammarJson = JSON.stringify(grammar, null, 2);
fs.writeFileSync(grammarPath, grammarJson, 'utf-8');

console.log('✓ Grammaire TextMate mise à jour avec succès !');
console.log(`  - ${controlKeywords.length + blockKeywords.length} mots-clés de contrôle/bloc`);
console.log(`  - ${supportFunctions.length} fonctions intégrées`);
console.log(`  - ${ioKeywords.length} fonctions I/O`);
console.log(`  - ${baseTypes.length} types de base`);
