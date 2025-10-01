# Pseudo-Code Language Support

Cette extension transforme Visual Studio Code en un environnement de développement intégré (IDE) puissant et complet, spécialement conçu pour l'écriture et **l'exécution** de pseudo-code algorithmique en français. C'est l'outil idéal pour les étudiants, les enseignants et les développeurs qui souhaitent prototyper, apprendre, enseigner et **tester** leurs algorithmes avec une syntaxe claire et un outillage moderne.

 <!-- Vous pouvez créer une capture d'écran et remplacer ce lien -->

---

## Fonctionnalités Principales

Cette extension n'est pas un simple colorateur syntaxique. C'est une suite d'outils complète pour écrire, valider et exécuter votre pseudo-code.

### 1. Exécution Instantanée du Code
**Donnez vie à vos algorithmes !** Plus besoin de traduire votre code à la main ou d'utiliser un autre outil.
-   **Bouton d'Exécution ▶️ :** Cliquez sur l'icône "Play" qui apparaît en haut à droite de vos fichiers `.psc` pour lancer votre code.
-   **Résultats en direct :** La sortie de votre programme (via la fonction `écrire()`) s'affiche directement dans le terminal intégré de VS Code.
-   **Aucune configuration requise :** L'extension s'occupe de tout en arrière-plan, en traduisant votre pseudo-code pour le rendre exécutable.

### 2. Coloration Syntaxique Avancée
Le code est coloré de manière logique pour une lisibilité maximale :
-   **Mots-clés de structure** (`Début`, `Fin`, `Algorithme`, `Fonction`, `Lexique`)
-   **Mots-clés de contrôle** (`Si`, `Alors`, `Sinon`, `fsi`, `Pour`, `Faire`, `fpour`, `Tant que`, `ftq`)
-   **Types de données** (`entier`, `réel`, `chaîne`, `booléen`, `tableau`)
-   **Variables, paramètres et appels de fonction**
-   **Chaînes de caractères, nombres et commentaires** (`//` et `/* */`)

### 3. Formatage de Code Automatique (Prettier-like)
**Raccourci : `Alt + Maj + F`**

Fini le code mal indenté ! Le formateur intelligent analyse votre fichier et applique automatiquement une indentation parfaite et cohérente.

**Avant :**
```psc
Fonction TestFormatage()
Début
Pour i de 1 à 10 Faire :
Si i mod 2 = 0 Alors :
écrire(i)
fsi
fpour
Fin
```

**Après `Alt + Maj + F` :**
```psc
Fonction TestFormatage()
Début
	Pour i de 1 à 10 Faire :
		Si i mod 2 = 0 Alors :
			écrire(i)
		fsi
	fpour
Fin
```

### 4. Analyse de Diagnostic en Temps Réel (Linting)
Ne perdez plus de temps à chercher des erreurs de frappe. L'analyseur intégré lit votre code en temps réel et souligne les erreurs de structure :
-   **Blocs non fermés** (un `Pour` sans son `fpour`).
-   **Blocs mal fermés** (un `Si` fermé par un `fpour`).
-   **Mots-clés de fermeture inattendus**.

### 5. Snippets de Code Intelligents
Accélérez votre écriture de code avec des extraits pré-configurés. Tapez simplement le préfixe et appuyez sur `Tab` :
-   `algorithme` → Crée un squelette d'algorithme principal.
-   `fonction` → Crée une structure de fonction complète.
-   `pour` → Insère une boucle `Pour`.
-   `si` / `sisinon` → Insère une condition `Si` ou `Si/Sinon`.
-   `tantque` → Insère une boucle `Tant que`.

### 6. Exploration de Symboles et Navigation
Naviguez facilement dans vos fichiers. La vue **"Outline" / "Plan"** de VS Code affiche une liste structurée de tous vos `Algorithmes` et `Fonctions`, vous permettant de sauter à une définition en un clic.

### 7. Fermeture Automatique des Blocs
Lorsque vous tapez une ligne qui ouvre un bloc (comme `Pour ... Faire :`) et que vous appuyez sur `Entrée`, l'extension insère automatiquement le mot-clé de fermeture correspondant (`fpour`).

---

## Installation

1.  Ouvrez **Visual Studio Code**.
2.  Allez dans le panneau des **Extensions** (`Ctrl+Shift+X`).
3.  Recherchez `Pseudo-Code Language Support` (ou le nom que vous lui avez donné).
4.  Cliquez sur **Installer**.
5.  Ouvrez un fichier `.psc`, écrivez votre algorithme et cliquez sur le bouton ▶️ pour le tester !

#### Installation Manuelle (depuis un fichier `.vsix`)
1.  Téléchargez le fichier `pseudocode-support-x.x.x.vsix`.
2.  Dans VS Code, allez dans le panneau des **Extensions**.
3.  Cliquez sur les trois points (`...`) en haut à droite, puis sélectionnez **"Install from VSIX..."**.
4.  Choisissez le fichier `.vsix` que vous avez téléchargé.

---

## Contributions

Les contributions, les rapports de bugs et les suggestions de fonctionnalités sont les bienvenus ! N'hésitez pas à ouvrir une "Issue" ou une "Pull Request" sur le dépôt GitHub du projet.