/**
 * Génère une position de spawn aléatoire et sécurisée pour un nouveau serpent
 *
 * @param {number} gridWidth - Largeur de la grille (nombre de cellules)
 * @param {number} gridHeight - Hauteur de la grille (nombre de cellules)
 * @param {Array|null} otherSnake - Array des positions du serpent adverse (null si premier joueur)
 *
 * @returns {Object} Objet contenant :
 *   - snake: Array de 3 positions {x, y} formant le serpent initial (tête en index 0)
 *   - direction: Direction initiale du serpent {x, y} (valeurs -1, 0, ou 1)
 *
 * @description Algorithme de génération avec contraintes de sécurité :
 *
 *   CONTRAINTES :
 *   - Longueur initiale : 3 segments
 *   - Distance minimale de l'adversaire : 10 cellules (distance de Manhattan)
 *   - Marge depuis les bords : 5 cellules
 *   - Tous les segments doivent être dans la grille
 *   - Maximum 100 tentatives avant fallback
 *
 *   PROCESSUS :
 *   1. Génère position aléatoire (avec marge de 5 cellules des bords)
 *   2. Choisit direction aléatoire parmi : droite, bas, gauche, haut
 *   3. Crée 3 segments alignés dans la direction opposée (serpent "pousse" vers l'avant)
 *   4. Valide que tous les segments sont dans la grille
 *   5. Vérifie la distance minimale avec l'adversaire (si présent)
 *   6. Si échec après 100 tentatives → position prédéterminée (fallback)
 *
 *   FALLBACK :
 *   - Premier joueur : x = 7.5 (1/4 de la grille), y = 15 (centre), direction → droite
 *   - Deuxième joueur : x = 22.5 (3/4 de la grille), y = 15 (centre), direction → droite
 */
export function generateRandomSpawn(gridWidth, gridHeight, otherSnake) {
    // === Configuration des contraintes ===
    const initialLength = 3;    // Nombre de segments du serpent au départ
    const minDistance = 10;      // Distance minimale en cellules de l'autre serpent (Manhattan)
    const borderMargin = 5;      // Marge depuis les bords de la grille (évite les spawns aux coins)

    // === Variables de la boucle de tentatives ===
    let attempts = 0;            // Compteur de tentatives
    let validSpawn = false;      // Flag de validation
    let spawn = [];              // Array des positions {x, y} du serpent
    let direction = {x: 0, y: 0}; // Direction initiale

    // === Boucle de génération (max 100 tentatives) ===
    while (!validSpawn && attempts < 100) {
        // ÉTAPE 1 : Position aléatoire de la tête (avec marge)
        // Zone safe : [borderMargin, gridWidth - borderMargin]
        const x = Math.floor(Math.random() * (gridWidth - 2 * borderMargin)) + borderMargin;
        const y = Math.floor(Math.random() * (gridHeight - 2 * borderMargin)) + borderMargin;

        // ÉTAPE 2 : Direction initiale aléatoire
        // Index 0 = droite, 1 = bas, 2 = gauche, 3 = haut
        const dirIndex = Math.floor(Math.random() * 4);
        const directions = [
            {x: 1, y: 0},   // Droite →
            {x: 0, y: 1},   // Bas ↓
            {x: -1, y: 0},  // Gauche ←
            {x: 0, y: -1}   // Haut ↑
        ];
        direction = directions[dirIndex];

        // ÉTAPE 3 : Création des segments du serpent
        // Le serpent "pousse" dans sa direction, donc les segments sont créés
        // dans la direction opposée à partir de la tête
        // Ex: direction = droite → segments vont vers la gauche
        spawn = [];
        for (let i = 0; i < initialLength; i++) {
            spawn.push({
                x: x - (direction.x * i),  // Segment i est décalé dans le sens opposé
                y: y - (direction.y * i)
            });
        }
        // Résultat : spawn[0] = tête, spawn[1] = cou, spawn[2] = queue

        // ÉTAPE 4 : Validation - tous les segments dans la grille ?
        const allInGrid = spawn.every(segment =>
            segment.x >= 0 && segment.x < gridWidth &&
            segment.y >= 0 && segment.y < gridHeight
        );

        if (!allInGrid) {
            attempts++;
            continue;  // Tentative suivante
        }

        // ÉTAPE 5 : Validation - distance minimale de l'adversaire ?
        if (otherSnake && otherSnake.length > 0) {
            // Calcule la distance de Manhattan entre chaque segment et l'adversaire
            const tooClose = spawn.some(segment =>
                otherSnake.some(otherSegment => {
                    const manhattanDistance =
                        Math.abs(segment.x - otherSegment.x) +
                        Math.abs(segment.y - otherSegment.y);
                    return manhattanDistance < minDistance;
                })
            );
            validSpawn = !tooClose;  // Valide seulement si assez loin
        } else {
            validSpawn = true;  // Pas d'adversaire → toujours valide
        }

        attempts++;
    }

    // === FALLBACK : Position prédéterminée si échec après 100 tentatives ===
    if (!validSpawn) {
        console.warn("Could not find optimal spawn position, using fallback");

        // Position calculée selon la présence de l'autre joueur
        // Si otherSnake existe → spawn à 3/4 de la grille, sinon à 1/4
        const fallbackX = Math.floor(gridWidth / 4) + (otherSnake ? Math.floor(gridWidth / 2) : 0);
        const fallbackY = Math.floor(gridHeight / 2);
        direction = {x: 1, y: 0};  // Direction : droite →

        // Création du serpent horizontal (3 segments vers la gauche)
        spawn = [];
        for (let i = 0; i < initialLength; i++) {
            spawn.push({
                x: fallbackX - i,
                y: fallbackY
            });
        }
    }

    // === Retour du résultat ===
    return {
        snake: spawn,        // Array de 3 positions {x, y}
        direction: direction // Direction initiale {x, y}
    };
}
