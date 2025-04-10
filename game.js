const GameMode = Object.freeze({
    DAILY: Symbol("daily"),
    ENDLESS: Symbol("endless")
})

const gridSize = 6;
const startColor = "#808080";
const colors = ["#1E3A8A", "#F59E0B", "#2CBCA4", "#EF4444", "#A5158C", "#1D7C4D"];
let currentBaseColor = null;
let baseSquare = null;
let canClick = true;
let gameMode = GameMode.DAILY;
const rippleDelay = 50; // Delay in milliseconds for each layer of the ripple

const gridContainer = document.getElementById("grid");
const buttonsContainer = document.getElementById("buttons");
const moveCountDisplay = document.getElementById("moveCount");
const title = document.getElementById("title");

function loadHistoricData() {
    const data = localStorage.getItem("tileEffectGameData");

    if (!data) {
        return {
            gamesPlayed: 0,
            winPercentage: 0,
            currentStreak: 0,
            maxStreak: 0,
            guessDistribution: [0, 0, 0, 0, 0, 0], // Number of games solved on each guess attempt
            parScore: -1,
            actualScore: 0,
            lastPlayedDate: "2000-01-01",
        }
    }

    return JSON.parse(data);
}

const gameData = loadHistoricData();
moveCountDisplay.textContent = gameData.actualScore;

function saveHistoricalData() {
    localStorage.setItem("tileEffectGameData", JSON.stringify(gameData));
}

// Initialize the grid
function initGrid() {
    grid = [];
    gridContainer.innerHTML = '';

    let randomFunc;
    if (gameMode === GameMode.DAILY) {
        const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        randomFunc = seededRandom(date);

        // Attempt to load saved game state for Daily mode
        if (loadGameState()) {
            // Saved state was successfully loaded, so no need to initialize a new grid
            return;
        }

        // If false, we need to reset the score
        gameData.actualScore = 0;
        moveCountDisplay.textContent = "0";
        saveHistoricalData();
    } else {
        randomFunc = Math.random;
    }

    for (let i = 0; i < gridSize * gridSize; i++) {
        const square = document.createElement("div");
        square.classList.add("square");
        square.dataset.index = i;

        let colorIndex;
        if (i === gridSize * gridSize - gridSize) {
            colorIndex = -1; // Assign base tile to first color
            square.style.backgroundColor = colors[colorIndex];
            baseSquare = square;
            currentBaseColor = colorIndex;
        } else {
            colorIndex = Math.floor(randomFunc() * colors.length);
            square.style.backgroundColor = colors[colorIndex];
            square.dataset.colorIndex = colorIndex;
        }

        gridContainer.appendChild(square);
        grid.push(square);
    }

    if (gameMode == GameMode.DAILY) {
        handleSolve();
    }
}

// Initialize color buttons
function initButtons() {
    buttonsContainer.innerHTML = '';
    colors.forEach((color, index) => {
        const button = document.createElement("button");
        button.classList.add("color-button");
        button.style.backgroundColor = color;
        button.addEventListener("click", () => handleColorChange(index));
        buttonsContainer.appendChild(button);
    });
}

// Handle button click for changing colors
function handleColorChange(colorIndex) {
    if (canClick && colorIndex !== parseInt(baseSquare.dataset.colorIndex)) {
        canClick = false;
        gameData.actualScore++;
        moveCountDisplay.textContent = gameData.actualScore;
        rippleEffect(colorIndex);
    }
}

// Ripple effect to spread the new color with a visual delay
function rippleEffect(colorIndex) {
    const newColor = colors[colorIndex];
    const originalColorIndex = parseInt(baseSquare.dataset.colorIndex);

    let queue = [baseSquare];
    baseSquare.dataset.colorIndex = colorIndex;
    baseSquare.style.backgroundColor = newColor;
    let layer = 0;
    const visited = new Set(); // Track visited tiles
    visited.add(baseSquare.dataset.index);

    function processLayer() {
        if (queue.length === 0) {
            canClick = true;
            saveGameState();
            checkWinCondition();
            return;
        }

        const currentQueue = queue.slice();
        queue = [];
        
        currentQueue.forEach(square => {
            const neighbors = getNeighbors(parseInt(square.dataset.index));
            neighbors.forEach(neighbor => {
                if (!visited.has(neighbor.dataset.index) && parseInt(neighbor.dataset.colorIndex) === originalColorIndex) {
                    visited.add(neighbor.dataset.index);
                    neighbor.dataset.colorIndex = colorIndex;
                    neighbor.style.backgroundColor = newColor;
                    queue.push(neighbor);
                }
            });
        });

        setTimeout(processLayer, rippleDelay);
    }

    setTimeout(processLayer, rippleDelay);
}

// Get neighboring squares in the grid
function getNeighbors(index) {
    const neighbors = [];

    if (index % gridSize !== 0) neighbors.push(grid[index - 1]); // Left
    if ((index + 1) % gridSize !== 0) neighbors.push(grid[index + 1]); // Right
    if (index >= gridSize) neighbors.push(grid[index - gridSize]); // Up
    if (index < gridSize * (gridSize - 1)) neighbors.push(grid[index + gridSize]); // Down

    return neighbors;
}

function updateDailyStats() {
    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

    if (gameData.lastPlayedDate !== today) {
        gameData.gamesPlayed += 1;
        gameData.actualScore = parseInt(moveCountDisplay.textContent);
        const parScore = gameData.parScore;

        const guessIndex = Math.min(gameData.actualScore - parScore, 5);
        gameData.guessDistribution[guessIndex] += 1;

        gameData.currentStreak += 1;
        gameData.maxStreak = Math.max(gameData.maxStreak, gameData.currentStreak);
        gameData.winPercentage = Math.round((gameData.gamesPlayed === 0 ? 0 : (100 * gameData.guessDistribution.reduce((a, b) => a + b, 0) / gameData.gamesPlayed)));

        gameData.lastPlayedDate = today;
        saveHistoricalData();
    }
}

// Check if all squares are the same color
function checkWinCondition() {
    const targetColorIndex = parseInt(baseSquare.dataset.colorIndex);
    const allSameColor = grid.every(square => parseInt(square.dataset.colorIndex) === targetColorIndex);
    
    if (allSameColor) {
        if (gameMode == GameMode.DAILY) {
            updateDailyStats();
            showStatsPopup();
        } else {
            resetGame();
        }
    }
}

function resetGame() {
    let currentWave = [baseSquare]; // Start the ripple effect from the base square
    let visited = new Set([parseInt(baseSquare.dataset.index)]); // Track visited squares

    // Phase 1: Ripple to a neutral color (e.g., grey)
    const neutralColor = "#F0F0F0"; // Use a neutral color like light grey
    const interval1 = setInterval(() => {
        const nextWave = [];

        currentWave.forEach(square => {
            square.style.backgroundColor = neutralColor;
            square.dataset.colorIndex = -1; // Temporary index for neutral color

            // Get neighbors and add to the next wave if not visited
            const index = parseInt(square.dataset.index);
            const neighbors = getNeighbors(index);
            neighbors.forEach(neighbor => {
                const neighborIndex = parseInt(neighbor.dataset.index);
                if (!visited.has(neighborIndex)) {
                    visited.add(neighborIndex);
                    nextWave.push(neighbor);
                }
            });
        });

        if (nextWave.length === 0) {
            clearInterval(interval1);

            // Start Phase 2 once Phase 1 completes
            setTimeout(() => rippleToRandomColors(), 200);
        } else {
            currentWave = nextWave;
        }
    }, rippleDelay); // Adjust the delay for desired ripple speed

    // Phase 2: Ripple to random colors
    function rippleToRandomColors() {
        currentWave = [baseSquare]; // Reset to start the second ripple from base square
        visited = new Set([parseInt(baseSquare.dataset.index)]);

        const targetColors = Array.from({ length: gridSize * gridSize }, () => Math.floor(Math.random() * colors.length));

        const interval2 = setInterval(() => {
            const nextWave = [];

            currentWave.forEach(square => {
                const index = parseInt(square.dataset.index);

                if (index == gridSize * gridSize - gridSize) {
                    square.style.backgroundColor = startColor;
                    square.dataset.colorIndex = -1;
                } else {
                    const targetColorIndex = targetColors[index];
                    square.style.backgroundColor = colors[targetColorIndex];
                    square.dataset.colorIndex = targetColorIndex;
                }

                // Get neighbors and add to the next wave if not visited
                const neighbors = getNeighbors(index);
                neighbors.forEach(neighbor => {
                    const neighborIndex = parseInt(neighbor.dataset.index);
                    if (!visited.has(neighborIndex)) {
                        visited.add(neighborIndex);
                        nextWave.push(neighbor);
                    }
                });
            });

            if (nextWave.length === 0) {
                clearInterval(interval2);
                canClick = true; // Allow user interactions again
            } else {
                currentWave = nextWave;
            }
        }, rippleDelay); // Adjust delay for ripple speed
    }
}


// GameState class
class GameState {
    constructor(grid, width, movesToMake, moveSequence) {
        this.grid = JSON.parse(JSON.stringify(grid)); // Deep copy of the grid
        this.width = width;
        this.movesToMake = movesToMake;
        this.claimedColour = grid[width - 1][0];
        this.claimed = this.getClaimedTiles();
        this.coloursRemaining = this.getColoursRemaining();
        this.moveSequence = [...moveSequence]; // Copy the move sequence
    }

    // Returns the number of tiles claimed in this state
    getClaimedTileCount() {
        return this.claimed.size;
    }

    // Generates possible next states by changing to each available color
    getChildren(numColours) {
        const children = [];
        for (let color = 0; color < numColours; color++) {
            if (color !== this.claimedColour) {
                children.push(this.changeColor(color));
            }
        }
        return children;
    }

    // Checks if all tiles have been claimed (winning condition)
    hasWon() {
        return this.getClaimedTileCount() === this.width * this.width;
    }

    // Changes color for this game state and returns a new game state
    changeColor(color) {
        const newGrid = JSON.parse(JSON.stringify(this.grid)); // Deep copy
        this.claimed.forEach(index => {
            newGrid[Math.floor(index / this.width)][index % this.width] = color;
        });

        const newMoveSequence = [...this.moveSequence, color];
        return new GameState(newGrid, this.width, this.movesToMake + 1, newMoveSequence);
    }

    // Calculates claimed tiles starting from the bottom left
    getClaimedTiles() {
        const claimed = new Set();
        const toVisit = [this.width * this.width - this.width]; // Start from bottom-left

        while (toVisit.length) {
            const index = toVisit.pop();
            if (!claimed.has(index)) {
                claimed.add(index);

                // Add neighboring tiles that match the claimed color
                const neighbors = this.getNeighbors(index);
                neighbors.forEach(neighbor => {
                    if (
                        !claimed.has(neighbor) &&
                        this.grid[Math.floor(neighbor / this.width)][neighbor % this.width] === this.claimedColour
                    ) {
                        toVisit.push(neighbor);
                    }
                });
            }
        }
        return claimed;
    }

    // Calculates remaining unique colors
    getColoursRemaining() {
        const uniqueColors = new Set();
        for (let row = 0; row < this.width; row++) {
            for (let col = 0; col < this.width; col++) {
                uniqueColors.add(this.grid[row][col]);
            }
        }
        return uniqueColors.size - 1; // Exclude the claimed color
    }

    // Heuristic for determining optimal move ordering
    heuristicDistance() {
        return this.movesToMake + this.coloursRemaining;
    }

    // Compares two game states based on heuristic distance
    static compare(a, b) {
        return a.heuristicDistance() - b.heuristicDistance();
    }

    // Retrieves neighboring indices for a given tile index
    getNeighbors(index) {
        const neighbors = [];
        const row = Math.floor(index / this.width);
        const col = index % this.width;

        if (col > 0) neighbors.push(index - 1); // Left
        if (col < this.width - 1) neighbors.push(index + 1); // Right
        if (row > 0) neighbors.push(index - this.width); // Up
        if (row < this.width - 1) neighbors.push(index + this.width); // Down

        return neighbors;
    }
}

// Solver function to find the optimal sequence of color changes
function solveGame(grid, gridSize, numColours) {
    const initialState = new GameState(grid, gridSize, 0, []);
    const openSet = [initialState];
    const closedSet = new Set();

    while (openSet.length > 0) {
        // Sort openSet by heuristic distance
        openSet.sort(GameState.compare);
        const currentState = openSet.shift();

        // Check if current state has already been processed
        const stateKey = JSON.stringify(currentState.grid);
        if (closedSet.has(stateKey)) continue;

        // Check win condition
        if (currentState.hasWon()) {
            // console.log(`Moves to win: ${currentState.movesToMake} [${currentState.moveSequence.join(", ")}]`);
            return currentState.moveSequence; // Return the optimal sequence
        }

        // Expand children and add to openSet if valid
        const children = currentState.getChildren(numColours);
        children.forEach(child => {
            const childStateKey = JSON.stringify(child.grid);
            if (!closedSet.has(childStateKey)) {
                openSet.push(child);
            }
        });

        closedSet.add(stateKey);
    }

    console.log("No solution found.");
    return [];
}

// Async solver function to prevent blocking the UI
async function solveGameAsync(grid, gridSize, numColours) {
    const initialState = new GameState(grid, gridSize, 0, []);
    const openSet = [initialState];
    const closedSet = new Set();

    while (openSet.length > 0) {
        // Sort openSet by heuristic distance
        openSet.sort(GameState.compare);
        const currentState = openSet.shift();

        // Check if current state has already been processed
        const stateKey = JSON.stringify(currentState.grid);
        if (closedSet.has(stateKey)) continue;

        // Check win condition
        if (currentState.hasWon()) {
            // console.log(`Moves to win: ${currentState.movesToMake} [${currentState.moveSequence.join(", ")}]`);
            return currentState.moveSequence; // Return the optimal sequence
        }

        // Expand children and add to openSet if valid
        const children = currentState.getChildren(numColours);
        children.forEach(child => {
            const childStateKey = JSON.stringify(child.grid);
            if (!closedSet.has(childStateKey)) {
                openSet.push(child);
            }
        });

        closedSet.add(stateKey);

        // Yield control to prevent blocking
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    console.log("No solution found.");
    return [];
}

// Solver function when the "Solve" button is clicked
async function handleSolve() {
    // Convert the game grid from DOM elements to a grid of color indices
    const gridArray = Array.from(Array(gridSize), () => Array(gridSize).fill(0));
    for (let i = 0; i < gridSize * gridSize; i++) {
        const row = Math.floor(i / gridSize);
        const col = i % gridSize;
        gridArray[row][col] = parseInt(grid[i].dataset.colorIndex);
    }

    const solution = await solveGameAsync(gridArray, gridSize, colors.length);

    if (solution.length > 0) {
        gameData.parScore = solution.length;
        // console.log(`Optimal number of moves: ${solution.length}`);
        // console.log(`Optimal move sequence: [${solution.join(", ")}]`);
    } else {
        console.log("No solution found.");
    }
}

// Function to open and populate the stats popup
function showStatsPopup() {
    // Populate new score stats
    document.getElementById("parScore").textContent = gameData.parScore;
    document.getElementById("actualScore").textContent = gameData.actualScore;

    // Populate main stats
    document.getElementById("gamesPlayed").textContent = gameData.gamesPlayed;
    document.getElementById("winPercentage").textContent = gameData.winPercentage;
    document.getElementById("currentStreak").textContent = gameData.currentStreak;
    document.getElementById("maxStreak").textContent = gameData.maxStreak;

    // Populate guess distribution chart
    const distributionChart = document.getElementById("guessDistribution");
    distributionChart.innerHTML = ''; // Clear previous bars

    const total = gameData.guessDistribution.reduce((a, b) => a + b, 0);

    gameData.guessDistribution.forEach((count, index) => {
        const barContainer = document.createElement("div");
        barContainer.style.display = 'flex';
        barContainer.style.alignItems = 'center';
        barContainer.style.marginBottom = '4px';

        const label = document.createElement("span");
        label.classList.add("distribution-bar-count");
        label.style.width = '20px';
        label.style.marginRight = '6px';
        label.textContent = index < 5 ? index : "5+"; // Label for guess count

        const bar = document.createElement("div");
        bar.classList.add("distribution-bar");

        // Calculate percentage width
        const percent = total === 0 ? 0 : (count / total) * 100;
        bar.style.width = `${percent}%`;
        bar.style.minWidth = '2px'; // So it's not invisible if small
        bar.style.height = '24px';
        bar.style.backgroundColor = colors[index];
        bar.style.color = 'white';
        bar.style.textAlign = 'right';
        bar.style.paddingRight = '6px';
        bar.style.lineHeight = '24px';
        bar.style.borderRadius = '4px';

        bar.textContent = count > 0 ? count : '';

        barContainer.appendChild(label);
        barContainer.appendChild(bar);
        distributionChart.appendChild(barContainer);
    });

    // Show the popup
    document.getElementById("statsPopup").classList.remove("hidden");
}

// Function to close the stats popup
function closePopup() {
    document.getElementById("statsPopup").classList.add("hidden");
    startEndless();
}

function startDaily() {
    gameMode = GameMode.DAILY;
    document.getElementById("moveBlock").style.opacity = 1;
    initGrid();
    initButtons();
    hideMenu();
}

function startEndless() {
    gameMode = GameMode.ENDLESS;
    document.getElementById("moveBlock").style.opacity = 0;
    initGrid();
    initButtons();
    hideMenu();
}

function hideMenu() {
    document.getElementById("mainMenu").style.display = "none";
}

function seededRandom(seed) {
    // ChatGPT random function - doesn't actually need to be random, just needs to generate
    // a different function per day
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    return function() {
        hash = (hash * 9301 + 49297) % 233280;
        return hash / 233280;
    };
}

function saveGameState() {
    if (gameMode !== GameMode.DAILY) {
        return;
    }

    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const gridState = grid.map(square => parseInt(square.dataset.colorIndex));
    const gameState = {
        date,
        gridState,
    };

    localStorage.setItem('tileEffectDailyState', JSON.stringify(gameState));
    saveHistoricalData();
}

function loadGameState() {
    const savedState = localStorage.getItem("tileEffectDailyState");
    if (!savedState) {
        return false; // No saved state, so initialize a new game
    }

    // Parse the saved state
    const gameState = JSON.parse(savedState);

    if (gameState.date !== new Date().toISOString().slice(0, 10)) {
        return false;
    }

    for (let i = 0; i < gridSize * gridSize; i++) {
        const square = document.createElement("div");
        square.classList.add("square");
        square.dataset.index = i;

        let colorIndex = gameState.gridState[i];
        square.style.backgroundColor = colorIndex >= 0 ? colors[colorIndex] : startColor;
        square.dataset.colorIndex = colorIndex;

        gridContainer.appendChild(square);
        grid.push(square);

        if (i == gridSize * gridSize - gridSize) {
            baseSquare = square;
        }
    }

    checkWinCondition();

    return true; // Successfully loaded the game state
}

function clearSave() {
    localStorage.removeItem('tileEffectDailyState'); 
    localStorage.removeItem("tileEffectGameData");
}

function setMenuColours() {
    squares = document.getElementById("menu-grid");
    Array.from(squares.children).forEach((child, index) => {
        child.style.backgroundColor = colors[index];
    })
}

function setFullHeight() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}

// Call it on load and resize
window.addEventListener('load', setFullHeight);
window.addEventListener('resize', setFullHeight);

setMenuColours()
