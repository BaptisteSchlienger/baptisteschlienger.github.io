document.addEventListener('DOMContentLoaded', () => {
    initGlitchBackground();
    initContactBackground();
    initTextGlitch();
    initLanguage();
    initSmoothScroll();
});

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);

            if (targetElement) {
                const header = document.getElementById('site-header');
                const headerHeight = header ? header.offsetHeight : 0;
                const targetPosition = targetElement.offsetTop - headerHeight;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });

                // Update URL (optional, keeps native behavior but without jump)
                history.pushState(null, null, `#${targetId}`);
            }
        });
    });
}

// Translations
const translations = {
    en: {
        "nav.home": "Home",
        "nav.about": "About",
        "nav.experience": "Experience",
        "nav.skills": "Skills",
        "nav.education": "Education",
        "nav.contact": "Contact",

        "hero.subtitle": "Full-Stack Developer & Problem Solver",
        "hero.location": "Bordeaux, France",

        "about.title": "About Me",
        "about.p1_start": "Passionate ",
        "about.p1_end": "who loves learning and building new projects. I specialize in algorithm design, optimization, and creating intuitive user experiences.",
        "about.p2": "Long story short… I love developing, whatever the platform.",
        "about.roles": ["developer", "website builder", "problem solver", "algorithm designer", "app maker"],

        "exp.title": "Experience",
        "exp.label.services": "Services:",
        "exp.label.highlights": "Highlights:",
        "exp.label.role": "Role:",
        "exp.label.stack": "Stack:",
        "exp.label.projects": "Projects:",
        "exp.label.mission": "Mission:",
        "exp.label.impact": "Impact:",

        "exp.freelance.title": "Freelance Full-stack Developer",
        "exp.freelance.meta": "Nov 2017 - Aug 2021 | Tours & Remote",
        "exp.freelance.services": "Web Development, CMS (Setup + Custom), Chatbot Development, SEO Consulting.",
        "exp.freelance.highlights": "Bilingual English/French services, leveraging a background in Cyber Security & SEO.",

        "exp.deloitte.title": "Deloitte — Cyber Risk Services",
        "exp.deloitte.meta": "Apr 2016 - Nov 2017 | Amsterdam, Netherlands",
        "exp.deloitte.role": "Full-stack Developer within the Ethical Hacking team.",
        "exp.deloitte.stack": "C#, ASP.NET, AngularJS, HTML5, CSS3, Javascript.",
        "exp.deloitte.projects": "Hacking as a Service Scanning Tool, Complex Backoffice Systems, Client Portals, Reporting Engines.",

        "exp.multivote.title": "Multivote",
        "exp.multivote.meta": "Mar 2014 - Dec 2014 | Bordeaux, France",
        "exp.multivote.role": "API Developer.",
        "exp.multivote.stack": "Windows Azure, C#, ASP.NET.",
        "exp.multivote.mission": "Created APIs and optimized algorithm calculation times on large datasets using Azure cloud architecture.",

        "exp.ch.title": "Centre Hospitalier Robert Boulin",
        "exp.ch.meta": "Aug 2012 - Dec 2012 | Libourne, France",
        "exp.ch.role": "Web Developer.",
        "exp.ch.stack": "PHP, Javascript/jQuery, HTML5, CSS3.",
        "exp.ch.impact": "Created a datacenter visualization tool (VM, CPU, Disk), improving backup processes by 20%.",

        "skills.title": "Skills & Interests",
        "skills.cat.languages": "Languages",
        "skills.list.languages": "C, C++, C#, HTML, CSS, Javascript, PHP, SQL, Python, Java, Kotlin",
        "skills.cat.domains": "Domains",
        "skills.list.domains": "SEO, Web Security, Ethical Hacking, AI/ML, Cloud Computing, Algorithm Design",
        "skills.cat.frameworks": "Frameworks & Tools",
        "skills.list.frameworks": ".Net, AngularJS, NodeJS, Flask, Unity3D, Photoshop, Blender, Git, Docker",
        "skills.cat.softskills": "Soft Skills",
        "skills.list.softskills": "Project Management, Team Leading, Business Communication, Adaptability (Fast Learner)",
        "skills.cat.fluent": "Fluent in",
        "skills.list.fluent": "French, English, Spanish",
        "skills.cat.travels": "Travels",
        "skills.list.travels": "United States, Mexico, Argentina, Peru, Caribbean Islands, Spain, Italy, France, Netherlands",

        "edu.title": "Education",
        "edu.epitech.title": "EPITECH",
        "edu.epitech.meta": "2011 - 2016 | Bordeaux & Paris, France",
        "edu.epitech.degree": "Master in Computer Science and Programming",
        "edu.epitech.desc": "Project-based pedagogy, solo & group work, learning everything from C programming to Project Management & Team Leading.",

        "edu.ucsd.title": "UCSD",
        "edu.ucsd.meta": "Jan 2015 - July 2015 | San Diego, California, USA",
        "edu.ucsd.degree": "Computer Science Engineering Extension",
        "edu.ucsd.desc": "Technical & Theoretical courses including SEO and Business Communication Skills.",

        "contact.title": "Get In Touch",
        "contact.subtitle": "Currently looking for freelance missions.",
        "contact.btn.email": "Email",

        "footer.text": "© 2025 Baptiste Schlienger. Built with 💻 & 🍜."
    },
    fr: {
        "nav.home": "Accueil",
        "nav.about": "À propos",
        "nav.experience": "Expériences",
        "nav.skills": "Compétences",
        "nav.education": "Formation",
        "nav.contact": "Contact",

        "hero.subtitle": "Développeur Full-Stack & Problem Solver",
        "hero.location": "Bordeaux, France",

        "about.title": "À propos",
        "about.p1_start": "Passionné de ",
        "about.p1_end": "qui aime apprendre et construire de nouveaux projets. Je me spécialise dans la conception d'algorithmes, l'optimisation et la création d'expériences utilisateur intuitives.",
        "about.p2": "En bref... J'aime développer, quelle que soit la plateforme.",
        "about.roles": ["développement en tout genre", "création de sites web", "problèmes à résoudre", "conception d'algorithmes", "création d'applications"],

        "exp.title": "Expériences",
        "exp.label.services": "Services :",
        "exp.label.highlights": "Points forts :",
        "exp.label.role": "Rôle :",
        "exp.label.stack": "Stack :",
        "exp.label.projects": "Projets :",
        "exp.label.mission": "Mission :",
        "exp.label.impact": "Impact :",

        "exp.freelance.title": "Développeur Full-stack Freelance",
        "exp.freelance.meta": "Nov 2017 - Aug 2021 | Tours & Remote",
        "exp.freelance.services": "Développement Web, CMS (Setup + Custom), Chatbots, Consulting SEO.",
        "exp.freelance.highlights": "Services bilingues Anglais/Français, background en Cyber Sécurité & SEO.",

        "exp.deloitte.title": "Deloitte — Cyber Risk Services",
        "exp.deloitte.meta": "Avr 2016 - Nov 2017 | Amsterdam, Pays-Bas",
        "exp.deloitte.role": "Développeur Full-stack au sein de l'équipe Ethical Hacking.",
        "exp.deloitte.stack": "C#, ASP.NET, AngularJS, HTML5, CSS3, Javascript.",
        "exp.deloitte.projects": "Outil \"Hacking as a Service\", systèmes Backoffice complexes, Portails Clients, moteurs de Reporting.",

        "exp.multivote.title": "Multivote",
        "exp.multivote.meta": "Mar 2014 - Déc 2014 | Bordeaux, France",
        "exp.multivote.role": "Développeur API.",
        "exp.multivote.stack": "Windows Azure, C#, ASP.NET.",
        "exp.multivote.mission": "Création d'APIs et optimisation des temps de calcul d'algorithmes sur de gros datasets via Azure.",

        "exp.ch.title": "Centre Hospitalier Robert Boulin",
        "exp.ch.meta": "Août 2012 - Déc 2012 | Libourne, France",
        "exp.ch.role": "Développeur Web.",
        "exp.ch.stack": "PHP, Javascript/jQuery, HTML5, CSS3.",
        "exp.ch.impact": "Création d'un outil de visualisation de datacenter (VM, CPU, Disque) : process de backup accéléré de 20%.",

        "skills.title": "Compétences & Intérêts",
        "skills.cat.languages": "Langages",
        "skills.list.languages": "C, C++, C#, HTML, CSS, Javascript, PHP, SQL, Python, Java, Kotlin",
        "skills.cat.domains": "Domaines",
        "skills.list.domains": "SEO, Sécurité Web, Ethical Hacking, AI/ML, Cloud Computing, Algorithmique",
        "skills.cat.frameworks": "Frameworks & Outils",
        "skills.list.frameworks": ".Net, AngularJS, NodeJS, Flask, Unity3D, Photoshop, Blender, Git, Docker",
        "skills.cat.softskills": "Compétences",
        "skills.list.softskills": "Gestion de Projet, Team Leading, Communication Business, Adaptabilité (Fast Learner)",
        "skills.cat.fluent": "Langues parlées",
        "skills.list.fluent": "Français, Anglais, Espagnol",
        "skills.cat.travels": "Voyages",
        "skills.list.travels": "États-Unis, Mexique, Argentine, Pérou, Caraïbes, Espagne, Italie, France, Pays-Bas",

        "edu.title": "Formation",
        "edu.epitech.title": "EPITECH",
        "edu.epitech.meta": "2011 - 2016 | Bordeaux & Paris, France",
        "edu.epitech.degree": "Expert en Technologies de l'Information",
        "edu.epitech.desc": "Pédagogie par projets, travail solo/groupe, apprentissage du C au Management & Team Leading.",

        "edu.ucsd.title": "UCSD",
        "edu.ucsd.meta": "Jan 2015 - Juil 2015 | San Diego, Californie, USA",
        "edu.ucsd.degree": "Computer Science Engineering Extension",
        "edu.ucsd.desc": "Cours techniques & théoriques incluant SEO et Business Communication Skills.",

        "contact.title": "Me Contacter",
        "contact.subtitle": "Actuellement en recherche de missions freelance.",
        "contact.btn.email": "Email",

        "footer.text": "© 2025 Baptiste Schlienger. Fait avec 💻 & 🍜."
    }
};

let currentLang = 'en';

function initLanguage() {
    const userLang = navigator.language || navigator.userLanguage;
    if (userLang.startsWith('fr')) {
        currentLang = 'fr';
    } else {
        currentLang = 'en';
    }

    updateLanguage(currentLang);

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const lang = btn.getAttribute('data-lang');
            currentLang = lang;
            updateLanguage(lang);
        });
    });
}

function updateLanguage(lang) {
    // Implement translations
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang][key]) {
            el.innerText = translations[lang][key];
        }
    });

    // Update buttons state
    document.querySelectorAll('.lang-btn').forEach(btn => {
        if (btn.getAttribute('data-lang') === lang) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Update glitch text context if needed (handled dynamically by next glitch loop)
}

function initTextGlitch() {
    const el = document.getElementById('glitch-text');
    if (!el) return;

    let phraseIndex = 0;
    const chars = "!<>-_\\/[]{}—=+*^?#________";

    setInterval(() => {
        // Use phrases based on current language
        const phrases = translations[currentLang]["about.roles"];

        phraseIndex = (phraseIndex + 1) % phrases.length;
        const newPhrase = phrases[phraseIndex];
        const oldPhrase = el.innerText;
        const length = Math.max(oldPhrase.length, newPhrase.length);
        const glitchDuration = 10; // frames
        let frame = 0;

        const interval = setInterval(() => {
            el.innerText = newPhrase
                .split("")
                .map((char, index) => {
                    return chars[Math.floor(Math.random() * chars.length)];
                })
                .join("");

            frame++;
            if (frame >= glitchDuration) {
                clearInterval(interval);
                el.innerText = newPhrase;
            }
        }, 50);
    }, 3000);
}

function initContactBackground() {
    const canvas = document.getElementById('contact-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const section = document.getElementById('contact');

    const portraitAscii = [
        "                                                       __,w,m0B0_",
        "                                                   _.m@00KNB0RKD0KK>",
        "                                         ___    _+@RBDN0RD@RBD0@RB0@7_",
        "                                     _,,o000B@@0BBB0BBB0NBB00BBB0BBBB$==_",
        "                                  ,d#@#@KND#NRD0NKD0RKBQ#K#D0K#D0NRB0#bEN0KRg",
        "                                __0R0N0@BNR0RNRBR0R0B0NB0RR0BR0RBR0B0B0N@NR0B0R__",
        "                               [0W0B@B0BB#0NBBN0BBRBBBB0NBBN0B@BNBBB0@BBN@B@B0NBBp",
        "                            _@0NRD0NRB0@RRQ0KRD0NRB0@RB0@K#D0RRB0NRB0@KRD0K#N0N#D0_",
        "                           BNBBBRB0B0RBBRN0BRRB0REBP``'^'`5BIBBB0BBB0BBNB0BBB0BEBBB",
        "                          [N#N#D@R@BB@RBDBNBD0B9\\          _ \"#N#B0B#BB#K#B#N#B#B#BNW",
        "                          0RRD0RRB0@RR0NRRRBRL`              -:@0NRB0@RR00RRD0R0R0@R@",
        "                          0BNB0B0R0BBB0BE~\"                    UZ8BNB0BNB0B0B0B0B0BBNB",
        "                          0D#K#DBK#N`(`                        /)[)0#BQDKBD@R#D0K#N0#K",
        "                           BBR0RRN'                            `    `T0BR0RB00RBB0N^TCI_",
        "                            `R0NBG                       _           `V0B0NNB0RBM  ,$\"``",
        "                                0H              __/p@K@KBN]b)_'       `PK0D0RKN   [      =",
        "                                +U`          _U@BBBB0P)`   `   ,       ,P0BBBE~ J`{ _    -",
        "                                `\\     _    _$B0N9&;|LPp#K0B$_ _     _   ]B0B#U,\"`&bE-",
        "                                 @:@P@P@__-    `^ {P@En]0E\"              !@6@0@c-        `",
        "                                 N0B0R00BWE       `  ```  `            `, U$B0QZ)`~     _#",
        "                                 D0B8Nb#K@QP                            _|bON0N#W)/     #0#",
        "                                  %9&@00RBR,                            -IR&B0N%@\\     S0RB@",
        "                                   !BNE]hP,                         ,  `L$b$B@N@NZ~;$p$bNB$B_",
        "                                    `%)[           `  _                y]$h$@0N#N0[bNN0N8@0N#",
        "                                     3                                _]PIPIBP8EBE0Pb^]LIE]80",
        "                                     !,_   ~_ _)B^B%| _   `_ _      ,|-Pb$h$B@NtN#NhP,-:Ph]N0",
        "                                      `      YN0@#N$!_____>n,_     _)!~TP6@6N0@0N0@Pb'[n.nY    ___",
        "                                       )_    (80B0N08ET00BNB0B(;    .]H]P]b]B@8B00NEQE),`   ,@0BBBB,",
        "                                        +P,_\\@K#NtN,- ',^\"Ph]\"#N   -)j\"Ph0N#K#N#B#NNBb   _#D0K#D0#KBQW",
        "                                         +@+@BR0@PN^       `   ,`- )C{PTR]BN@0R&N0@P   _0R0RBR0NRB0NRBRN_",
        "                                          `NB0B0U ~  _upP      -:__~;]b0B0B$B0B@BBP  ,0BNB0B0B0BBBBBWBB0N@_",
        "                                           'N8N#N#@#@RBb!_   __-)j)@8@NBK#K0N#N0N` _0K@D#K#D0N#D0@RBQ@RRD0KR@_",
        "                                             `00BCRE00h`   _ --S]Q0B00BB00B0B0RP` [BB00BBBNBBR&BBB00BB0NBBB0RBBW_",
        "                                               `NBNt&hP: _.-|htD#B#BBBBNB#NNBN-  0#KBBBNNB0NNB0NBBBBKNB#NNB0KBB0BK@",
        "                                                  N0@Ph06RQ@$N0NA@0@R@0@R0R0D  ,NRB0@RRD0KRR0N0@0@R00@RRD0RRD0NRB0@R,",
        "                                                   0BBN00B@00B0B0BBB0BB0B0\" ` ;0B0BB00NB0B0B0B0BBB0BB00NB0B0B0B0BB00NBw_",
        "                                                     `NKRKND0K#D0NKBQ#KBN`  _,K#D0#KBQ#KND#N#D0NKB0#KNQ#K#D0N#D0#KBQ#K#D",
        "                                                             `0R0@0N00P+  ` yBR0NRB0NRBRNR0R0R0R0N0@RNRBR0R0R0NR00NRBRNR",
        "                                                                t0BKB^ `   _B0BBB0BBB0#B0B0B0R0BBB0BB00NB0B0BBBBBBB0NBBB",
        "                                                                  `b~      #D0NRD0@RBQ@K@D0N#D0NRBQ@K@Q0N#D0NRD0@RB00KRD",
        "                                                                      `   @NB0R0R0BBNB0B0B0B0R0B00B0B0BBBNB0R0RBB0N0BB0B",
        "                                                                   _ _ ` |B#K#B0N#BB#K#B#N#B#N#BB#BBBBK#B0N#B0WBBBBK@B#N",
        "                                                                    `   `0NRD0NRD0@R@00K@D0RRD0NRB0@RBQ0RRD0NRD0@RBQ@RRD",
        "                                                                  0~ ` ,B0BBB0BBB0BBBB0BBB0B0B0BBB0BBNB0BNB0B0B0BBNB0BNB",
        "                                                                 N0#L_p#K#D#K#N0N#NK#K#B#K#N0N#N0N##B#K#D0K#D0RRBB#RBQBK",
        "                                                                |NRB0NRBD0RBR0RRR0NRB00RBR0RBR0@RB00R@R0RBD0RRB0NRB0NRBD",
        "                                                                0BBB0BBNB0B@B0BBB0BBNBBBBB#B0B0BBBBBBBB0BNB0BBBBBBN00BBB",
        "                                                                #D0RR@Q#K#D#K#D0N#@0#K0K#K#N0N#@0@#BQ#K#D0K#D0@RBQ#K@D@R",
        "                                                               ,0BBB00BB00BBB0RBR0BBB00BBB]BBR0RBB0NBBB0BBB0RBR00BB00BBR",
        "                                                              ;B0NBBBBB@B#B0B#NBB0BB@BBBBB$N0B0NBBBBNNB#N0B0NNB0BKBBBNNB",
        "                                                             R0N0@0@R0R@K0R0R0@0N0@0@R@Q0R0@0N#R0@R@R@RRD0R#D0R#B0@RRQ0K",
        "                                                            0BBR0BBB0NBB00B0B0B0B0BBBB0B0B0B0R0BBB0BBB00B0B0B0B0BBB0NBBR",
        "                                                           B#N#D0NKB0#KND#K#D0N#B0NKBQ#KBD#N#D#NBB0#KBD#K#D0N#B0#KB0#NRD",
        "                                                          0R0R0RRR0NR@RNR0R0R0R0N0@RNR0R0R@R0R0@0NR00NRBR0R0R0RRBBNRBR0R"
    ];

    // Reuse palette and noise from hero (duplicated here for scope isolation)
    const colors = ["#0081A7", "#00AFB9", "#7FD6CB", "#BEE9D4"/*, "#FDFCDC", "#FCF8EA"*/];
    let frame = 0;

    // Perlin Noise (Same implementation)
    const noise = (function () {
        const p = new Uint8Array(512);
        const permutation = [151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250, 121, 123, 82, 58, 183, 128, 157, 235, 192, 207, 215, 66, 129, 50, 210, 138, 242, 126, 253, 34, 70, 223, 61, 93, 222, 176, 189, 206, 81, 107, 31, 43, 153, 5, 67, 112, 180, 98, 243, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250, 121, 123, 82, 58, 183, 128, 157, 235, 192, 207, 215, 66, 129, 50, 210, 138, 242, 126, 253, 34, 70, 223, 61, 93, 222, 176, 189, 206, 81, 107, 31, 43, 153, 5, 67, 112, 180, 98, 243];
        for (let i = 0; i < 256; i++) p[256 + i] = p[i] = permutation[i];

        function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
        function lerp(t, a, b) { return a + t * (b - a); }
        function grad(hash, x, y, z) {
            const h = hash & 15;
            const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z;
            return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
        }

        return function (x, y, z) {
            const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
            x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
            const u = fade(x), v = fade(y), w = fade(z);
            const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z, B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;

            return lerp(w, lerp(v, lerp(u, grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z)),
                lerp(u, grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z))),
                lerp(v, lerp(u, grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1)),
                    lerp(u, grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1))));
        };
    })();

    // Calculate dimensions
    let cols = 0;
    portraitAscii.forEach(line => {
        if (line.length > cols) cols = line.length;
    });
    const rows = portraitAscii.length;

    function draw() {
        // Animation Loop
        const w = section.offsetWidth;
        const h = section.offsetHeight;
        canvas.width = w;
        canvas.height = h;

        // Calculate font size
        const fontSize = h / rows;
        const font = `900 ${fontSize}px "JetBrains Mono"`;
        ctx.font = font;

        const metrics = ctx.measureText("M");
        const charWidth = metrics.width;

        const totalAsciiWidth = cols * charWidth;
        const startX = w - totalAsciiWidth;

        ctx.clearRect(0, 0, w, h);
        ctx.textBaseline = 'top';

        // Noise progress
        const zOff = frame * 0.005;

        for (let r = 0; r < rows; r++) {
            const line = portraitAscii[r];
            // Iterate visible characters to apply color individually
            for (let c = 0; c < line.length; c++) {
                const char = line[c];
                if (char === " " || char === "") continue;

                // Perlin Noise Color
                const noiseVal = noise(c * 0.03, r * 0.03, zOff);
                const norm = (noiseVal + 1) / 2;
                let colorIndex = Math.floor(norm * colors.length);
                if (colorIndex >= colors.length) colorIndex = colors.length - 1;
                if (colorIndex < 0) colorIndex = 0;

                ctx.fillStyle = colors[colorIndex];

                // Draw single char
                ctx.fillText(char, startX + c * charWidth, r * fontSize);
            }
        }

        frame++;
        requestAnimationFrame(draw);
    }

    // Start animation
    requestAnimationFrame(draw);
}

function initGlitchBackground() {
    const canvas = document.getElementById('glitch-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width, height;

    // Palette (ordered from dark to light for noise mapping)
    const colors = ["#0081A7", "#00AFB9", "#7FD6CB", "#BEE9D4", "#FDFCDC", "#FCF8EA"];
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$#@%&{}[]()<>*+-=/";

    // Grid settings
    const fontSize = 14;
    const charWidth = 9; // Tighter horizontal spacing
    let columns, rows;

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        columns = Math.ceil(width / charWidth);
        rows = Math.ceil(height / fontSize);
    }

    // Simplified 2D Perlin Noise Implementation
    const noise = (function () {
        const p = new Uint8Array(512);
        const permutation = [151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250, 121, 123, 82, 58, 183, 128, 157, 235, 192, 207, 215, 66, 129, 50, 210, 138, 242, 126, 253, 34, 70, 223, 61, 93, 222, 176, 189, 206, 81, 107, 31, 43, 153, 5, 67, 112, 180, 98, 243, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250, 121, 123, 82, 58, 183, 128, 157, 235, 192, 207, 215, 66, 129, 50, 210, 138, 242, 126, 253, 34, 70, 223, 61, 93, 222, 176, 189, 206, 81, 107, 31, 43, 153, 5, 67, 112, 180, 98, 243];
        for (let i = 0; i < 256; i++) p[256 + i] = p[i] = permutation[i];

        function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
        function lerp(t, a, b) { return a + t * (b - a); }
        function grad(hash, x, y, z) {
            const h = hash & 15;
            const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z;
            return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
        }

        return function (x, y, z) {
            const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
            x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
            const u = fade(x), v = fade(y), w = fade(z);
            const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z, B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;

            return lerp(w, lerp(v, lerp(u, grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z)),
                lerp(u, grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z))),
                lerp(v, lerp(u, grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1)),
                    lerp(u, grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1))));
        };
    })();


    // ASCII Art Name (Desktop)
    const asciiArtDesktop = [
        "   ___            __  _     __        ____    __   ___                      ",
        "  /#_#)___ ____  /#/_(_)__ /#/____   /#__/___/#/  /#(_)__ ___  ___ ____ ____",
        " /#_##/#_#`/#_#\\/#__/#(_-</#__/#-_) _\\#\\/#__/#_#\\/#/#/#-_)#_#\\/#_#`/#-_)#__/",
        "/____/\\_,_/#.__/\\__/_/___/\\__/\\__/ /___/\\__/_//_/_/_/\\__/_//_/\\_,#/\\__/_/   ",
        "         /_/                                                 /___/          "
    ];

    // ASCII Art Name (Mobile - Stacked)
    const asciiArtMobile = [
        "       ___            __  _     __     ",
        "      /#_#)___ ____  /#/_(_)__ /#/____ ",
        "     /#_##/#_#`/#_#\\/#__/#(_-</#__/#-_)",
        "    /____/\\_,_/#.__/\\__/_/___/\\__/\\__/ ",
        "             /_/                       ",
        "   ____    __   ___                      ",
        "  /#__/___/#/  /#(_)__ ___  ___ ____ ____",
        " _\\#\\/#__/#_#\\/#/#/#-_)#_#\\/#_#`/#-_)#__/",
        "/___/\\__/_//_/_/_/\\__/_//_/\\_,#/\\__/_/   ",
        "                          /___/          "
    ];

    // Animation state
    let frame = 0;

    // Create a persistent grid to hold current char
    let grid = [];

    // Animation settings
    const revealDuration = 90; // Frames (1.5 seconds at 60fps)

    function initGrid() {
        grid = [];
        for (let r = 0; r < rows; r++) {
            let rowData = [];
            for (let c = 0; c < columns; c++) {
                rowData.push({
                    char: chars[Math.floor(Math.random() * chars.length)],
                    isAscii: false // Track if this cell is part of the name
                });
            }
            grid.push(rowData);
        }

        // Embed ASCII art into the grid
        const currentArt = window.innerWidth < 768 ? asciiArtMobile : asciiArtDesktop;

        const artHeight = currentArt.length;
        const artWidth = currentArt[0].length;

        const startRow = Math.floor((rows - artHeight) / 2) - 2; // Center vertically, slightly up
        const startCol = Math.floor((columns - artWidth) / 2); // Center horizontally

        for (let r = 0; r < artHeight; r++) {
            for (let c = 0; c < artWidth; c++) {
                const char = currentArt[r][c] || " "; // Handle varying line lengths if any

                // If it's a '#' placeholder or a visible character, we lock it
                if (char !== " ") {
                    if (startRow + r >= 0 && startRow + r < rows && startCol + c >= 0 && startCol + c < columns) {

                        // Treat '#' as a special "Empty Block" that prevents noise
                        const isPlaceholder = char === "#";
                        const target = isPlaceholder ? " " : char; // Target is empty space if placeholder

                        // Assign random reveal time for "decoding" effect
                        const revealDelay = Math.floor(Math.random() * revealDuration);

                        grid[startRow + r][startCol + c] = {
                            char: chars[Math.floor(Math.random() * chars.length)], // Start random
                            targetChar: target, // Target to settle on
                            isAscii: true, // It IS part of the ASCII block (even if empty space)
                            color: "#f07167", // Static color requested
                            revealTime: revealDelay,
                            settled: false,
                            isPlaceholder: isPlaceholder // Flag to hide completely if needed, or just render empty
                        };
                    }
                }
            }
        }

        // Reset frame for animation sync on resize/init
        frame = 0;
    }

    // Mouse State
    let mouse = { x: -1000, y: -1000 };

    // Update mouse position relative to canvas
    window.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
    });

    // Clear mouse influence when leaving the section
    document.querySelector('.hero-section').addEventListener('mouseleave', () => {
        mouse.x = -1000;
        mouse.y = -1000;
    });

    function draw() {
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        ctx.font = fontSize + 'px "JetBrains Mono"';

        const zOff = frame * 0.005;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < columns; c++) {
                let cell = grid[r][c];
                const x = c * charWidth;
                const y = r * fontSize;

                if (cell.isAscii) {
                    // Decoding Animation Logic
                    if (!cell.settled) {
                        if (frame >= cell.revealTime) {
                            cell.char = cell.targetChar;
                            cell.settled = true;
                        } else {
                            if (frame % 3 === 0) {
                                cell.char = chars[Math.floor(Math.random() * chars.length)];
                            }
                        }
                    }

                    ctx.fillStyle = cell.color;
                    ctx.globalAlpha = 1.0;
                    ctx.fillText(cell.char, x, y);
                    continue;
                }

                // Perlin Noise Logic
                let noiseVal = noise(c * 0.03, r * 0.03, zOff);

                // Mouse Disruption
                // Calculate distance to mouse
                const dx = x - mouse.x;
                const dy = y - (mouse.y - fontSize / 2); // Adjust for font baseline approx
                const dist = Math.sqrt(dx * dx + dy * dy);
                const interactionRadius = 150;

                if (dist < interactionRadius) {
                    // Normalize influence (1 at center, 0 at edge)
                    const influence = (1 - dist / interactionRadius);

                    // Disrupt noise value -> pushes it towards 1 (brighter colors)
                    noiseVal += influence * 0.8;

                    // Disrupt character (High chance of glitch)
                    if (Math.random() < influence * 0.5) {
                        cell.char = chars[Math.floor(Math.random() * chars.length)];
                    }
                }

                // Organic Disruption behind Subtitle/Location
                // Center point for the subtitle "cloud"
                const artCenterRow = Math.floor(rows / 2);
                const artHeight = window.innerWidth < 768 ? asciiArtMobile.length : asciiArtDesktop.length;

                // Target: Roughly below the ASCII Name
                const cloudCenterRow = artCenterRow + Math.floor(artHeight / 2) + 4;
                const cloudCenterY = cloudCenterRow * fontSize;
                const cloudCenterX = (columns * charWidth) / 2;

                // Calculate elliptical distance (Squash Y to make it wide)
                const cDx = x - cloudCenterX;
                const cDy = (y - cloudCenterY) * 2.5; // Stronger Y squash for wide cloud
                const cloudDist = Math.sqrt(cDx * cDx + cDy * cDy);

                // Breathing radius: shifts over time
                const baseRadius = window.innerWidth < 768 ? 250 : 450;
                const breath = Math.sin(frame * 0.02) * 50;
                const cloudRadius = baseRadius + breath;

                if (cloudDist < cloudRadius) {
                    // Soft falloff
                    const cloudInfluence = (1 - cloudDist / cloudRadius);
                    // Boost noise: creates a "light source" that reveals lighter colors
                    // The underlying Perlin noise (noiseVal) provides the "shifting/organic" texture automatically
                    // We just lift the floor of the values in this area.
                    noiseVal += cloudInfluence * 0.6;
                }

                const norm = (noiseVal + 1) / 2;
                let colorIndex = Math.floor(norm * colors.length);
                if (colorIndex >= colors.length) colorIndex = colors.length - 1;
                if (colorIndex < 0) colorIndex = 0;

                // Standard Active Noise update chance
                if (Math.random() > 0.99) {
                    cell.char = chars[Math.floor(Math.random() * chars.length)];
                }

                ctx.fillStyle = colors[colorIndex];
                ctx.fillText(cell.char, x, y);
            }
        }

        frame++;
        requestAnimationFrame(draw);
    }

    window.addEventListener('resize', () => {
        resize();
        initGrid();
    });
    resize();
    initGrid();
    draw();
}

/* Scroll Handling */
window.addEventListener('scroll', () => {
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('.nav-links li a');

    let current = '';

    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (pageYOffset >= (sectionTop - sectionHeight / 3)) {
            current = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href').includes(current)) {
            link.classList.add('active');
        }
    });
});

/* Konami Code (Kept as a hidden gem, maybe less invasive) */
const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let konamiIndex = 0;

document.addEventListener('keydown', (e) => {
    if (e.key === konamiCode[konamiIndex]) {
        konamiIndex++;
        if (konamiIndex === konamiCode.length) {
            activateKonami();
            konamiIndex = 0;
        }
    } else {
        konamiIndex = 0;
    }
});

function activateKonami() {
    alert('Classic Mode Interrupted. Running Diagnostics...');
    document.body.style.filter = 'invert(1)';
}

/* Mobile Menu Toggle */
const hamburger = document.querySelector('.hamburger');
const navLinksContainer = document.querySelector('.nav-links');

if (hamburger) {
    hamburger.addEventListener('click', () => {
        navLinksContainer.classList.toggle('active');

        // Simple animation for hamburger manually if desired, or just use CSS
        // For now, simple toggle
    });

    // Close menu when a link is clicked
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            navLinksContainer.classList.remove('active');
        });
    });
}
