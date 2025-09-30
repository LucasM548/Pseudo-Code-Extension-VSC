# Pseudo-Code Language Support

Cette extension transforme Visual Studio Code en un environnement de développement intégré (IDE) puissant et intelligent, spécialement conçu pour l'écriture de pseudo-code algorithmique en français. Elle est l'outil idéal pour les étudiants, les enseignants et les développeurs qui souhaitent prototyper, apprendre ou enseigner l'algorithmique avec une syntaxe claire et un outillage moderne.

 <!-- Vous pouvez créer une capture d'écran de l'extension et remplacer ce lien -->

---

## Fonctionnalités Principales

Cette extension n'est pas un simple colorateur syntaxique. C'est une suite d'outils complète pour améliorer votre productivité et la qualité de votre code.

### 1. Coloration Syntaxique Avancée
Le code est coloré de manière logique pour une lisibilité maximale :
- **Mots-clés de structure** (`Début`, `Fin`, `Algorithme`, `Fonction`, `Lexique`)
- **Mots-clés de contrôle** (`Si`, `Alors`, `Sinon`, `fsi`, `Pour`, `Faire`, `fpour`, `Tant que`, `ftq`)
- **Types de données** (`entier`, `réel`, `chaîne`, `booléen`, `tableau`)
- **Variables, paramètres et appels de fonction**
- **Chaînes de caractères, nombres et commentaires** (`//` et `/* */`)

### 2. Formatage de Code Automatique (Prettier-like)
**Raccourci : `Alt + Maj + F`**

Fini le code mal indenté ! Le formateur intelligent analyse votre fichier et applique automatiquement une indentation parfaite et cohérente. Il respecte la structure de vos blocs `Si`, `Pour`, `Tant que` et `Début`/`Fin` pour un code toujours propre et lisible.

**Avant :**
```psc
Fonction TestFormatage() : entier
Début
Pour i de 1 à 10 Faire :
Si i mod 2 = 0 Alors :
écrire(i)
fsi
fpour
retourner 0
Fin
```

**Après `Alt + Maj + F` :**
```psc
Fonction TestFormatage() : entier
    Début
        Pour i de 1 à 10 Faire :
            Si i mod 2 = 0 Alors :
                écrire(i)
            fsi
        fpour
        retourner 0
    Fin
```

### 3. Analyse de Diagnostic en Temps Réel (Linting)
Ne perdez plus de temps à chercher des erreurs de frappe. L'analyseur intégré lit votre code en temps réel et souligne les erreurs de structure :
- **Blocs non fermés** (un `Pour` sans son `fpour`, un `Début` sans son `Fin`).
- **Blocs mal fermés** (un `Si` fermé par un `fpour`).
- **Mots-clés de fermeture inattendus**.

Les erreurs sont clairement indiquées avec un message explicite pour vous aider à les corriger instantanément.

### 4. Snippets de Code Intelligents
Accélérez votre écriture de code avec des extraits de code pré-configurés. Tapez simplement le préfixe et appuyez sur `Tab` pour insérer une structure complète.
- `algorithme` → Crée un squelette d'algorithme principal.
- `fonction` → Crée une structure de fonction complète avec `Début`, `Fin` et `Lexique`.
- `pour` → Insère une boucle `Pour ... Faire : ... fpour`.
- `si` → Insère une condition `Si ... Alors : ... fsi`.
- `sisinon` → Insère une condition `Si ... Alors : ... Sinon : ... fsi`.
- `tantque` → Insère une boucle `Tant que ... Faire : ... ftq`.

### 5. Exploration de Symboles et Navigation
Naviguez facilement dans vos fichiers, même les plus longs. La vue **"Outline" / "Plan"** de VS Code affiche une liste structurée de tous vos `Algorithmes` et `Fonctions`, vous permettant de sauter à une définition en un seul clic.

### 6. Fermeture Automatique des Blocs
Lorsque vous tapez une ligne qui ouvre un bloc (comme `Pour ... Faire :`) et que vous appuyez sur `Entrée`, l'extension insère automatiquement le mot-clé de fermeture correspondant (`fpour`), en plaçant votre curseur correctement indenté au milieu.

---

## Installation

1.  Ouvrez **Visual Studio Code**.
2.  Allez dans le panneau des **Extensions** (`Ctrl+Shift+X`).
3.  Recherchez `Pseudo-Code Language Support`.
4.  Cliquez sur **Installer**.
5.  Redémarrez VS Code et ouvrez un fichier `.psc` pour commencer !

#### Installation Manuelle (depuis un fichier `.vsix`)
1.  Téléchargez le fichier `pseudocode-support-x.x.x.vsix`.
2.  Dans VS Code, allez dans le panneau des **Extensions**.
3.  Cliquez sur les trois points (`...`) en haut à droite du panneau, puis sélectionnez **"Install from VSIX..."**.
4.  Choisissez le fichier `.vsix` que vous avez téléchargé.

---

## Contributions

Les contributions, les rapports de bugs et les suggestions de fonctionnalités sont les bienvenus ! N'hésitez pas à ouvrir une "Issue" ou une "Pull Request" sur le dépôt GitHub du projet.
