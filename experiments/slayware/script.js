/**
 * SlayWare - Web adaptation of Slay
 * Final Version: Rules.txt Sync (Movement, Timing, Visuals)
 */

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const logContainer = document.getElementById('event-log');
const playerIndicator = document.getElementById('player-indicator');

// --- Constants & Config ---
const HEX_SIZE = 28;
const PLAYER_COLORS = {
    0: { border: '#444', fill: '#2d333b', name: 'Neutral', bg: '#2d333b' },
    1: { border: '#991b1b', fill: '#f87171', name: 'Red', bg: '#7f1d1d' },
    2: { border: '#1e40af', fill: '#60a5fa', name: 'Blue', bg: '#1e3a8a' },
    3: { border: '#166534', fill: '#4ade80', name: 'Green', bg: '#14532d' },
    4: { border: '#854d0e', fill: '#facc15', name: 'Yellow', bg: '#713f12' },
    5: { border: '#581c87', fill: '#c084fc', name: 'Purple', bg: '#581c87' },
    6: { border: '#7c2d12', fill: '#fb923c', name: 'Orange', bg: '#7c2d12' }
};

// --- Perlin Noise Implementation (Simplified) ---
const PERLIN_YWRAPB = 4; const PERLIN_YWRAP = 1 << PERLIN_YWRAPB;
const PERLIN_ZWRAPB = 8; const PERLIN_ZWRAP = 1 << PERLIN_ZWRAPB;
const PERLIN_SIZE = 4095;
let perlin_xi, perlin_yi, perlin_zi, perlin_xf, perlin_yf, perlin_zf;
let perlin_p = new Array(PERLIN_SIZE + 1).fill(0).map(() => Math.random());
let perlin_per = new Array(PERLIN_SIZE + 1);
for (let i = 0; i < PERLIN_SIZE + 1; i++) perlin_per[i] = Math.floor(Math.random() * 256);

function noise(x, y, z) {
    if (y == null) y = 0; if (z == null) z = 0;
    x = Math.abs(x); y = Math.abs(y); z = Math.abs(z);
    perlin_xi = Math.floor(x); perlin_yi = Math.floor(y); perlin_zi = Math.floor(z);
    perlin_xf = x - perlin_xi; perlin_yf = y - perlin_yi; perlin_zf = z - perlin_zi;
    let rxf, ryf;
    let r = 0, ampl = 0.5, n1, n2, n3;
    for (let o = 0; o < 2; o++) {
        let of = perlin_xi + (perlin_yi << PERLIN_YWRAPB) + (perlin_zi << PERLIN_ZWRAPB);
        rxf = perlin_xf; ryf = perlin_yf;
        n1 = perlin_per[of & PERLIN_SIZE];
        n1 += rxf * (perlin_per[(of + 1) & PERLIN_SIZE] - n1);
        n2 = perlin_per[(of + PERLIN_YWRAP) & PERLIN_SIZE];
        n2 += rxf * (perlin_per[(of + PERLIN_YWRAP + 1) & PERLIN_SIZE] - n2);
        n1 += ryf * (n2 - n1);
        of += PERLIN_ZWRAP;
        n2 = perlin_per[of & PERLIN_SIZE];
        n2 += rxf * (perlin_per[(of + 1) & PERLIN_SIZE] - n2);
        n3 = perlin_per[(of + PERLIN_YWRAP) & PERLIN_SIZE];
        n3 += rxf * (perlin_per[(of + PERLIN_YWRAP + 1) & PERLIN_SIZE] - n3);
        n2 += ryf * (n3 - n2);
        r += n1 + perlin_zf * (n2 - n1);
        ampl *= 0.5;
        perlin_xi <<= 1; perlin_xf *= 2; perlin_yi <<= 1; perlin_yf *= 2; perlin_zi <<= 1; perlin_zf *= 2;
        if (perlin_xf >= 1.0) { perlin_xi++; perlin_xf--; }
        if (perlin_yf >= 1.0) { perlin_yi++; perlin_yf--; }
        if (perlin_zf >= 1.0) { perlin_zi++; perlin_zf--; }
    }
    return r;
}


const UNIT_COSTS = { peasant: 10, spearman: 20, knight: 30, baron: 40, castle: 15 };
const UNIT_DESCRIPTIONS = {
    peasant: { desc: "Weakest unit but cheap. Can take unprotected tiles and cut down trees.", wage: 2 },
    spearman: { desc: "Stronger than peasants. Good for holding lines and taking capitals.", wage: 6 },
    knight: { desc: "Stronger than peasants and spearmen. Can also take castles.", wage: 18 },
    baron: { desc: "The ultimate unit. Dominates but expensive.", wage: 54 },
    castle: { desc: "Defensive structure. Protects territory from peasants and spearmen.", wage: 0 }
};
const WAGES = { peasant: 2, spearman: 6, knight: 18, baron: 54 };
const STRENGTHS = { peasant: 1, spearman: 2, knight: 3, baron: 4, castle: 2, capital: 1 };
const MERGE_MAP = {
    'peasant+peasant': 'spearman', 'peasant+spearman': 'knight', 'spearman+peasant': 'knight',
    'spearman+spearman': 'baron', 'peasant+knight': 'baron', 'knight+peasant': 'baron'
};

const MAP_DEFINITIONS = {
    random: { name: "Random Blob", icon: "fa-dice", desc: "Classic procedurally generated island.", type: 'random', size: 7 },
    big_hex: { name: "Big Hex", icon: "fa-vector-square", desc: "A perfectly symmetrical large hexagon.", type: 'hex', size: 9 },
    small_hex: { name: "Small Hex", icon: "fa-cube", desc: "A tighter, quicker skirmish map.", type: 'hex', size: 5 },
    westeros: {
        name: "Westeros", icon: "fa-dragon", desc: "The Seven Kingdoms.", type: 'ascii',
        get data() { return window.MAP_DATA_WESTEROS || []; }
    },
    earth_sm: {
        name: "Small Earth", icon: "fa-globe", desc: "A smaller world map.", type: 'ascii',
        get data() { return window.MAP_DATA_EARTH_SM || []; }
    },
    earth: {
        name: "Earth", icon: "fa-globe-americas", desc: "A rough approximation of the world.", type: 'ascii',
        get data() { return window.MAP_DATA_EARTH || []; }
    }
};

class Hex {
    constructor(q, r) { this.q = q; this.r = r; }
    get s() { return -this.q - this.r; }
    add(other) { return new Hex(this.q + other.q, this.r + other.r); }
    scale(k) { return new Hex(this.q * k, this.r * k); }
    toString() { return `${this.q},${this.r}`; }
    static directions = [new Hex(1, 0), new Hex(1, -1), new Hex(0, -1), new Hex(-1, 0), new Hex(-1, 1), new Hex(0, 1)];
    toPixel() {
        return {
            x: HEX_SIZE * (3 / 2 * this.q),
            y: HEX_SIZE * (Math.sqrt(3) / 2 * this.q + Math.sqrt(3) * this.r)
        };
    }
    getNeighbors() { return Hex.directions.map(dir => this.add(dir)); }
}

class MapCell {
    constructor(hex, playerId = 0) {
        this.hex = hex; this.playerId = playerId;
        this.unit = null; this.building = null; this.tree = null;
        this.hasMoved = false; this.isGravestone = false;
        this.oldTerritoryId = null; this.territoryId = null;
    }
    getStrength() {
        if (this.unit) return STRENGTHS[this.unit];
        if (this.building === 'castle') return STRENGTHS.castle;
        if (this.building === 'capital') return STRENGTHS.capital;
        return 0;
    }
}

class Territory {
    constructor(id, playerId) { this.id = id; this.playerId = playerId; this.cells = []; this.money = 0; }
    getIncome() { return this.cells.filter(c => !c.tree && !c.isGravestone).length; }
    getWages() { return this.cells.reduce((sum, c) => sum + (c.unit ? WAGES[c.unit] : 0), 0); }
    getNet() { return this.getIncome() - this.getWages(); }
}

const state = {
    grid: new Map(), players: [], currentPlayerIdx: 0,
    camera: { x: 0, y: 0, zoom: 1, isDragging: false, startX: 0, startY: 0 }, territories: new Map(),
    selectedCell: null, activeTerritoryId: null, shopSelected: null,
    turn: 1, gameStarted: false, gameOver: false,
    validTargets: new Set(),
    renderLoopId: null, // Track the animation frame ID
    bgSprites: [],
    waterSprite: null
};

// --- Initialization & Setup ---
function setup() {
    let humanCount = 1; let totalCount = 6;
    const countBtns = document.querySelectorAll('.count-btn');
    const totalBtns = document.querySelectorAll('.total-btn');
    countBtns.forEach(btn => btn.addEventListener('click', () => {
        countBtns.forEach(b => b.classList.remove('active')); btn.classList.add('active'); humanCount = parseInt(btn.dataset.humans);
    }));
    totalBtns.forEach(btn => btn.addEventListener('click', () => {
        totalBtns.forEach(b => b.classList.remove('active')); btn.classList.add('active'); totalCount = parseInt(btn.dataset.total);
    }));
    document.getElementById('start-game-btn').addEventListener('click', () => {
        if (humanCount > totalCount) { alert("Humans cannot exceed total players!"); return; }
        startGame(humanCount, totalCount);
    });


    setupMapSelection();
}

function setupMapSelection() {
    const btn = document.getElementById('select-map-btn');
    const modal = document.getElementById('map-modal');
    const close = document.getElementById('close-map-modal');
    const list = document.getElementById('map-list');
    const selectedName = document.getElementById('selected-map-name');
    const selectedInput = document.getElementById('selected-map-id');

    const sliderGroup = document.getElementById('map-size-group');
    const slider = document.getElementById('map-size-slider');
    const sliderDisplay = document.getElementById('map-size-display');

    // Toggle slider visibility
    const updateSliderVisibility = (key) => {
        if (key === 'random') sliderGroup.classList.remove('hidden');
        else sliderGroup.classList.add('hidden');
    };

    // Initial check
    updateSliderVisibility(selectedInput.value);

    // Slider Value Update
    slider.addEventListener('input', (e) => {
        sliderDisplay.textContent = `${e.target.value} Hexes`;
    });

    btn.addEventListener('click', () => {
        // Populate list
        list.innerHTML = '';
        Object.entries(MAP_DEFINITIONS).forEach(([key, map]) => {
            const card = document.createElement('div');
            card.className = `map-card ${selectedInput.value === key ? 'active' : ''}`;
            card.innerHTML = `
                <i class="fas ${map.icon}"></i>
                <h4>${map.name}</h4>
                <p>${map.desc}</p>
            `;
            card.addEventListener('click', () => {
                selectedInput.value = key;
                selectedName.textContent = map.name;
                updateSliderVisibility(key); // Update Visibility
                modal.classList.add('hidden');
                document.querySelectorAll('.map-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
            });
            list.appendChild(card);
        });
        modal.classList.remove('hidden');
    });



    // Initial Load of Textures (Players + Background + Water)
    const playerTextures = 6;
    const bgTextures = ['bg_tile_1.png', 'bg_tile_2.png', 'bg_tile_3.png'];

    const totalTextures = playerTextures + bgTextures.length + 3 + playerTextures + 1 + playerTextures + 4 + (playerTextures * 4); // +4 units defaults, +24 player units
    let loadedCount = 0;
    state.playerSprites = {};

    const checkLoad = () => {
        loadedCount++;
        if (loadedCount === totalTextures) render();
    };

    const waterImg = new Image();
    waterImg.src = 'assets/water_tile.png';
    waterImg.onload = () => {
        state.waterSprite = waterImg;
        state.playerSprites[0] = waterImg; // Assign to Neutral/Ocean for rendering
        checkLoad();
        startRenderLoop();
    };
    waterImg.onerror = checkLoad; // Proceed even if fails

    // Load Tree (User provided)
    const treeImg = new Image();
    treeImg.src = 'assets/tree.png';
    treeImg.onload = () => { state.treeSprite = treeImg; checkLoad(); };
    treeImg.onerror = checkLoad;

    // Load Capital (Default)
    const capitalImg = new Image();
    capitalImg.src = 'assets/capital.png';
    capitalImg.onload = () => { state.capitalSprite = capitalImg; checkLoad(); };
    capitalImg.onerror = checkLoad;

    // Load Player-Specific Capitals (Optional)
    state.capitalSprites = {};
    for (let i = 1; i <= playerTextures; i++) {
        const tex = new Image();
        tex.src = `assets/capital_${i}.png`;
        tex.onload = () => { state.capitalSprites[i] = tex; checkLoad(); };
        tex.onerror = checkLoad; // Count anyway so we don't hang
    }

    // Load Castle (Default)
    const castleImg = new Image();
    castleImg.src = 'assets/castle.png';
    castleImg.onload = () => { state.castleSprite = castleImg; checkLoad(); };
    castleImg.onerror = checkLoad;

    // Load Player-Specific Castles
    state.castleSprites = {};
    for (let i = 1; i <= playerTextures; i++) {
        const tex = new Image();
        tex.src = `assets/castle_${i}.png`;
        tex.onload = () => { state.castleSprites[i] = tex; checkLoad(); };
        tex.onerror = checkLoad;
    }

    // Load Unit Sprites (Default)
    state.unitSprites = {};
    const unitTypes = ['peasant', 'spearman', 'knight', 'baron'];
    unitTypes.forEach(u => {
        const img = new Image();
        img.src = `assets/${u}.png`;
        img.onload = () => { state.unitSprites[u] = img; checkLoad(); };
        img.onerror = checkLoad;
    });

    // Load Player-Specific Unit Sprites
    state.playerUnitSprites = {};
    for (let i = 1; i <= playerTextures; i++) {
        state.playerUnitSprites[i] = {};
        unitTypes.forEach(u => {
            const img = new Image();
            img.src = `assets/${u}_${i}.png`;
            img.onload = () => { state.playerUnitSprites[i][u] = img; checkLoad(); };
            img.onerror = checkLoad; // Proceed if missing (fallback to default)
        });
    }


    // Load Player Sprites
    for (let i = 1; i <= playerTextures; i++) {
        const tex = new Image();
        tex.src = `assets/tile_${i}.png`;
        tex.onload = checkLoad;
        state.playerSprites[i] = tex;
    }

    // Load Background Sprites
    state.bgSprites = [];
    bgTextures.forEach(file => {
        const img = new Image();
        img.src = `assets/${file}`;
        img.onload = checkLoad;
        state.bgSprites.push(img);
    });

    close.addEventListener('click', () => modal.classList.add('hidden'));
    window.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
}

function startGame(humans, total) {
    const mapId = document.getElementById('selected-map-id').value || 'random';
    state.players = [];
    for (let i = 1; i <= total; i++) state.players.push({ id: i, type: i <= humans ? 'human' : 'ai' });
    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('game-ui').classList.remove('hidden');

    // Initial Resize to set correct dimensions including DPI
    handleResize();

    // Initial Resize to set correct dimensions including DPI
    handleResize();

    generateIsland(total, mapId);
    refreshTerritories();

    state.gameStarted = true;

    centerCamera();
    setupGameEvents();
    initLeaderboard();

    startTurn(); render(); updateUI();
}

function initLeaderboard() {
    const container = document.getElementById('players-container');
    container.innerHTML = '';
    state.players.forEach(p => {
        const row = document.createElement('div');
        row.className = `player-row player-row-${p.id}`;
        row.id = `p-row-${p.id}`;

        const icon = document.createElement('div');
        icon.className = 'player-icon';
        icon.style.backgroundImage = `url('assets/tile_${p.id}.png')`;
        icon.innerHTML = p.type === 'human' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';

        const barContainer = document.createElement('div');
        barContainer.className = 'wealth-bar-container';

        const bar = document.createElement('div');
        bar.className = 'wealth-bar';
        bar.id = `p-bar-${p.id}`;
        bar.style.setProperty('--player-color', PLAYER_COLORS[p.id].fill);

        barContainer.appendChild(bar);
        row.appendChild(icon);
        row.appendChild(barContainer);
        container.appendChild(row);
    });
}

// Flag to prevent duplicate listeners
let gameEventsSetup = false;

function setupGameEvents() {
    if (gameEventsSetup) return;
    gameEventsSetup = true;

    window.addEventListener('resize', handleResize);
    document.getElementById('end-turn-btn').addEventListener('click', endTurn);

    // Mouse Events for Pan/Zoom
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // ... rest of events
    const modal = document.getElementById('help-modal');
    const gameOverModal = document.getElementById('game-over-modal');
    document.getElementById('help-btn').addEventListener('click', () => modal.classList.remove('hidden'));
    document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', () => {
        modal.classList.add('hidden');
        document.getElementById('map-modal').classList.add('hidden');
    }));
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });

    document.getElementById('restart-btn').addEventListener('click', restartGame);
    document.getElementById('quit-btn').addEventListener('click', restartGame);

    // Shop Button Logic
    const tooltip = document.getElementById('shop-tooltip');

    document.querySelectorAll('.shop-item').forEach(btn => {
        // Tooltip Listeners
        btn.addEventListener('mouseenter', (e) => {
            const unit = btn.dataset.unit;
            const info = UNIT_DESCRIPTIONS[unit];
            const cost = UNIT_COSTS[unit];
            if (!info) return;

            tooltip.innerHTML = `
                <h4>${unit}</h4>
                <p>${info.desc}</p>
                <div class="stats">
                    <div class="stat-row cost">Price: ${cost}<img src="assets/coin.png" class="coin-icon"></div>
                    <div class="stat-row wage">Wage: -${info.wage}<img src="assets/coin.png" class="coin-icon"></div>
                </div>
            `;
            tooltip.classList.remove('hidden');
        });

        btn.addEventListener('mousemove', (e) => {
            const padding = 15;
            let left = e.clientX + padding;
            let top = e.clientY + padding;

            // Check right edge
            if (left + tooltip.offsetWidth > window.innerWidth) {
                left = e.clientX - tooltip.offsetWidth - padding;
            }

            // Check bottom edge
            if (top + tooltip.offsetHeight > window.innerHeight) {
                top = e.clientY - tooltip.offsetHeight - padding;
            }

            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
        });

        btn.addEventListener('mouseleave', () => {
            tooltip.classList.add('hidden');
        });

        btn.addEventListener('click', (e) => {
            if (state.players[state.currentPlayerIdx].type !== 'human') return;
            const unit = btn.dataset.unit;

            // Toggle logic
            if (state.shopSelected === unit) {
                resetShopSelection();
                logEvent("Action canceled.");
            } else {
                // Select new
                document.querySelectorAll('.shop-item').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                state.shopSelected = unit;
                state.selectedCell = null;

                // Update Cursor Follower
                const cursorFollower = document.getElementById('cursor-follower');
                cursorFollower.style.display = 'block';
                cursorFollower.innerHTML = ''; // Clear previous content

                // Show texture if available
                if (['peasant', 'spearman', 'knight', 'baron'].includes(unit)) {
                    const pId = state.players[state.currentPlayerIdx].id;
                    const pSprites = state.playerUnitSprites && state.playerUnitSprites[pId];
                    const specificSprite = pSprites && pSprites[unit];
                    const defaultSprite = state.unitSprites && state.unitSprites[unit];
                    const sprite = (specificSprite && specificSprite.complete && specificSprite.naturalWidth !== 0) ? specificSprite : defaultSprite;

                    if (sprite) {
                        const img = sprite.cloneNode();
                        img.style.width = '40px'; img.style.height = 'auto';
                        cursorFollower.appendChild(img);
                    } else {
                        // Fallback icon
                        const icons = { peasant: '👨', spearman: '🛡️', knight: '🏇', baron: '👑' };
                        cursorFollower.textContent = icons[unit];
                    }
                } else if (unit === 'castle') {
                    const pId = state.players[state.currentPlayerIdx].id;
                    const sprite = state.castleSprites[pId] || state.castleSprite;
                    const img = sprite.cloneNode();
                    img.style.width = '50px'; img.style.height = 'auto';
                    cursorFollower.appendChild(img);
                } else {
                    const icons = { peasant: '👨', spearman: '🛡️', knight: '🏇', baron: '👑', castle: '🏰' };
                    cursorFollower.textContent = icons[unit];
                }
                // Initial position
                cursorFollower.style.left = `${e.clientX}px`;
                cursorFollower.style.top = `${e.clientY}px`;

                updateValidTargets();
                logEvent(`Selected ${state.shopSelected}. Click your territory to place.`);
            }
        });
    });
}

function resetShopSelection() {
    state.shopSelected = null;
    state.validTargets.clear();
    document.querySelectorAll('.shop-item').forEach(b => b.classList.remove('selected'));
    document.getElementById('cursor-follower').style.display = 'none';
}

function handleResize() {
    const parent = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    // Set actual size in memory (scaled to account for extra pixel density)
    canvas.width = parent.offsetWidth * dpr;
    canvas.height = parent.offsetHeight * dpr;

    // Normalize coordinate system to use css pixels
    ctx.scale(dpr, dpr);

    // Maintain CSS size
    canvas.style.width = `${parent.offsetWidth}px`;
    canvas.style.height = `${parent.offsetHeight}px`;

    centerCamera();
    render();
}

function generateIsland(totalPlayers, mapType = 'random', forcedSize = null) {
    let allHexes = [];
    const config = MAP_DEFINITIONS[mapType] || MAP_DEFINITIONS.random;

    if (config.type === 'hex') {
        const size = config.size;
        for (let q = -size; q <= size; q++) {
            for (let r = -size; r <= size; r++) {
                if (Math.abs(q + r) <= size) allHexes.push(new Hex(q, r));
            }
        }
    } else if (config.type === 'random') {
        // Blob Algorithm
        // Read slider value if available, formatted as int
        const sliderVal = document.getElementById('map-size-slider');
        const targetCount = forcedSize ? forcedSize : (sliderVal ? parseInt(sliderVal.value) : (config.size * config.size * 3)); // Default fallback

        const center = new Hex(0, 0);
        allHexes.push(center);
        const addedHashes = new Set([center.toString()]);
        const frontier = center.getNeighbors();

        while (allHexes.length < targetCount && frontier.length > 0) {
            // Pick random extension point
            const idx = Math.floor(Math.random() * frontier.length);
            const candidate = frontier[idx];

            // Remove efficiently
            frontier[idx] = frontier[frontier.length - 1];
            frontier.pop();

            if (addedHashes.has(candidate.toString())) continue;

            addedHashes.add(candidate.toString());
            allHexes.push(candidate);

            // Add new neighbors
            candidate.getNeighbors().forEach(n => {
                if (!addedHashes.has(n.toString())) {
                    frontier.push(n);
                }
            });
        }
    } else if (config.type === 'ascii') {
        allHexes = parseAsciiMap(config.data);
    }

    // 1. Calculate fair quotas
    const totalCells = allHexes.length;
    const tilesPerPlayer = Math.floor(totalCells / totalPlayers);
    const treesPerPlayer = Math.floor(tilesPerPlayer * 0.2); // 20% trees
    const remainder = totalCells % totalPlayers;

    // 2. Create a "Deck" of fairness
    let deck = [];
    for (let p = 1; p <= totalPlayers; p++) {
        for (let i = 0; i < tilesPerPlayer; i++) {
            deck.push({ playerId: p, tree: i < treesPerPlayer ? 'pine' : null });
        }
    }

    // 3. Handle remainders
    for (let i = 0; i < remainder; i++) {
        const p = (i % totalPlayers) + 1;
        deck.push({ playerId: p, tree: null });
    }

    // 4. Shuffle hexes
    for (let i = allHexes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allHexes[i], allHexes[j]] = [allHexes[j], allHexes[i]];
    }

    // 5. Assign
    // Clear hexes array if we are regenerating
    state.hexes = [];

    // 5. Assign
    allHexes.forEach((hex, index) => {
        if (index < deck.length) {
            const info = deck[index];
            const cell = new MapCell(hex, info.playerId);
            cell.tree = info.tree;
            state.grid.set(hex.toString(), cell);
            state.hexes.push(cell); // Sync array for render loop
        }
    });
}


function parseAsciiMap(lines) {
    // Basic "pointy top" hex layout from ASCII chart
    // Offset coordinates to Axial
    // Using "odd-r" offset equivalent logic or just direct mapping
    // To keep it simple: We treat (col, row) -> convert to axial
    // Hex grid (pointy):
    // Row 0:  0,0  1,0  2,0
    // Row 1: 0,1  1,1  2,1  (Offset by 0.5 width)

    // We can map X,Y in text directly to axial q,r with shift
    // q = x - (y - (y&1)) / 2
    // r = y

    // ASCII map assumptions: " X " pattern.
    // We simply iterate. If char is 'X', we add a hex.
    // We need to center it afterwards.

    const hexes = [];
    if (!lines || lines.length === 0) return hexes;
    const height = lines.length;
    const width = lines[0].length;

    let centerX = width / 2;
    let centerY = height / 2;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < lines[y].length; x++) {
            if (lines[y][x] === 'X') {
                // Convert Offset (Odd-Q likely in ASCII visual?)
                // Let's rely on standard axial conversion for specific visual layout
                // Actually, simpler: Treat Y as R. Treat X as Q + shifted R.
                // r = y - centerY
                // q = x - centerX - (y - centerY)/2

                // Let's just use raw coordinates and center later.
                // Doubled coordinates might be easier for ASCII visual 'X X X'
                // Let's assume standard dense text block 'XXXX'
                // q = x - (y - (y&1)) / 2
                // r = y

                let q = x - Math.floor(y / 2);
                let r = y;

                hexes.push(new Hex(q, r));
            }
        }
    }

    // Recentering
    if (hexes.length > 0) {
        let avgQ = 0, avgR = 0;
        hexes.forEach(h => { avgQ += h.q; avgR += h.r; });
        avgQ = Math.round(avgQ / hexes.length);
        avgR = Math.round(avgR / hexes.length);

        return hexes.map(h => new Hex(h.q - avgQ, h.r - avgR));
    }
    return hexes;
}

// --- Territory Logic ---
function refreshTerritories() {
    // 1. Snapshot Old State
    const oldTerritoryStats = new Map();
    state.territories.forEach(t => oldTerritoryStats.set(t.id, { money: t.money, playerId: t.playerId, size: t.cells.length }));

    const cellOldTerritory = new Map();
    state.grid.forEach(c => {
        if (c.territoryId) cellOldTerritory.set(c.hex.toString(), c.territoryId);
    });

    // 2. Generate New Territories
    const visited = new Set();
    const newTerritories = new Map();
    let nextId = 1;

    state.grid.forEach(cell => {
        if (cell.playerId !== 0 && !visited.has(cell.hex.toString())) {
            const territory = new Territory(nextId++, cell.playerId);
            const queue = [cell];
            visited.add(cell.hex.toString());

            while (queue.length > 0) {
                const current = queue.shift();
                current.territoryId = territory.id;
                territory.cells.push(current);

                current.hex.getNeighbors().forEach(nHex => {
                    const neighbor = state.grid.get(nHex.toString());
                    if (neighbor && neighbor.playerId === cell.playerId && !visited.has(nHex.toString())) {
                        visited.add(nHex.toString());
                        queue.push(neighbor);
                    }
                });
            }
            newTerritories.set(territory.id, territory);
        }
    });

    // 3. Distribute Money
    const oldToNewMap = new Map();
    newTerritories.forEach(nt => {
        nt.cells.forEach(cell => {
            const oldId = cellOldTerritory.get(cell.hex.toString());
            if (oldId) {
                const oldStats = oldTerritoryStats.get(oldId);
                // Only inherit if player matches
                if (oldStats && oldStats.playerId === nt.playerId) {
                    if (!oldToNewMap.has(oldId)) oldToNewMap.set(oldId, new Set());
                    oldToNewMap.get(oldId).add(nt.id);
                }
            }
        });
    });

    // Reset money for accumulation
    newTerritories.forEach(nt => nt.money = 0);
    const moneySources = new Map(); // Track if a NT received money to determine "New Land" bonus

    oldToNewMap.forEach((newIds, oldId) => {
        const oldData = oldTerritoryStats.get(oldId);
        // Only consider targets that are large enough to have a capital (>= 2 cells)
        const targets = Array.from(newIds)
            .map(nid => newTerritories.get(nid))
            .filter(t => t.cells.length >= 2);

        if (targets.length > 0) {
            // Calculate total size of valid successors
            const totalSize = targets.reduce((sum, t) => sum + t.cells.length, 0);

            targets.forEach(t => {
                const share = Math.floor(oldData.money * (t.cells.length / totalSize));
                t.money += share;
                moneySources.set(t.id, true);
            });
        }
    });

    // 4. Handle Capitals & Finalize
    newTerritories.forEach(nt => {
        // If "Brand New" (e.g. formed from neutral), give starter cash
        if (!moneySources.has(nt.id) && nt.cells.length >= 2) nt.money = 10;
        // Single tile territories cannot hold money
        if (nt.cells.length < 2) nt.money = 0;

        // Resolve Capitals
        const capitalCells = nt.cells.filter(c => c.building === 'capital');

        if (capitalCells.length > 1) {
            // Merge scenario: Keep capital from largest OLD territory
            let winner = capitalCells[0];
            let maxSize = -1;

            capitalCells.forEach(c => {
                const oldId = cellOldTerritory.get(c.hex.toString());
                const oldSize = (oldId && oldTerritoryStats.get(oldId)) ? oldTerritoryStats.get(oldId).size : 0;
                if (oldSize > maxSize) {
                    maxSize = oldSize;
                    winner = c;
                }
            });
            // Remove losers
            capitalCells.forEach(c => { if (c !== winner) c.building = null; });
        }

        const hasExistingCapital = nt.cells.some(c => c.building === 'capital');

        if (!hasExistingCapital && nt.cells.length >= 2) {
            // Spawn new capital
            // Score candidates to find optimal capital spot
            // 0: Empty (Best)
            // 1: Tree or Gravestone
            // 2: Castle (Expensive loss)
            // 3: Unit (Sacrifice)

            let bestSpot = nt.cells[0];
            let bestScore = 99;

            for (const cell of nt.cells) {
                let score = 3;
                if (cell.unit) score = 3;
                else if (cell.building === 'castle') score = 2;
                else if (cell.tree || cell.isGravestone) score = 1;
                else score = 0; // Ideally empty

                if (score < bestScore) {
                    bestScore = score;
                    bestSpot = cell;
                    if (bestScore === 0) break; // Found perfect spot
                }
            }

            // Enforce clearing of the chosen spot
            // "Replace that entity" -> We destroy whatever was there.
            if (bestSpot.unit) logEvent(`Capital replaced a ${bestSpot.unit}!`, "system");

            bestSpot.unit = null;
            bestSpot.tree = null;
            bestSpot.building = 'capital';
            bestSpot.isGravestone = false;

            // Clear any other capitals just in case
            nt.cells.forEach(c => { if (c !== bestSpot && c.building === 'capital') c.building = null; });
        } else if (nt.cells.length < 2) {
            // Remove capital if shrank too small and replace with tree
            nt.cells.forEach(c => {
                if (c.building === 'capital') {
                    c.building = null;
                    c.tree = 'pine';
                }
            });
        }
    });

    state.territories = newTerritories;
}

// --- Interaction Logic ---
function handleWheel(e) {
    if (state.gameOver) return;
    e.preventDefault();
    const zoomSensitivity = 0.001;
    const oldZoom = state.camera.zoom;
    let newZoom = oldZoom - e.deltaY * zoomSensitivity;

    // Clamp zoom
    newZoom = Math.max(0.3, Math.min(newZoom, 3));

    // Zoom towards mouse pointer
    // Get mouse pos relative to canvas center
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - canvas.width / 2;
    const mouseY = e.clientY - rect.top - canvas.height / 2;

    // Calculate offset in world space based on "screen = (world * zoom) + pan"
    // So world = (screen - pan) / zoom
    // We want the world point under mouse to stay stationary relative to screen
    // screenX = (worldX * newZoom) + newPanX
    // screenX = (worldX * oldZoom) + oldPanX
    // newPanX = screenX - worldX * newZoom

    // But our render is: ctx.translate(center); ctx.translate(cam); ctx.scale(zoom);
    // screen = center + pan + (world * zoom)
    // world * zoom = screen - center - pan
    // world = (screen - center - pan) / zoom

    const worldX = (mouseX - state.camera.x) / oldZoom;
    const worldY = (mouseY - state.camera.y) / oldZoom;

    state.camera.x = mouseX - worldX * newZoom;
    state.camera.y = mouseY - worldY * newZoom;

    state.camera.zoom = newZoom;
}

function handleMouseDown(e) {
    if (state.gameOver || state.players[state.currentPlayerIdx].type !== 'human') return;

    // Identify if clicking UI or Map
    state.camera.isDragging = true;
    state.camera.startX = e.clientX;
    state.camera.startY = e.clientY;
    state.camera.initialCamX = state.camera.x;
    state.camera.initialCamY = state.camera.y;
    state.camera.hasDragged = false;
}

function handleMouseMove(e) {
    if (state.camera.isDragging) {
        const dx = e.clientX - state.camera.startX;
        const dy = e.clientY - state.camera.startY;

        // Threshold to consider it a drag
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            state.camera.hasDragged = true;
        }

        state.camera.x = state.camera.initialCamX + dx;
        state.camera.y = state.camera.initialCamY + dy;
    }
}

function handleMouseUp(e) {
    if (!state.camera.isDragging) return;
    state.camera.isDragging = false;

    // If we dragged, don't treat this as a click
    if (state.camera.hasDragged) return;

    // Otherwise, process as click logic
    processGameClick(e);
}

function processGameClick(e) {
    const rect = canvas.getBoundingClientRect();
    const hex = pixelToHex(e.clientX - rect.left, e.clientY - rect.top);
    const cell = state.grid.get(hex.toString());

    // Clicking outside map
    if (!cell) {
        if (state.shopSelected) resetShopSelection();
        if (state.selectedCell) {
            state.selectedCell = null;
            state.validTargets.clear();
            const cursorFollower = document.getElementById('cursor-follower');
            if (cursorFollower) cursorFollower.style.display = 'none';
            updateUI();
        }
        return;
    }

    const pIdx = state.players[state.currentPlayerIdx].id;

    if (state.shopSelected && state.activeTerritoryId) {
        const t = state.territories.get(state.activeTerritoryId);
        if (!t || t.playerId !== pIdx) {
            logEvent("Select one of your territories first!", "system");
            resetShopSelection(); return;
        }
        const hasCapital = t.cells.some(c => c.building === 'capital');
        if (!hasCapital) {
            logEvent("This territory is too small (no capital).", "system");
            resetShopSelection(); return;
        }
        if (t.money < UNIT_COSTS[state.shopSelected]) {
            logEvent(`Not enough money (${UNIT_COSTS[state.shopSelected]}c needed).`, "system");
            resetShopSelection(); return;
        }

        const isInternal = cell.territoryId === t.id;
        const isAdjacent = !isInternal && t.cells.some(ownCell => Hex.directions.some(d => ownCell.hex.add(d).toString() === cell.hex.toString()));

        if (canPlaceShopUnit(t, cell, state.shopSelected, isInternal, isAdjacent)) {
            const unitType = state.shopSelected;
            if (unitType !== 'castle') { // Buying a Unit
                const cost = UNIT_COSTS[unitType];
                if (isInternal) {
                    if (cell.unit) {
                        // Merging
                        let combo = `${unitType}+${cell.unit}`;
                        if (MERGE_MAP[combo]) {
                            cell.unit = MERGE_MAP[combo];
                            // Do NOT set hasMoved = true logic handled in place
                            const oldBal = t.money;
                            t.money -= cost; resetShopSelection();
                            logEvent(`Upgraded to ${cell.unit}: ${oldBal} - ${cost} = ${t.money}`, "system");
                        }
                    } else if (!cell.building) {
                        if (cell.tree) { cell.tree = null; cell.hasMoved = true; logEvent("Tree chopped!", "system"); }
                        const oldBal = t.money;
                        cell.unit = unitType; t.money -= cost; resetShopSelection();
                        logEvent(`${unitType} bought: ${oldBal} - ${cost} = ${t.money} remaining`, "system");
                    }
                } else if (isAdjacent) {
                    // Attack
                    const oldBal = t.money;
                    t.money -= cost; // Deduct BEFORE capture
                    captureTile(cell, pIdx, unitType);
                    resetShopSelection();
                    logEvent(`${unitType} captured tile: ${oldBal} - ${cost} = ${t.money} remaining`, "system");
                }
            } else if (unitType === 'castle') {
                const oldBal = t.money;
                cell.building = 'castle'; t.money -= 15; resetShopSelection();
                logEvent(`Castle built: ${oldBal} - 15 = ${t.money} remaining`, "system");
            }
        } else {
            // Basic error logging if invalid click happen (though visuals should guide now)
            if (state.shopSelected === 'castle' && !isInternal) logEvent("Invalid move.", "system");
            else if (state.shopSelected !== 'castle' && !isInternal && !isAdjacent) logEvent("Can only place units inside territory or on adjacent enemies.", "system");
            else logEvent("Invalid placement.", "system");
        }
    } else if (state.selectedCell) {
        // Selected a different cell (switch selection or deselect)
        // Ensure cursor is hidden from previous selection
        const cursorFollower = document.getElementById('cursor-follower');
        if (cursorFollower) cursorFollower.style.display = 'none';

        if (canMoveUnit(state.selectedCell, cell)) {
            executeMove(state.selectedCell, cell);
            state.selectedCell = null;
            state.validTargets.clear();
            const cursorFollower = document.getElementById('cursor-follower');
            if (cursorFollower) cursorFollower.style.display = 'none';
        } else {
            // Explain why movement failed
            // Explain why movement failed
            const t = state.territories.get(state.selectedCell.territoryId);
            const isAdj = t && t.cells.some(c => {
                const dist = Math.max(Math.abs(c.hex.q - cell.hex.q), Math.abs(c.hex.r - cell.hex.r), Math.abs(c.hex.s - cell.hex.s));
                return dist === 1;
            });

            if (state.selectedCell.territoryId !== cell.territoryId && !isAdj) {
                logEvent("Target is too far away!", "system");
            } else if (state.selectedCell.playerId !== cell.playerId && !checkAttack(STRENGTHS[state.selectedCell.unit], cell)) {
                logEvent("Enemy too strong!", "system");
            } else if (state.selectedCell.playerId === cell.playerId && cell.unit && !MERGE_MAP[`${state.selectedCell.unit}+${cell.unit}`]) {
                logEvent(`Cannot merge ${state.selectedCell.unit} with ${cell.unit}.`, "system");
            } else if (cell.building && cell.territoryId === state.selectedCell.territoryId) {
                logEvent("Cannot move onto infrastructure!", "system");
            } else {
                logEvent("Invalid move.", "system");
            }

            state.selectedCell = null; // Clear selection
            state.validTargets.clear();
            const cursorFollower = document.getElementById('cursor-follower');
            if (cursorFollower) cursorFollower.style.display = 'none';
        }
    } else {
        if (cell.unit && cell.playerId === pIdx && !cell.hasMoved) {
            state.selectedCell = cell; state.shopSelected = null;
            updateValidTargets();
            logEvent(`${cell.unit} selected. Click adjacent tile to move/attack.`);

            // Show cursor follower for drag
            const cursorFollower = document.getElementById('cursor-follower');
            if (cursorFollower) {
                cursorFollower.style.display = 'block';
                cursorFollower.innerHTML = '';

                const unit = cell.unit;
                const pId = cell.playerId;

                // Texture Logic
                const pSprites = state.playerUnitSprites && state.playerUnitSprites[pId];
                const specificSprite = pSprites && pSprites[unit];
                const defaultSprite = state.unitSprites && state.unitSprites[unit];
                const sprite = (specificSprite && specificSprite.complete && specificSprite.naturalWidth !== 0) ? specificSprite : defaultSprite;

                if (sprite) {
                    const img = sprite.cloneNode();
                    img.style.width = '40px'; img.style.height = 'auto';
                    cursorFollower.appendChild(img);
                } else {
                    const icons = { peasant: '👨', spearman: '🛡️', knight: '🏇', baron: '👑' };
                    cursorFollower.textContent = icons[unit] || '❓';
                }

                // Snap to mouse immediately if possible, or wait for move
                cursorFollower.style.left = `${e.clientX}px`;
                cursorFollower.style.top = `${e.clientY}px`;
            }
        } else {
            if (state.selectedCell) {
                // Deselecting
                const cursorFollower = document.getElementById('cursor-follower');
                if (cursorFollower) cursorFollower.style.display = 'none';
            }
            state.selectedCell = null; state.shopSelected = null;
            state.validTargets.clear();
        }
    }
    state.activeTerritoryId = cell.territoryId; updateUI();
}



function checkAttack(strength, to) {
    let defense = to.getStrength();
    to.hex.getNeighbors().forEach(h => {
        const n = state.grid.get(h.toString());
        if (n && n.playerId === to.playerId && n.territoryId === to.territoryId) defense = Math.max(defense, n.getStrength());
    });
    return strength > defense;
}

function captureTile(cell, newPlayerId, unit = null) {
    if (cell.building === 'capital') {
        logEvent(`Capital captured! Treasury lost.`, "system");
        const t = state.territories.get(cell.territoryId);
        if (t) t.money = 0;
    }
    cell.playerId = newPlayerId; cell.unit = unit; cell.building = null; cell.tree = null; cell.hasMoved = true; cell.isGravestone = false;
    refreshTerritories(); checkWin();
}

function canMoveUnit(from, to) {
    if (from === to) return false;

    // Internal movement: Any distance within same territory
    if (from.territoryId === to.territoryId) {
        if (to.building) return false; // Cannot move onto own buildings (Capital/Castle)
        return true;
    }

    // External movement/Attack:
    // Allowed if 'to' is adjacent to ANY cell in 'from's territory.
    const t = state.territories.get(from.territoryId);
    if (!t) return false;

    const isAdjacentToTerritory = t.cells.some(c => {
        const dist = Math.max(Math.abs(c.hex.q - to.hex.q), Math.abs(c.hex.r - to.hex.r), Math.abs(c.hex.s - to.hex.s));
        return dist === 1;
    });

    if (!isAdjacentToTerritory) return false;

    if (from.playerId !== to.playerId) return checkAttack(STRENGTHS[from.unit], to);

    // Merge/Move to own territory logic
    if (to.building) return false; // Cannot move onto own buildings (Capital/Castle)

    return true; // Adjacent friendly blob
}

function canPlaceShopUnit(t, cell, unitType, isInternal, isAdjacent) {
    if (unitType === 'castle') {
        return isInternal && !cell.unit && !cell.building && !cell.tree;
    } else {
        if (isInternal) {
            if (cell.unit) {
                // Check merge
                const combo = `${unitType}+${cell.unit}`;
                return !!MERGE_MAP[combo];
            }
            if (cell.building) return false;
            // Can chop tree or place on empty
            return true;
        } else if (isAdjacent) {
            if (cell.playerId === t.playerId) return false; // Cannot attack own other territory directly without connection? Rules say 'adjacent enemy'.
            return checkAttack(STRENGTHS[unitType], cell);
        }
    }
    return false;
}

function updateValidTargets() {
    state.validTargets.clear();
    const pId = state.players[state.currentPlayerIdx].id;

    if (state.shopSelected && state.activeTerritoryId) {
        const t = state.territories.get(state.activeTerritoryId);
        if (!t || t.playerId !== pId) return; // Should be handled by UI disabling but extra safety

        state.grid.forEach(cell => {
            const isInternal = cell.territoryId === t.id;
            // Opt: Only check relevant cells (neighbors of territory)
            // simplified: check all
            let isAdjacent = false;
            if (!isInternal) {
                isAdjacent = t.cells.some(ownCell => Hex.directions.some(d => ownCell.hex.add(d).toString() === cell.hex.toString()));
            }

            if (canPlaceShopUnit(t, cell, state.shopSelected, isInternal, isAdjacent)) {
                state.validTargets.add(cell.hex.toString());
            }
        });

    } else if (state.selectedCell) {
        state.grid.forEach(cell => {
            if (canMoveUnit(state.selectedCell, cell)) {
                state.validTargets.add(cell.hex.toString());
            }
        });
    }
}

function executeMove(from, to) {
    const isInternal = from.territoryId === to.territoryId;
    if (isInternal) {
        if (to.unit) {
            const combo = `${from.unit}+${to.unit}`;
            // Merge: Do NOT consume 'to' unit's action
            if (MERGE_MAP[combo]) { to.unit = MERGE_MAP[combo]; from.unit = null; }
        } else if (to.tree) { to.tree = null; to.unit = from.unit; from.unit = null; to.hasMoved = true; }
        else { to.unit = from.unit; from.unit = null; } // Moving to empty space internal
    } else {
        if (from.playerId === to.playerId) { // Merge blobs
            if (to.unit) {
                const combo = `${from.unit}+${to.unit}`;
                // Merge external: Do NOT consume 'to' unit's action
                if (MERGE_MAP[combo]) { to.unit = MERGE_MAP[combo]; from.unit = null; }
            } else { to.unit = from.unit; from.unit = null; to.hasMoved = true; }
        } else { // Attack
            captureTile(to, from.playerId, from.unit); from.unit = null;
        }
    }
    refreshTerritories(); updateUI();
}

// --- Turn Management ---
function startTurn() {
    const p = state.players[state.currentPlayerIdx];

    // Check if player has been eliminated (has no territories)
    // Nature (id=0) always plays.
    if (p.id !== 0) {
        const hasLand = Array.from(state.territories.values()).some(t => t.playerId === p.id);
        if (!hasLand) {
            logEvent(`${p.type === 'human' ? 'You were' : 'Player ' + p.id} eliminated! Skipping turn.`, "system");
            setTimeout(endTurn, 100);
            return;
        }
    }
    // 1. Nature Growth & Gravestones
    state.grid.forEach(c => {
        if (c.playerId === p.id) {
            c.hasMoved = false;
            if (c.isGravestone) { c.isGravestone = false; c.tree = 'pine'; }
            if (!c.unit && !c.building && !c.tree && !c.isGravestone) {
                const ns = c.hex.getNeighbors().map(h => state.grid.get(h.toString())).filter(n => n);
                const pines = ns.filter(n => n.tree === 'pine').length;
                const palms = ns.filter(n => n.tree === 'palm').length;
                const isCoast = ns.length < 6;
                if (pines >= 2 && Math.random() < 0.2) c.tree = 'pine';
                else if (isCoast && palms >= 1 && Math.random() < 0.2) c.tree = 'palm';
                else if (Math.random() < 0.01) c.tree = 'pine';
            }
        }
    });

    // 2. Economy
    state.territories.forEach(t => {
        if (t.playerId === p.id) {
            const hasCap = t.cells.some(c => c.building === 'capital');
            if (hasCap) {
                t.money += t.getNet();
                if (t.money < 0) {
                    t.cells.forEach(c => { if (c.unit) { c.unit = null; c.isGravestone = true; } });
                    t.money = 0; logEvent(`${PLAYER_COLORS[p.id].name} bankrupt!`, "system");
                }
            } else t.money = 0;
        }
    });

    // Auto-select biggest territory for human player convenience
    if (p.type === 'human') {
        const myTerritories = Array.from(state.territories.values())
            .filter(t => t.playerId === p.id)
            .sort((a, b) => b.cells.length - a.cells.length);

        if (myTerritories.length > 0) {
            state.activeTerritoryId = myTerritories[0].id;
        }
    }

    updateUI();
    if (p.type === 'ai') setTimeout(runAITurn, 600);
}


function hasAvailableActions(playerId) {
    // 1. Check for unmoved units
    const hasUnmovedUnits = Array.from(state.grid.values()).some(c => c.playerId === playerId && c.unit && !c.hasMoved);
    if (hasUnmovedUnits) return true;

    // 2. Check for ability to buy units (Capital exists + Money >= 10)
    // We check purely for capacity to spend, not board space (as space is almost always available if you have land)
    const hasMoneyToSpend = Array.from(state.territories.values())
        .filter(t => t.playerId === playerId)
        .some(t => t.cells.some(c => c.building === 'capital') && t.money >= 10);

    return hasMoneyToSpend;
}

function endTurn() {
    const pId = state.players[state.currentPlayerIdx].id;
    if (state.players[state.currentPlayerIdx].type === 'human') {
        if (hasAvailableActions(pId)) {
            if (!confirm("You still have actions available (Units to move or Money to spend).\nAre you sure you want to end your turn?")) return;
        }
    }

    state.currentPlayerIdx = (state.currentPlayerIdx + 1) % state.players.length;
    state.turn++; state.selectedCell = null; state.shopSelected = null;
    startTurn();
}

function checkWin() {
    const playersAlive = new Set();
    state.grid.forEach(c => { if (c.playerId !== 0) playersAlive.add(c.playerId); });
    if (playersAlive.size === 1) {
        state.gameOver = true;
        const winnerId = Array.from(playersAlive)[0];
        const winner = PLAYER_COLORS[winnerId].name;
        logEvent(`${winner} has conquered the island!`, "system");
        showGameOver(winnerId, winner);
    }
}

function showGameOver(winnerId, winnerName) {
    const modal = document.getElementById('game-over-modal');
    const announce = document.getElementById('winner-announce');
    const stats = document.getElementById('game-over-stats');

    modal.classList.remove('hidden');
    announce.textContent = `${winnerName} Wins!`;
    announce.style.color = PLAYER_COLORS[winnerId].fill;

    // Calculate Stats
    let totalLand = 0; state.grid.forEach(c => { if (c.playerId === winnerId) totalLand++; });

    stats.innerHTML = `
        <div class="stat-item">
            <span class="label">Total Turns</span>
            <span class="value">${state.turn}</span>
        </div>
        <div class="stat-item">
            <span class="label">Territory</span>
            <span class="value">${totalLand} Tiles</span>
        </div>
    `;
}

function restartGame() {
    console.log("restartGame() called");
    document.getElementById('game-over-modal').classList.add('hidden');
    document.getElementById('game-ui').classList.add('hidden');
    document.getElementById('setup-screen').classList.remove('hidden');
    state.gameStarted = false;
    state.gameOver = false;
    state.turn = 1;
    state.currentPlayerIdx = 0;
    state.grid = new Map();
    state.players = [];
    state.territories = new Map();
    logContainer.innerHTML = '';

    // Stop any existing render loop before resetting
    stopRenderLoop();

    console.log("Calling initSetupBackground() from restartGame");
    initSetupBackground();
}

// --- AI Logic ---
function runAITurn() {
    const pId = state.players[state.currentPlayerIdx].id;
    const ts = Array.from(state.territories.values()).filter(t => t.playerId === pId);
    ts.forEach(t => {
        const hasCap = t.cells.some(c => c.building === 'capital');
        while (hasCap && t.money >= 10) {
            const spot = t.cells.find(c => !c.unit && !c.building && !c.tree);
            if (!spot) break; spot.unit = 'peasant'; t.money -= 10;
        }
        t.cells.filter(c => c.unit && !c.hasMoved).forEach(cell => {
            const ns = cell.hex.getNeighbors().map(h => state.grid.get(h.toString())).filter(n => n);
            const targets = ns.filter(n => n.playerId !== pId && checkAttack(STRENGTHS[cell.unit], n));
            if (targets.length > 0) executeMove(cell, targets[0]);
            else {
                const own = ns.filter(n => n.playerId === pId && !n.building);
                if (own.length > 0) executeMove(cell, own[Math.floor(Math.random() * own.length)]);
            }
        });
    });
    setTimeout(endTurn, 500);
}

// --- Rendering & UI ---
function updateUI() {
    const p = state.players[state.currentPlayerIdx];
    // Update active territory stats if selected, else current player's aggregate or first territory
    const t = state.territories.get(state.activeTerritoryId) || Array.from(state.territories.values()).find(t => t.playerId === p.id);
    if (t) {
        const income = t.getIncome();
        const wages = t.getWages();

        document.getElementById('stat-land').innerHTML = `${t.cells.length}<img src="assets/tile_${t.playerId}.png" class="stat-icon">`;
        document.getElementById('stat-income').innerHTML = `+${income}<img src="assets/coin.png" class="stat-icon">`;

        const wagesEl = document.getElementById('stat-wages');
        wagesEl.innerHTML = `-${wages}<img src="assets/coin.png" class="stat-icon">`;

        // Highlight if Wages > Income (Bankruptcy risk)
        if (wages > income) wagesEl.classList.add('text-danger');
        else wagesEl.classList.remove('text-danger');

        const balanceEl = document.getElementById('stat-balance');
        balanceEl.innerHTML = `${t.money}<img src="assets/coin.png" class="coin-icon">`;

        // Dim shop buttons based on balance AND ownership
        document.querySelectorAll('.shop-item').forEach(btn => {
            const cost = UNIT_COSTS[btn.dataset.unit];
            // Disable if: 
            // 1. Not your territory (inspecting enemy)
            // 2. Not enough money
            if (t.playerId !== p.id || t.money < cost) {
                btn.classList.add('disabled');
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            } else {
                btn.classList.remove('disabled');
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            }
        });
    } else {
        // Reset shop if no territory active
        document.querySelectorAll('.shop-item').forEach(btn => {
            btn.classList.remove('disabled'); btn.style.opacity = '1'; btn.style.cursor = 'pointer';
        });
    }

    // End Turn Suggestion using helper
    const btn = document.getElementById('end-turn-btn');
    if (state.players[state.currentPlayerIdx].type === 'human') {
        const hasActions = hasAvailableActions(p.id);
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';

        if (!hasActions) btn.classList.add('suggest-end-turn');
        else btn.classList.remove('suggest-end-turn');
    } else {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
        btn.classList.remove('suggest-end-turn');
    }

    updateLeaderboard();
}

function updateLeaderboard() {
    // 1. Calculate Total Land (Tiles) per Player
    const landMap = new Map();
    state.players.forEach(p => landMap.set(p.id, 0));

    state.grid.forEach(c => {
        if (c.playerId !== 0 && landMap.has(c.playerId)) {
            const current = landMap.get(c.playerId);
            landMap.set(c.playerId, current + 1);
        }
    });

    // 2. Find Max Land
    let maxLand = 0;
    for (const count of landMap.values()) {
        if (count > maxLand) maxLand = count;
    }
    const divisor = maxLand > 0 ? maxLand : 1;

    // 3. Update Bars
    state.players.forEach(p => {
        const row = document.getElementById(`p-row-${p.id}`);
        const bar = document.getElementById(`p-bar-${p.id}`);
        if (row && bar) {
            // Outline active turn
            if (p.id === state.players[state.currentPlayerIdx].id) row.classList.add('active-turn');
            else row.classList.remove('active-turn');

            // Update bar width
            const count = landMap.get(p.id);
            const pct = (count / divisor) * 100;
            bar.style.width = `${pct}%`;
        }
    });
}

function logEvent(msg, type = '') {
    const e = document.createElement('p'); e.className = `log-entry ${type}`;
    e.textContent = msg; logContainer.prepend(e);
}

function drawHex(ctx, x, y, size, cell) {
    const color = PLAYER_COLORS[cell.playerId];
    let surfaceY = y;
    if (state.playerSprites && state.playerSprites[cell.playerId]) {
        // Draw Textured
        const sprite = state.playerSprites[cell.playerId];
        const scale = (size * 2) / sprite.width;
        const h = sprite.height * scale;
        const w = sprite.width * scale;

        // Align bottom of sprite to bottom of hex face
        // y is center. Bottom of hex face is y + size * sqrt(3) / 2
        // We want (drawY + h) = y + size * sqrt(3) / 2
        // So drawY = y + size * sqrt(3) / 2 - h

        const drawX = x - w / 2;
        const drawY = y + size * Math.sqrt(3) / 2 - h;

        surfaceY = y + size * Math.sqrt(3) - h;

        ctx.save();
        // Highlight active territory (Brighten)
        if (state.activeTerritoryId !== null && state.activeTerritoryId === cell.territoryId && cell.playerId !== 0) {
            ctx.filter = 'brightness(1.5)';
        }
        ctx.drawImage(sprite, drawX, drawY, w, h);
        ctx.restore();
    } else {
        // Fallback Flat
        ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.lineTo(x + size * Math.cos(a), y + size * Math.sin(a)); }
        ctx.closePath();
        ctx.fillStyle = (state.selectedCell === cell) ? '#fff' : (state.activeTerritoryId !== null && state.activeTerritoryId === cell.territoryId && cell.playerId !== 0) ? color.fill : color.bg;
        ctx.fill(); ctx.strokeStyle = color.fill; ctx.stroke();
    }

    // Selection Overlay (if textured)
    if (state.playerSprites[cell.playerId]) {
        if (state.selectedCell === cell) { // Highlight selection
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.lineTo(x + size * Math.cos(a), surfaceY + size * Math.sin(a)); }
            ctx.fill();
        } else if (state.activeTerritoryId !== null && state.activeTerritoryId === cell.territoryId && cell.playerId !== 0) {
            // Active territory tint? maybe not needed if texture matches color
        }
    }
    if (cell.building === 'capital') {
        const sprite = (state.capitalSprites && state.capitalSprites[cell.playerId]) || state.capitalSprite;

        if (sprite && sprite.complete) {
            // Scale logic: capital might be smaller than full tile? 
            // Let's assume full tile width scaling for consistency with trees/tiles if it's high res
            const scale = (size * 2) / sprite.width;
            const h = sprite.height * scale;
            const w = sprite.width * scale;

            // Align bottom to bottom of hex face (same as tree/tile)
            const drawX = x - w / 2;
            const drawY = y + size * Math.sqrt(3) / 2 - h;

            ctx.drawImage(sprite, drawX, drawY, w, h);
        } else {
            drawIcon(ctx, x, surfaceY, '🏠');
        }

        const t = state.territories.get(cell.territoryId);
        const isCurrentPlayer = cell.playerId === state.players[state.currentPlayerIdx].id;
        if (isCurrentPlayer && t && t.money >= 10 && Math.sin(Date.now() / 200) > 0) drawPulse(ctx, x, surfaceY);
    }
    if (cell.building === 'castle') {
        const sprite = (state.castleSprites && state.castleSprites[cell.playerId]) || state.castleSprite;

        if (sprite && sprite.complete) {
            const scale = (size * 2) / sprite.width;
            const h = sprite.height * scale;
            const w = sprite.width * scale;

            // Align bottom to bottom of hex face
            const drawX = x - w / 2;
            const drawY = y + size * Math.sqrt(3) / 2 - h;

            ctx.drawImage(sprite, drawX, drawY, w, h);
        } else {
            drawIcon(ctx, x, surfaceY, '🏰');
        }
    }
    if (cell.unit) {
        // Check for player-specific sprite first, then default
        const pSprites = state.playerUnitSprites && state.playerUnitSprites[cell.playerId];
        const specificSprite = pSprites && pSprites[cell.unit];
        const defaultSprite = state.unitSprites && state.unitSprites[cell.unit];

        const sprite = (specificSprite && specificSprite.complete && specificSprite.naturalWidth !== 0) ? specificSprite : defaultSprite;

        if (sprite && sprite.complete && sprite.naturalWidth !== 0) {
            const scale = (size * 1.5) / sprite.width; // Slight tweak for units
            const h = sprite.height * scale;
            const w = sprite.width * scale;

            // User specified: "units textures are built to that their center is where the center of the hex tile should be"
            const drawX = x - w / 2;
            const drawY = surfaceY - h / 2;

            ctx.drawImage(sprite, drawX, drawY, w, h);

            const isCurrentPlayer = cell.playerId === state.players[state.currentPlayerIdx].id;
            if (cell.hasMoved) {
                ctx.fillStyle = 'rgba(0,0,0,0.4)';
                ctx.beginPath();
                ctx.arc(x, drawY + h / 2, w / 2, 0, Math.PI * 2);
                ctx.fill();
            }
            else if (isCurrentPlayer && Math.sin(Date.now() / 200) > 0) {
                // Pulse
                drawPulse(ctx, x, surfaceY);
            }
        } else {
            drawIcon(ctx, x, surfaceY, { peasant: '👨', spearman: '🛡️', knight: '🏇', baron: '👑' }[cell.unit]);
            if (cell.hasMoved) { ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.arc(x, surfaceY, size / 2, 0, Math.PI * 2); ctx.fill(); }
        }
    }
    if (cell.tree) {
        if (state.treeSprite && state.treeSprite.complete) {
            // Draw Tree Sprite
            const sprite = state.treeSprite;
            const scale = (size * 2) / sprite.width;
            const h = sprite.height * scale;
            const w = sprite.width * scale;

            // Align bottom of tree sprite to bottom of hex face (same as tile)
            // Use same logic as tile drawing:
            const drawX = x - w / 2;
            const drawY = surfaceY; // surfaceY IS (y + size*sqrt(3)/2 - tileH).
            // Wait, surfaceY is the TOP of the tile surface.
            // If the tree sprite is full tile height (including 3D depth), we need to align it carefully.
            // User said: "exact same dimensions as a tile".
            // If I draw it at the same Y as the tile, it will overlay perfectly.
            // Tile drawY = y + size*sqrt(3)/2 - tileH.
            // surfaceY = y + size*sqrt(3) - tileH. (Wait, I calculated this in previous step).

            // Let's look at previous step calculation:
            // const drawY = y + size * Math.sqrt(3) / 2 - h;
            // surfaceY = y + size * Math.sqrt(3) - h;

            // If I want to match the tile position exactly:
            // I should draw it at `drawY_tile`.
            // `drawY_tile` = surfaceY - (size * Math.sqrt(3)/2)? No.

            // surfaceY = drawY + size*sqrt(3)/2.
            // So drawY = surfaceY - size*sqrt(3)/2.

            // Let's trust "same dimensions as a tile". 
            // I should use the exact same calculation as the tile for the tree (assuming tree sprite has same H/W ratio/size as tile sprite).
            // The tile sprite height `h` (scaled) was used to compute surfaceY.

            const treeDrawY = y + size * Math.sqrt(3) / 2 - h;
            // This assumes tree sprite has SAME aspect ratio and pixel size as the tile sprite.
            // Scaling logic: scale = (size * 2) / sprite.width. 
            // If dimensions are same, `w` and `h` will be same.

            ctx.drawImage(sprite, drawX, treeDrawY, w, h);
        } else {
            drawIcon(ctx, x, surfaceY, cell.tree === 'pine' ? '🌲' : '🌴');
        }
    }
    if (cell.isGravestone) drawIcon(ctx, x, surfaceY, '🪦');

    // Draw Valid Target Highlight
    if (state.validTargets.has(cell.hex.toString())) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(x, surfaceY, size * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

function drawIcon(ctx, x, y, emoji) { ctx.font = '16px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(emoji, x, y); }
function drawPulse(ctx, x, y) { ctx.fillStyle = 'rgba(255, 0, 0, 0.6)'; ctx.beginPath(); ctx.arc(x, y + 10, 4, 0, Math.PI * 2); ctx.fill(); }

function pixelToHex(x, y) {
    const rect = canvas.getBoundingClientRect(); // Local coord already likely passed in? 
    // Wait, caller passes (clientX - rect.left, clientY - rect.top).
    // So 'x' and 'y' are canvas-relative coordinates.

    // Apply Camera Transform:
    // Screen = (World * Zoom) + Pan
    // World = (Screen - Pan) / Zoom

    // The render transform is: translate(camX, camY) -> scale(zoom)
    // Actually scale usually happens around origin?
    // In render():
    // ctx.translate(state.camera.x + width/2, state.camera.y + height/2); // Center of screen?
    // Default render was: ctx.translate(state.camera.x, state.camera.y);

    // We need to match render transformation.
    // Let's standardize render to be centered properly.

    const centeredX = x - canvas.clientWidth / 2;
    const centeredY = y - canvas.clientHeight / 2;

    const worldX = (centeredX - state.camera.x) / state.camera.zoom;
    const worldY = (centeredY - state.camera.y) / state.camera.zoom;

    // Hex to Pixel (flat/pointy):
    // x = size * 3/2 * q
    // y = size * sqrt(3) * (r + q/2)

    const q = (2 / 3 * worldX) / (HEX_SIZE);
    const r = (-1 / 3 * worldX + Math.sqrt(3) / 3 * worldY) / (HEX_SIZE);

    let rx = Math.round(q), rz = Math.round(r), ry = Math.round(-q - r);
    if (Math.abs(rx - q) > Math.abs(ry - (-q - r)) && Math.abs(rx - q) > Math.abs(rz - r)) rx = -ry - rz;
    else if (Math.abs(ry - (-q - r)) > Math.abs(rz - r)) ry = -rx - rz;
    else rz = -rx - ry;
    return new Hex(rx, rz);
}

function centerCamera() {
    if (state.grid.size === 0) {
        state.camera.x = 0;
        state.camera.y = 0;
        state.camera.zoom = 1;
        return;
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    for (const cell of state.grid.values()) {
        const p = cell.hex.toPixel();
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    }

    const mapCenterX = (minX + maxX) / 2;
    const mapCenterY = (minY + maxY) / 2;

    // Optional: Auto-fit for large maps
    const mapWidth = maxX - minX + HEX_SIZE * 3;
    const mapHeight = maxY - minY + HEX_SIZE * 3;
    const zoomX = canvas.clientWidth / mapWidth;
    const zoomY = canvas.clientHeight / mapHeight;
    state.camera.zoom = 1.0;

    // Apply zoom to center calculation
    state.camera.x = -mapCenterX * state.camera.zoom;
    state.camera.y = -mapCenterY * state.camera.zoom;

    // Fix centering for in-game UI (Sidebar 350px, Header 80px)
    if (state.gameStarted) {
        // Visual Center X: (W - 350) / 2. Screen Center: W/2. Offset: -175
        // Visual Center Y: 80 + (H - 80) / 2. Screen Center: H/2. Offset: +40
        state.camera.x -= 175;
        state.camera.y += 40;
    }
}

function getVisibleHexBounds() {
    const cx = canvas.clientWidth / 2;
    const cy = canvas.clientHeight / 2;

    // Check 4 corners + center + mid-edges to be safe? 
    // 4 corners is usually enough for convex hull of screen.
    const corners = [
        { x: 0, y: 0 },
        { x: canvas.clientWidth, y: 0 },
        { x: 0, y: canvas.clientHeight },
        { x: canvas.clientWidth, y: canvas.clientHeight }
    ];

    let minQ = Infinity, maxQ = -Infinity, minR = Infinity, maxR = -Infinity;

    corners.forEach(p => {
        const worldX = (p.x - cx - state.camera.x) / state.camera.zoom;
        const worldY = (p.y - cy - state.camera.y) / state.camera.zoom;

        const q = (2 / 3 * worldX) / HEX_SIZE;
        const r = (-1 / 3 * worldX + Math.sqrt(3) / 3 * worldY) / HEX_SIZE;

        if (q < minQ) minQ = q;
        if (q > maxQ) maxQ = q;
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
    });

    return {
        qMin: Math.floor(minQ) - 1,
        qMax: Math.ceil(maxQ) + 1,
        rMin: Math.floor(minR) - 1,
        rMax: Math.ceil(maxR) + 1
    };
}

function drawBackground(ctx) {
    if (state.bgSprites.length < 3) return;

    const bounds = getVisibleHexBounds();
    const size = HEX_SIZE;
    // Use slightly larger size or overlap if needed, but standard hex size should work if math is perfect.
    // 3D tiles usually overlap downwards.

    // We iterate R then Q to draw top-to-bottom for correct Z-ordering of 3D tiles
    for (let r = bounds.rMin; r <= bounds.rMax; r++) {
        for (let q = bounds.qMin; q <= bounds.qMax; q++) {
            // Deterministic random texture
            // Large primes for hashing to avoid patterns
            const hash = Math.abs((Math.round(q) * 492876847 ^ Math.round(r) * 715225739)) % state.bgSprites.length;
            const sprite = state.bgSprites[hash];

            if (!sprite || !sprite.complete) continue;

            const x = HEX_SIZE * 3 / 2 * q;
            const y = HEX_SIZE * Math.sqrt(3) * (r + q / 2);

            // Draw logic matching drawHex but without gameplay overlays
            const aspect = sprite.height / sprite.width;
            const drawW = size * 2;
            const drawH = drawW * aspect;

            // Centering logic for 3D tiles:
            // The "footprint" center is x,y.
            // We align the bottom part of the hex to the footprint?
            // Usually for 3D hexes:
            // x is center.
            // y is center of the hex top face.
            // So we draw the image such that its "top face" aligns with x,y.

            // Standard hex draw:
            // ctx.drawImage(sprite, x - size, y - size, ...);
            // This aligns the top-left of the BOX (2*size width, 2*size height) to x-size, y-size.
            // If the sprite is taller, we draw it further up?

            // Let's assume the sprite is drawn centered horizontally.
            // Vertically, the "center" of the hex face should be at y.
            // If the sprite has depth d, the image height is h + d.
            // The "center" of the top face is at y.
            // So we start drawing at y - h/2 - d?

            // Re-using the logic that worked for player tiles (hopefully):
            ctx.drawImage(sprite, x - size, y - size * Math.sqrt(3) / 2 - (drawH - size * Math.sqrt(3)), drawW, drawH);
        }
    }
}




function drawWater(ctx) {
    if (!state.waterSprite || !state.waterSprite.complete) return;

    const bounds = getVisibleHexBounds();
    const size = HEX_SIZE;
    const now = Date.now() / 1000;

    // Helper to find minimal distance to land (Breadth/Ring-First Search)
    const getLandDistance = (startHex, maxDist) => {
        // Optimization: Check rings outward
        for (let d = 1; d <= maxDist; d++) {
            // Generate ring d
            // Start point: startHex + direction[4] * d
            let current = startHex.add(Hex.directions[4].scale(d));

            for (let i = 0; i < 6; i++) {
                const dir = Hex.directions[i];
                for (let j = 0; j < d; j++) {
                    if (state.grid.has(current.toString())) return d;
                    current = current.add(dir);
                }
            }
        }
        return maxDist + 1; // Beyond max
    };

    // Iterate visible grid
    for (let r = bounds.rMin; r <= bounds.rMax; r++) {
        for (let q = bounds.qMin; q <= bounds.qMax; q++) {
            const h = new Hex(q, r);
            const hexStr = h.toString();

            // Calculate opacity: 80% at dist 1, +5% each step, max 90%
            const maxDist = 7;
            const dist = getLandDistance(h, maxDist);

            // Formula: 0.8 + (dist - 1) * 0.05
            // Cap at 0.9
            let alpha = 0.7 + (Math.min(dist, maxDist) - 1) * 0.05;
            alpha = Math.min(Math.max(alpha, 0.7), 0.9);

            // Perlin Bobbing
            // Use noise(q, r, time)
            // Lower frequency = smoother waves. Lower time scale = slower.
            const nVal = noise(q * 0.1, r * 0.1, now * 0.5);
            const bob = nVal * 0.07;

            const sprite = state.waterSprite;
            const aspect = sprite.height / sprite.width;
            const drawW = size * 2;
            const drawH = drawW * aspect;

            const x = HEX_SIZE * 3 / 2 * q;
            const y = HEX_SIZE * Math.sqrt(3) * (r + q / 2);

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.drawImage(sprite, x - size, y - size * Math.sqrt(3) / 2 - (drawH - size * Math.sqrt(3)) - bob, drawW, drawH);
            ctx.restore();
        }
    }
}

let lastFrameTime = 0;
const targetFPS = 60;
const frameInterval = 1000 / targetFPS;

function render(timestamp) {
    state.renderLoopId = requestAnimationFrame(render);

    // Throttle FPS
    if (!lastFrameTime) lastFrameTime = timestamp;
    const elapsed = timestamp - lastFrameTime;

    if (elapsed < frameInterval) return;

    // Adjust for latency
    lastFrameTime = timestamp - (elapsed % frameInterval);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    // Move to center of canvas
    ctx.translate(canvas.clientWidth / 2, canvas.clientHeight / 2);

    // Apply Pan
    ctx.translate(state.camera.x, state.camera.y);

    // Apply Zoom
    ctx.scale(state.camera.zoom, state.camera.zoom);

    // Draw Infinite Background
    drawBackground(ctx);

    // Draw Water Layer
    drawWater(ctx);

    // Sort cells by depth (Y coordinate) to ensure correct overlap for 3D tiles
    const sortedCells = Array.from(state.grid.values()).sort((a, b) => {
        const pay = Math.sqrt(3) / 2 * a.hex.q + Math.sqrt(3) * a.hex.r; // Inline simplified Y calc
        const pby = Math.sqrt(3) / 2 * b.hex.q + Math.sqrt(3) * b.hex.r;
        return pay - pby;
    });

    sortedCells.forEach(cell => {
        const pos = cell.hex.toPixel();
        drawHex(ctx, pos.x, pos.y, HEX_SIZE - 1, cell);
    });

    ctx.restore();
}

function startRenderLoop() {
    if (!state.renderLoopId) {
        state.renderLoopId = requestAnimationFrame(render);
    }
}

function stopRenderLoop() {
    if (state.renderLoopId) {
        cancelAnimationFrame(state.renderLoopId);
        state.renderLoopId = null;
    }
}

function initSetupBackground() {
    console.log("initSetupBackground() called");
    // Setup dummy players for colors
    state.players = [];
    for (let i = 1; i <= 6; i++) {
        state.players.push({ id: i, type: 'ai' });
    }

    // Generate random 100-hex island
    console.log("Generating island...");
    generateIsland(6, 'random', 100);
    console.log("Island generated. Grid size:", state.grid.size, "Hexes array length:", state.hexes.length);

    handleResize();
    centerCamera();
    // Adjust pan for the new zoom level to keep it centered
    state.camera.x *= 1.2;
    state.camera.y *= 1.2;
    state.camera.zoom = 1.2; // Zoom in slightly for immersive background
    // Ensure render loop is running if not already match state
    // (Render is called by checkLoad, but this ensures map is ready)
    console.log("Forcing render loop from initSetupBackground");
    startRenderLoop();
}

setup();
initSetupBackground();

document.getElementById('recenter-btn').addEventListener('click', centerCamera);

// Global Cursor Follower Logic
// Global Cursor Follower Logic
window.addEventListener('mousemove', (e) => {
    const cursorFollower = document.getElementById('cursor-follower');
    if (cursorFollower) {
        // Condition 1: Shop Item Selected
        if (state.shopSelected) {
            cursorFollower.style.left = `${e.clientX}px`;
            cursorFollower.style.top = `${e.clientY}px`;
        }
        // Condition 2: Board Unit Selected (Drag)
        else if (state.selectedCell && state.selectedCell.unit) {
            cursorFollower.style.left = `${e.clientX}px`;
            cursorFollower.style.top = `${e.clientY}px`;
        }
    }
});
