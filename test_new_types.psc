Algorithme TestTypes
    // Test File
    f: File
    val: Entier
    
    Début
        écrire("--- Test File ---")
        f ← fileVide()
        Si estFileVide(f) Alors
            écrire("La file est initialement vide")
        Fsi
        
        ajoutFile(f, 10)
        ajoutFile(f, 20)
        ajoutFile(f, 30)
        
        val ← premier(f)
        écrire("Premier élément (attendu 10): ", val)
        
        suppressionFile(f)
        val ← premier(f)
        écrire("Nouveau premier (attendu 20): ", val)
        
        suppressionFile(f)
        suppressionFile(f)
        
        Si estFileVide(f) Alors
            écrire("La file est vide maintenant")
        Fsi
    Fin

    // Test ListeSym
    ls: ListeSym
    p: Place
    v: Entier
    
    Début
        écrire("--- Test ListeSym ---")
        ls ← videLS()
        ajoutTeteLS(ls, 1)
        ajoutQueueLS(ls, 3)
        
        // Liste est 1 -> 3
        
        p ← teteLS(ls) // p pointe sur 1
        p ← sucLS(ls, p) // p pointe sur 3
        
        ajoutLS(ls, p, 2) 
        // Insertion de 2 avant 3. Liste devrait être 1 -> 2 -> 3
        
        écrire("Parcours endroit:")
        p ← teteLS(ls)
        Tant que non finLS(ls, p) Faire
            v ← valLS(ls, p)
            écrire(v)
            p ← sucLS(ls, p)
        Ftq
        
        écrire("Parcours envers:")
        p ← queueLS(ls)
        Tant que non finLS(ls, p) Faire
            v ← valLS(ls, p)
            écrire(v)
            p ← precLS(ls, p)
        Ftq
        
        // Test suppression
        p ← teteLS(ls) // 1
        p ← sucLS(ls, p) // 2
        suppressionLS(ls, p) // Suppression de 2
        
        écrire("Après suppression de 2:")
        p ← teteLS(ls)
        Tant que non finLS(ls, p) Faire
            v ← valLS(ls, p)
            écrire(v)
            p ← sucLS(ls, p)
        Ftq
        
        changeLS(ls, teteLS(ls), 100)
        écrire("Après changement tête à 100:", valLS(ls, teteLS(ls)))
    Fin
