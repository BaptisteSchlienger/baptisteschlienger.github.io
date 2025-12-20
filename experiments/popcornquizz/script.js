document.addEventListener('DOMContentLoaded', () => {
    // Configuration
    // const API_KEY = '64cb275e'; // Not working but keep just in case
    const API_KEY = 'ba4f04ff';
    const OMDB_URL = `https://www.omdbapi.com/?apikey=${API_KEY}&t=`;
    const PIXEL_START = 28; // Reduced for better initial visibility
    const PIXEL_END = 1;    // Final clear image
    const GAME_TIME = 30;   // Seconds for timed mode
    const MAX_TRIES = 5;    // Tries for tries mode

    // Curated list of famous movies
    const FAMOUS_MOVIES = [
        "Inception", "Interstellar", "Pulp Fiction", "The Matrix", "The Godfather",
        "The Dark Knight", "Forrest Gump", "Fight Club", "The Shawshank Redemption", "Gladiator",
        "The Lion King", "Jurassic Park", "Back to the Future", "The Silence of the Lambs",
        "Schindler's List", "Goodfellas", "Seven", "The Usual Suspects", "The Green Mile",
        "Saving Private Ryan", "Avatar", "Titanic", "The Lord of the Rings", "The Prestige",
        "Memento", "The Departed", "Inglourious Basterds", "Django Unchained", "The Wolf of Wall Street",
        "Whiplash", "Parasite", "Joker", "Blade Runner 2049", "Arrival",
        "The Truman Show", "Eternal Sunshine of the Spotless Mind", "No Country for Old Men", "Oldboy",
        "Alien", "Aliens", "Psycho", "The Shining", "A Clockwork Orange",
        "2001: A Space Odyssey", "The Thing", "Terminator 2: Judgment Day", "Die Hard", "Raiders of the Lost Ark",
        "Ghostbusters", "The Goonies", "The Breakfast Club", "Ferris Bueller's Day Off", "Grease",
        "Dirty Dancing", "Top Gun", "Toy Story", "Beauty and the Beast", "Aladdin",
        "Monsters, Inc.", "Finding Nemo", "The Incredibles", "Ratatouille", "WALL-E",
        "Up", "Spirited Away", "Princess Mononoke", "Howl's Moving Castle", "My Neighbor Totoro",
        "City of God", "Life is Beautiful", "The Pianist", "Braveheart",
        "Heat", "Casino", "Trainspotting", "The Big Lebowski", "Fargo",
        "Reservoir Dogs", "Kill Bill", "Snatch", "The Sixth Sense", "Unbreakable",
        "Split", "Signs", "Gone Girl", "Zodiac", "The Social Network", "The Girl with the Dragon Tattoo", "Sin City",
        "Prisoners", "Sicario", "Wind River", "Mad Max: Fury Road", "Drive",
        "Nightcrawler", "Ex Machina", "Her", "Under the Skin", "It Follows",
        "Get Out", "Us", "Hereditary", "Midsommar", "The Witch",
        "The Lighthouse", "The Northman", "Blade Runner", "E.T. the Extra-Terrestrial", "Close Encounters of the Third Kind",
        "Jaws", "Bridge of Spies", "Catch Me If You Can",
        "The Terminal", "Minority Report", "War of the Worlds", "Gravity", "Birdman",
        "The Revenant", "1917", "Dunkirk", "The Hateful Eight", "Once Upon a Time in Hollywood",
        "Babylon", "La La Land", "Black Swan", "The Wrestler",
        "Requiem for a Dream", "The Fountain", "The Whale", "Everything Everywhere All At Once",
        "Coco", "Soul", "Inside Out", "Zootopia", "Spider-Man: Into the Spider-Verse",
        "The Grand Budapest Hotel", "Moonrise Kingdom", "The Royal Tenenbaums", "Fantastic Mr. Fox", "Isle of Dogs",
        "Knives Out", "Glass Onion", "Looper", "The Big Short", "Vice", "Don't Look Up",
        "The Batman", "The Suicide Squad", "American Psycho", "The Aviator", "The Others",
        "The Conjuring", "A Nightmare on Elm Street", "Halloween", "Friday the 13th", "Scream",
        "The Exorcist", "Rosemary's Baby", "Rear Window", "Vertigo", "North by Northwest",
        "Raging Bull", "Taxi Driver", "The Irishman", "The King of Comedy", "After Hours",
        "Magnolia", "There Will Be Blood", "Boogie Nights", "Phantom Thread", "The French Dispatch",
        "Lost in Translation", "Mulholland Drive", "Blue Velvet", "Stalker", "Solaris",
        "The 400 Blows", "Breathless", "Seven Samurai", "Rashomon", "Ikiru",
        "Ran", "Tokyo Story", "Metropolis", "M", "Nosferatu",
        "Modern Times", "City Lights", "Bicycle Thieves", "Citizen Kane", "Double Indemnity",
        "Sunset Boulevard", "The Apartment", "Some Like It Hot", "Lawrence of Arabia", "The Bridge on the River Kwai",
        "Paths of Glory", "Dr. Strangelove", "Barry Lyndon", "Full Metal Jacket", "Eyes Wide Shut",
        "Amadeus", "One Flew Over the Cuckoo's Nest", "Platoon", "Wall Street", "Scarface",
        "The Untouchables", "Mission: Impossible", "Jackie Brown", "Moonlight",
        // --- STAR WARS ---
        "Star Wars: Episode IV - A New Hope", "Star Wars: Episode V - The Empire Strikes Back", "Star Wars: Episode VI - Return of the Jedi",
        "Star Wars: Episode I - The Phantom Menace", "Star Wars: Episode II - Attack of the Clones", "Star Wars: Episode III - Revenge of the Sith",
        "Star Wars: Episode VII - The Force Awakens", "Star Wars: Episode VIII - The Last Jedi", "Star Wars: Episode IX - The Rise of Skywalker",
        "Rogue One: A Star Wars Story", "Solo: A Star Wars Story",
        // --- HARRY POTTER ---
        "Harry Potter and the Sorcerer's Stone", "Harry Potter and the Chamber of Secrets", "Harry Potter and the Prisoner of Azkaban",
        "Harry Potter and the Goblet of Fire", "Harry Potter and the Order of the Phoenix", "Harry Potter and the Half-Blood Prince",
        "Harry Potter and the Deathly Hallows: Part 1", "Harry Potter and the Deathly Hallows: Part 2",
        "Fantastic Beasts and Where to Find Them",
        // --- LORD OF THE RINGS / HOBBIT ---
        "The Lord of the Rings: The Fellowship of the Ring", "The Lord of the Rings: The Two Towers", "The Lord of the Rings: The Return of the King",
        "The Hobbit: An Unexpected Journey", "The Hobbit: The Desolation of Smaug", "The Hobbit: The Battle of the Five Armies",
        // --- MARVEL (MCU) ---
        "Iron Man", "The Incredible Hulk", "Iron Man 2", "Thor", "Captain America: The First Avenger", "The Avengers",
        "Iron Man 3", "Thor: The Dark World", "Captain America: The Winter Soldier", "Guardians of the Galaxy",
        "Avengers: Age of Ultron", "Ant-Man", "Captain America: Civil War", "Doctor Strange", "Guardians of the Galaxy Vol. 2",
        "Spider-Man: Homecoming", "Thor: Ragnarok", "Black Panther", "Avengers: Infinity War", "Ant-Man and the Wasp",
        "Captain Marvel", "Avengers: Endgame", "Spider-Man: Far From Home", "Black Widow", "Shang-Chi and the Legend of the Ten Rings",
        "Eternals", "Spider-Man: No Way Home", "Doctor Strange in the Multiverse of Madness", "Thor: Love and Thunder",
        "Black Panther: Wakanda Forever", "Ant-Man and the Wasp: Quantumania", "Guardians of the Galaxy Vol. 3", "The Marvels",
        "Deadpool", "Deadpool 2", "Logan", "X-Men", "X2", "X-Men: First Class", "X-Men: Days of Future Past",
        // --- DC ---
        "Man of Steel", "Batman v Superman: Dawn of Justice", "Suicide Squad", "Wonder Woman", "Justice League",
        "Aquaman", "Shazam!", "Birds of Prey", "Black Adam", "The Flash", "Blue Beetle", "Watchmen", "V for Vendetta",
        // --- JAMES BOND ---
        "Casino Royale", "Quantum of Solace", "Skyfall", "Spectre", "No Time to Die", "Goldfinger", "From Russia with Love",
        // --- OTHER FRANCHISES ---
        "Jurassic World", "Jurassic Park III", "The Lost World: Jurassic Park", "Jurassic World: Fallen Kingdom", "Jurassic World Dominion",
        "Indiana Jones and the Temple of Doom", "Indiana Jones and the Last Crusade", "Indiana Jones and the Kingdom of the Crystal Skull", "Indiana Jones and the Dial of Destiny",
        "Pirates of the Caribbean: The Curse of the Black Pearl", "Pirates of the Caribbean: Dead Man's Chest", "Pirates of the Caribbean: At World's End",
        "Mission: Impossible - Ghost Protocol", "Mission: Impossible - Rogue Nation", "Mission: Impossible - Fallout", "Mission: Impossible - Dead Reckoning Part One",
        "The Fast and the Furious", "2 Fast 2 Furious", "The Fast and the Furious: Tokyo Drift", "Fast & Furious", "Fast Five", "Fast & Furious 6", "Furious 7", "The Fate of the Furious", "F9", "Fast X",
        "The Hunger Games", "The Hunger Games: Catching Fire", "The Hunger Games: Mockingjay - Part 1", "The Hunger Games: Mockingjay - Part 2",
        "The Twilight Saga: New Moon", "Eclipse", "The Twilight Saga: Breaking Dawn - Part 1", "The Twilight Saga: Breaking Dawn - Part 2",
        "The Terminator", "Terminator 3: Rise of the Machines", "Terminator Salvation", "Terminator Genisys", "Terminator: Dark Fate",
        "Rocky", "Rocky II", "Rocky III", "Rocky IV", "Rocky V", "Rocky Balboa", "Creed", "Creed II", "Creed III",
        "John Wick", "John Wick: Chapter 2", "John Wick: Chapter 3 - Parabellum", "John Wick: Chapter 4",
        "Toy Story 2", "Toy Story 3", "Toy Story 4", "Cars", "Cars 2", "Cars 3", "Frozen", "Frozen II",
        "The Godfather Part II", "The Godfather Part III"
    ];

    // State
    let currentMovie = null;
    let gameMode = 'timed'; // timed | tries
    let score = 0;
    let lastRoundScore = 0;
    let timeLeft = GAME_TIME;
    let triesUsed = 0;
    let timerInterval = null;
    let rafId = null;
    let startTime = null;
    let currentPixelSize = PIXEL_START;
    let imageLoaded = false;
    let movieImg = new Image();
    let currentObjectURL = null;
    let hintsRevealed = 0;

    // DOM Elements
    const screens = {
        setup: document.getElementById('setup-screen'),
        game: document.getElementById('game-screen'),
        result: document.getElementById('result-screen')
    };

    const canvas = document.getElementById('movie-canvas');
    const ctx = canvas.getContext('2d', { alpha: false });
    const guessInput = document.getElementById('guess-input');
    const submitBtn = document.getElementById('submit-guess');
    const skipBtn = document.getElementById('skip-try');
    const giveUpBtn = document.getElementById('give-up');
    const feedback = document.getElementById('feedback');
    const timerVal = document.getElementById('timer-val');
    const scoreVal = document.getElementById('score-val');
    const statMainLabel = document.querySelector('#stat-main .label');
    const loadingOverlay = document.querySelector('.loading-overlay');
    const canvasContainer = document.querySelector('.movie-canvas-container');
    const visualProgress = document.getElementById('visual-progress');

    // --- Navigation & Setup ---
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            gameMode = btn.dataset.mode;
        });
    });

    document.getElementById('start-game').addEventListener('click', startGame);
    document.getElementById('restart-game').addEventListener('click', () => showScreen('setup'));

    function showScreen(screenId) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        screens[screenId].classList.add('active');
    }

    // --- Game Logic ---
    function startGame() {
        score = 0;
        if (scoreVal) scoreVal.innerText = score;

        // Show/Hide skip button based on mode
        if (gameMode === 'tries') {
            skipBtn.style.display = 'block';
            giveUpBtn.style.display = 'none';
        } else {
            skipBtn.style.display = 'none';
            giveUpBtn.style.display = 'block';
        }

        showScreen('game');
        nextMovie();
    }

    function updateVisualProgress() {
        visualProgress.innerHTML = '';
        if (gameMode === 'timed') {
            const container = document.createElement('div');
            container.className = 'progress-container';
            const fill = document.createElement('div');
            fill.className = 'progress-fill';
            fill.style.width = (timeLeft / GAME_TIME * 100) + '%';
            container.appendChild(fill);
            visualProgress.appendChild(container);
        } else {
            const container = document.createElement('div');
            container.className = 'try-squares';
            for (let i = 0; i < MAX_TRIES; i++) {
                const sq = document.createElement('div');
                sq.className = `try-sq ${i < triesUsed ? 'guessed-wrong' : ''}`;
                container.appendChild(sq);
            }
            visualProgress.appendChild(container);
        }
    }

    async function nextMovie() {
        if (timerInterval) clearInterval(timerInterval);
        if (rafId) cancelAnimationFrame(rafId);

        loadingOverlay.classList.add('active');
        imageLoaded = false;
        triesUsed = 0;
        timeLeft = GAME_TIME;
        currentPixelSize = PIXEL_START;
        guessInput.value = '';
        feedback.innerText = '';
        feedback.className = 'feedback';

        updateVisualProgress();

        // Pick random title
        const randomTitle = FAMOUS_MOVIES[Math.floor(Math.random() * FAMOUS_MOVIES.length)];

        try {
            const response = await fetch(`${OMDB_URL}${encodeURIComponent(randomTitle)}`);
            const data = await response.json();

            if (data.Response === 'False' || !data.Poster || data.Poster === 'N/A') {
                console.warn(`Movie not found or no poster: ${randomTitle}. Retrying...`);
                return nextMovie();
            }

            currentMovie = {
                title: data.Title,
                poster: data.Poster,
                hints: {
                    runtime: data.Runtime,
                    year: data.Year,
                    genre: data.Genre,
                    director: data.Director,
                    plot: data.Plot
                }
            };

            // Reset hints UI
            hintsRevealed = 0;
            document.querySelectorAll('.hint-item').forEach(item => {
                item.classList.remove('active');
                item.querySelector('span').innerText = '';
            });

            // Setup stat labels
            if (gameMode === 'timed') {
                if (statMainLabel) statMainLabel.innerText = 'Time Left';
                if (timerVal) timerVal.innerText = `${timeLeft}s`;
            } else {
                if (statMainLabel) statMainLabel.innerText = 'Tries Left';
                if (timerVal) timerVal.innerText = `${MAX_TRIES - triesUsed}`;
            }

            // Fetch image once to reuse it (avoiding double request)
            const imgResponse = await fetch(currentMovie.poster);
            const blob = await imgResponse.blob();

            if (currentObjectURL) URL.revokeObjectURL(currentObjectURL);
            currentObjectURL = URL.createObjectURL(blob);

            movieImg = new Image();
            movieImg.onload = () => {
                imageLoaded = true;
                loadingOverlay.classList.remove('active');
                drawPixelated();
                startLoop();
            };
            movieImg.onerror = () => {
                console.error('Failed to load image. Retrying with another movie.');
                nextMovie();
            };
            movieImg.src = currentObjectURL;

        } catch (err) {
            console.error('Fetch error:', err);
            feedback.innerText = 'Network error. Retrying...';
            setTimeout(nextMovie, 2000);
        }
    }

    function startLoop() {
        if (gameMode === 'timed') {
            startTime = Date.now();

            function update() {
                const elapsed = (Date.now() - startTime) / 1000;
                timeLeft = Math.max(0, GAME_TIME - elapsed);

                // Update Text
                if (timerVal) timerVal.innerText = `${Math.ceil(timeLeft)}s`;

                // Update Bar Smoothly
                const fill = document.querySelector('.progress-fill');
                if (fill) {
                    fill.style.width = (timeLeft / GAME_TIME * 100) + '%';
                }

                // Depixelate over time
                const progress = elapsed / GAME_TIME;
                currentPixelSize = PIXEL_START - (progress * (PIXEL_START - PIXEL_END));
                drawPixelated();

                // Reveal hints over time (Timed mode)
                // Thresholds: roughly every 6 seconds for 30s game
                const hintIndex = Math.floor(elapsed / 6);
                if (hintIndex > hintsRevealed && hintIndex <= 4) {
                    revealNextHint();
                }

                if (timeLeft <= 0) {
                    endGame(false);
                } else {
                    rafId = requestAnimationFrame(update);
                }
            }
            rafId = requestAnimationFrame(update);
        }
    }

    function revealNextHint() {
        if (hintsRevealed >= 4) return;

        hintsRevealed++;
        const hintMap = ['runtime', 'year', 'genre', 'director'];
        const type = hintMap[hintsRevealed - 1];
        const val = currentMovie.hints[type];

        const el = document.getElementById(`hint-${type}`);
        if (el && val) {
            el.querySelector('span').innerText = val;
            el.classList.add('active');
        }
    }

    function drawPixelated() {
        if (!imageLoaded) return;

        const w = movieImg.width;
        const h = movieImg.height;

        canvas.width = w;
        canvas.height = h;

        const px = Math.max(1, Math.floor(currentPixelSize));

        if (px === 1) {
            ctx.drawImage(movieImg, 0, 0);
            return;
        }

        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        const sw = Math.max(1, w / px);
        const sh = Math.max(1, h / px);

        tempCanvas.width = sw;
        tempCanvas.height = sh;
        tempCtx.drawImage(movieImg, 0, 0, sw, sh);

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tempCanvas, 0, 0, sw, sh, 0, 0, w, h);
    }

    function checkAnswer() {
        const guess = guessInput.value.trim().toLowerCase();
        const correct = currentMovie.title.trim().toLowerCase();

        const romanToArabic = {
            'i': '1', 'ii': '2', 'iii': '3', 'iv': '4', 'v': '5',
            'vi': '6', 'vii': '7', 'viii': '8', 'ix': '9', 'x': '10'
        };

        const wordsToArabic = {
            'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
            'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10'
        };

        const simplify = (str) => {
            let s = str.toLowerCase();
            // Remove common suffixes/markers that users often omit
            s = s.replace(/\b(part|vol|volume|episode|chapter|book|phase)\b/g, '');

            // Normalize Roman Numerals to digits
            Object.keys(romanToArabic).forEach(roman => {
                const regex = new RegExp(`\\b${roman}\\b`, 'g');
                s = s.replace(regex, romanToArabic[roman]);
            });

            // Normalize Number Words to digits
            Object.keys(wordsToArabic).forEach(word => {
                const regex = new RegExp(`\\b${word}\\b`, 'g');
                s = s.replace(regex, wordsToArabic[word]);
            });

            // Standard cleanup
            return s.replace(/[:.,!?'\s-]/g, '').replace(/^the/, '');
        };

        if (simplify(guess) === simplify(correct)) {
            handleCorrect();
        } else {
            handleWrong();
        }
    }

    function handleCorrect() {
        feedback.innerText = 'Correct! 🎬';
        feedback.className = 'feedback success';

        // Calculate score out of 100
        if (gameMode === 'timed') {
            lastRoundScore = Math.ceil((timeLeft / GAME_TIME) * 100);
        } else {
            lastRoundScore = Math.ceil(((MAX_TRIES - triesUsed) / MAX_TRIES) * 100);
        }

        score += lastRoundScore;
        if (scoreVal) scoreVal.innerText = score;

        currentPixelSize = 1;
        drawPixelated();

        // Reveal for 1.5s then Go to Success screen
        setTimeout(() => endGame(true), 1500);
    }

    function handleWrong(isSkip = false) {
        if (isSkip) {
            feedback.innerText = 'Skipped! 🍿';
            feedback.className = 'feedback';
        } else {
            feedback.innerText = 'Not that one... 🍿';
            feedback.className = 'feedback error';
        }

        if (gameMode === 'tries') {
            triesUsed++;
            if (timerVal) timerVal.innerText = `${MAX_TRIES - triesUsed}`;
            updateVisualProgress();

            // Depixelate based on tries
            const progress = triesUsed / MAX_TRIES;
            currentPixelSize = PIXEL_START - (progress * (PIXEL_START - PIXEL_END));
            drawPixelated();

            // Reveal hint on wrong try
            revealNextHint();

            if (triesUsed >= MAX_TRIES) {
                lastRoundScore = 0;
                endGame(false);
            }
        }

        guessInput.value = '';
        guessInput.focus();
    }

    function endGame(isWin = false) {
        if (timerInterval) clearInterval(timerInterval);
        if (rafId) cancelAnimationFrame(rafId);

        const outcomeIcon = document.getElementById('outcome-icon');
        const outcomeTitle = document.getElementById('outcome-title');
        const resultCard = document.querySelector('.result-card');

        if (!isWin) lastRoundScore = 0;
        document.getElementById('final-score-val').innerText = `${lastRoundScore}/100`;

        // Final movie reveal
        if (currentMovie && currentObjectURL) {
            document.getElementById('final-movie-img').src = currentObjectURL;
            document.getElementById('final-movie-title').innerText = currentMovie.title;

            // Expanded details
            document.getElementById('final-plot').innerText = currentMovie.hints.plot || 'No plot available.';

            const finalHints = document.getElementById('final-hints');
            finalHints.innerHTML = '';

            const hintMap = [
                { type: 'runtime', icon: 'clock' },
                { type: 'year', icon: 'calendar-alt' },
                { type: 'genre', icon: 'tags' },
                { type: 'director', icon: 'user-tie' }
            ];

            hintMap.forEach(h => {
                const val = currentMovie.hints[h.type];
                if (val && val !== 'N/A') {
                    const item = document.createElement('div');
                    item.className = 'hint-item active';
                    item.innerHTML = `<i class="fas fa-${h.icon}"></i> <span>${val}</span>`;
                    finalHints.appendChild(item);
                }
            });
        }

        if (isWin) {
            outcomeIcon.className = 'fas fa-star';
            outcomeTitle.innerText = 'Director\'s Cut!';
            resultCard.classList.add('success-win');
            spawnConfetti();
        } else {
            outcomeIcon.className = 'fas fa-ghost';
            outcomeTitle.innerText = 'Cut! Game Over';
            resultCard.classList.remove('success-win');
        }

        let msg = '';
        if (isWin) msg = 'Brilliant! You guessed it right.';
        else msg = 'So close! Give it another shot.';

        document.getElementById('result-message').innerText = msg;

        showScreen('result');
    }

    function spawnConfetti() {
        const container = document.getElementById('confetti-container');
        container.innerHTML = '';
        for (let i = 0; i < 40; i++) {
            const popcorn = document.createElement('div');
            popcorn.className = 'popcorn-particle';
            popcorn.innerHTML = '🍿';
            popcorn.style.left = Math.random() * 100 + 'vw';
            popcorn.style.animationDelay = Math.random() * 2 + 's';
            popcorn.style.fontSize = (Math.random() * 20 + 10) + 'px';
            container.appendChild(popcorn);
        }
    }

    // Events
    submitBtn.addEventListener('click', checkAnswer);
    skipBtn.addEventListener('click', () => handleWrong(true));
    giveUpBtn.addEventListener('click', () => endGame(false));
    guessInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') checkAnswer();
    });

    // Initialize
    nextMovie();
});
