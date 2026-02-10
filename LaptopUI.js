import { ASSETS } from './config.js';

export class LaptopUI {
    constructor(onClose) {
        this.onClose = onClose;
        this.isVisible = false;
        
        // Mock Data
        this.currentUser = null;
        this.emails = [
            {
                id: 1,
                from: "admin@verbatim.net",
                subject: "Welcome to Verbatim OS",
                date: "Oct 24, 1998",
                body: "Welcome to your new workstation.\n\nRemember to change your password from the default 'password123'.\n\n- IT Department"
            },
            {
                id: 2,
                from: "supervisor@verbatim.net",
                subject: "Subject #42 Observation",
                date: "Oct 29, 1998",
                body: "The subject is showing signs of paranoia. The shifting geometry test in the hallway exceeded expectations.\n\nEnsure the basement containment unit is sealed. We cannot risk another breach."
            },
            {
                id: 3,
                from: "m.williams@verbatim.net",
                subject: "RE: Door Malfunction",
                date: "Nov 01, 1998",
                body: "I've locked the basement key in the safe. The code is the date of the 'incident'.\n\n(Note to self: 10-31)"
            },
            {
                id: 4,
                from: "system@verbatim.net",
                subject: "URGENT: Database Migration",
                date: "Nov 02, 1998",
                body: "All subject files have been moved to the secure archive.\n\nAccess via internal network only: http://192.168.0.42/archive\n\nLogin credentials have not changed."
            }
        ];
        
        this.browserHistory = [
            { title: "Verbatim Search", url: "www.search.vb" },
            { title: "Local News", url: "www.dailynews.vb" }
        ];

        this.injectStyles();
        this.createDOM();
    }

    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #laptop-container {
                position: absolute;
                top: 0; left: 0;
                width: 100vw; height: 100vh;
                background: rgba(0, 0, 0, 0.85);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 2000;
                backdrop-filter: blur(5px);
            }
            
            #laptop-screen {
                width: 800px;
                height: 600px;
                max-width: 100vw;
                max-height: 100vh;
                background-color: #008080; /* Windows 95 Teal */
                background-image: url('${ASSETS.LAPTOP_SCREEN}'); 
                background-size: cover;
                position: relative;
                border: 20px solid #333;
                border-radius: 10px 10px 0 0;
                box-shadow: 0 0 50px rgba(0,0,0,0.5);
                overflow: hidden;
                font-family: 'Tahoma', 'Segoe UI', sans-serif;
                image-rendering: pixelated;
                box-sizing: border-box; /* Ensure border is included in dimensions */
            }

            /* Mobile adjustments */
            @media (max-width: 850px) {
                #laptop-screen {
                    border-width: 10px; /* Thinner bezel on mobile */
                    width: 100%;
                    height: 75vh; /* Use most of height but leave room for close button */
                }
                .icon {
                    margin: 10px; /* Tighter spacing */
                }
                .window {
                    left: 10px !important;
                    top: 10px !important;
                    width: calc(100% - 20px) !important;
                    height: calc(100% - 60px) !important;
                }
            }

            /* CRT Effect */
            #laptop-screen::after {
                content: " ";
                display: block;
                position: absolute;
                top: 0; left: 0; bottom: 0; right: 0;
                background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.1) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
                z-index: 2;
                background-size: 100% 2px, 3px 100%;
                pointer-events: none;
            }

            .window {
                position: absolute;
                background: #c0c0c0;
                border: 2px solid;
                border-color: #dfdfdf #404040 #404040 #dfdfdf;
                box-shadow: 2px 2px 5px rgba(0,0,0,0.3);
                display: flex;
                flex-direction: column;
                min-width: 300px;
                min-height: 200px;
            }

            .title-bar {
                background: #000080;
                color: white;
                padding: 4px 6px;
                font-weight: bold;
                font-size: 14px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: default;
            }

            .close-btn {
                background: #c0c0c0;
                color: black;
                border: 1px solid;
                border-color: #dfdfdf #404040 #404040 #dfdfdf;
                width: 16px;
                height: 16px;
                font-size: 10px;
                line-height: 14px;
                text-align: center;
                cursor: pointer;
            }

            .window-content {
                padding: 10px;
                flex: 1;
                overflow: auto;
                font-size: 14px;
                color: black;
            }

            /* Desktop Icons */
            .icon {
                width: 64px;
                height: 70px;
                margin: 20px;
                display: flex;
                flex-direction: column;
                align-items: center;
                cursor: pointer;
                color: white;
                text-shadow: 1px 1px 1px black;
                font-size: 12px;
                text-align: center;
            }
            .icon:hover {
                background: rgba(0, 0, 128, 0.3);
                border: 1px dotted white;
            }
            .icon img {
                width: 32px;
                height: 32px;
                margin-bottom: 5px;
            }

            /* Login Screen */
            .login-box {
                width: 300px;
                background: #c0c0c0;
                border: 2px solid;
                border-color: #dfdfdf #404040 #404040 #dfdfdf;
                padding: 4px;
                position: absolute;
                top: 50%; left: 50%;
                transform: translate(-50%, -50%);
            }
            .login-field {
                margin: 10px 0;
            }
            .login-field label {
                display: block;
                margin-bottom: 4px;
            }
            .login-field input {
                width: 100%;
                padding: 2px;
            }
            .login-btn {
                padding: 4px 12px;
                background: #c0c0c0;
                border: 2px solid;
                border-color: #dfdfdf #404040 #404040 #dfdfdf;
                cursor: pointer;
            }
            .login-btn:active {
                border-color: #404040 #dfdfdf #dfdfdf #404040;
            }
            .error-msg {
                color: red;
                font-size: 12px;
                margin-top: 5px;
                display: none;
            }

            /* Email App */
            .email-list {
                border: 1px solid #808080;
                background: white;
                height: 150px;
                overflow-y: scroll;
                margin-bottom: 10px;
            }
            .email-item {
                padding: 2px 4px;
                cursor: pointer;
                border-bottom: 1px dotted #ccc;
            }
            .email-item.unread {
                font-weight: bold;
            }
            .email-item:hover, .email-item.selected {
                background: #000080;
                color: white;
            }
            .email-view {
                border: 1px solid #808080;
                background: white;
                height: 200px;
                padding: 10px;
                overflow-y: auto;
            }

            /* Browser */
            .url-bar {
                display: flex;
                margin-bottom: 10px;
            }
            .url-input {
                flex: 1;
                margin-right: 5px;
            }
            .web-view {
                background: white;
                border: 1px solid #808080;
                height: 300px;
                padding: 20px;
                overflow-y: auto; /* Ensure scrollable */
            }
            .web-link {
                color: blue;
                text-decoration: underline;
                cursor: pointer;
            }
            .web-link:hover {
                filter: brightness(1.2);
                opacity: 0.8;
            }
            .web-container {
                max-width: 600px;
                margin: 0 auto;
                font-family: 'Times New Roman', serif;
            }
            .web-header {
                text-align: center;
                border-bottom: 2px solid black;
                margin-bottom: 20px;
                padding-bottom: 10px;
            }
            .web-img {
                width: 100%;
                max-width: 400px;
                border: 1px solid #000;
                display: block;
                margin: 10px auto;
            }
            .search-result {
                margin-bottom: 15px;
            }
            .search-title {
                color: blue;
                text-decoration: underline;
                cursor: pointer;
                font-size: 16px;
            }
            .search-url {
                color: green;
                font-size: 12px;
            }
            .deep-web-text {
                color: #ff00ff;
                text-shadow: 2px 2px #330033;
                font-family: 'Courier New', Courier, monospace;
            }
            .glitch-text {
                animation: glitch 2s infinite;
            }
            @keyframes glitch {
                0% { transform: translate(0); }
                20% { transform: translate(-2px, 2px); }
                40% { transform: translate(-2px, -2px); }
                60% { transform: translate(2px, 2px); }
                80% { transform: translate(2px, -2px); }
                100% { transform: translate(0); }
            }
        `;
        document.head.appendChild(style);
    }

    createDOM() {
        this.container = document.createElement('div');
        this.container.id = 'laptop-container';
        
        // Laptop Bezel/Screen Wrapper
        this.screen = document.createElement('div');
        this.screen.id = 'laptop-screen';
        this.container.appendChild(this.screen);

        // Power Button (Close UI)
        // Adjust positioning for mobile
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.display = 'flex';
        wrapper.style.justifyContent = 'center';
        wrapper.style.width = '100%';
        wrapper.appendChild(this.screen);
        
        const powerLabel = document.createElement('div');
        powerLabel.textContent = "POWER";
        powerLabel.style.cssText = "color: #555; font-size: 10px; position: absolute; bottom: -35px; right: 18px; font-family: sans-serif;";
        wrapper.appendChild(powerLabel);
        
        const btn = document.createElement('div');
        btn.style.cssText = `
            position: absolute; bottom: -25px; right: 20px;
            width: 20px; height: 20px;
            background: #222; border-radius: 50%;
            border: 1px solid #444; box-shadow: 0 0 5px #00ff00;
            cursor: pointer;
            z-index: 2001;
        `;
        btn.addEventListener('click', () => this.hide());
        // Add touch event specifically for button to ensure it works
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.hide();
        });
        wrapper.appendChild(btn);

        this.container.innerHTML = ''; // Clear
        this.container.appendChild(wrapper);

        document.body.appendChild(this.container);

        // Initial State Render
        // Testing: Auto-login as Admin
        this.currentUser = 'Admin';
        this.renderDesktop();
    }

    show() {
        this.isVisible = true;
        this.container.style.display = 'flex';
        // Hide Game HUD
        const uiContainer = document.getElementById('ui-container');
        if (uiContainer) uiContainer.style.display = 'none';
    }

    hide() {
        this.isVisible = false;
        this.container.style.display = 'none';
        
        // Show Game HUD
        const uiContainer = document.getElementById('ui-container');
        if (uiContainer) uiContainer.style.display = 'flex';

        if (this.onClose) this.onClose();
    }

    renderLogin() {
        this.screen.innerHTML = '';
        
        // Background remains (CSS)
        
        const loginBox = document.createElement('div');
        loginBox.className = 'login-box';
        loginBox.innerHTML = `
            <div class="title-bar" style="margin-bottom: 10px;">Login System</div>
            <div class="window-content">
                <div class="login-field">
                    <label>Username:</label>
                    <input type="text" value="Admin" disabled>
                </div>
                <div class="login-field">
                    <label>Password:</label>
                    <input type="password" id="password-input" autofocus>
                </div>
                <div class="error-msg" id="login-error">Incorrect Password</div>
                <div style="text-align: right; margin-top: 10px;">
                    <button class="login-btn" id="login-submit">OK</button>
                </div>
            </div>
        `;
        this.screen.appendChild(loginBox);

        const input = loginBox.querySelector('#password-input');
        const submit = loginBox.querySelector('#login-submit');
        const error = loginBox.querySelector('#login-error');

        const attemptLogin = () => {
            if (input.value === 'password123' || input.value === 'admin') { // Cheat for demo
                this.currentUser = 'Admin';
                this.renderDesktop();
            } else {
                error.style.display = 'block';
                input.value = '';
                // Shake effect
                loginBox.style.transform = 'translate(-55%, -50%)';
                setTimeout(() => loginBox.style.transform = 'translate(-45%, -50%)', 50);
                setTimeout(() => loginBox.style.transform = 'translate(-50%, -50%)', 100);
            }
        };

        submit.addEventListener('click', attemptLogin);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') attemptLogin();
        });
        
        // Focus hack
        setTimeout(() => input.focus(), 100);
    }

    renderDesktop() {
        this.screen.innerHTML = '';
        
        // Desktop Icons
        const iconContainer = document.createElement('div');
        iconContainer.style.cssText = "display: flex; flex-direction: column; align-items: flex-start; padding: 20px;";
        
        const apps = [
            { name: "My Emails", icon: "✉️", action: () => this.openEmail() },
            { name: "Netscape", icon: "🌐", action: () => this.openBrowser() },
            { name: "Recycle Bin", icon: "🗑️", action: () => this.openRecycleBin() }
        ];

        apps.forEach(app => {
            const el = document.createElement('div');
            el.className = 'icon';
            el.innerHTML = `<div style="font-size: 32px; margin-bottom: 5px;">${app.icon}</div>${app.name}`;
            el.addEventListener('dblclick', app.action); // Double click for authenticity
            // Touch support
            let lastTap = 0;
            el.addEventListener('touchend', (e) => {
                const currentTime = new Date().getTime();
                const tapLength = currentTime - lastTap;
                if (tapLength < 500 && tapLength > 0) {
                    app.action();
                    e.preventDefault();
                }
                lastTap = currentTime;
            });
            iconContainer.appendChild(el);
        });

        this.screen.appendChild(iconContainer);
        
        // Taskbar
        const taskbar = document.createElement('div');
        taskbar.style.cssText = `
            position: absolute; bottom: 0; left: 0; width: 100%; height: 28px;
            background: #c0c0c0; border-top: 2px solid #dfdfdf;
            display: flex; align-items: center; padding: 0 4px;
        `;
        
        const startBtn = document.createElement('div');
        startBtn.innerHTML = "<b>Start</b>";
        startBtn.style.cssText = `
            border: 2px outset #dfdfdf; padding: 2px 6px; margin-right: 10px; cursor: pointer;
            font-size: 12px;
        `;
        taskbar.appendChild(startBtn);
        
        // Clock
        const clock = document.createElement('div');
        clock.style.cssText = `
            margin-left: auto; border: 2px inset #dfdfdf; padding: 2px 6px; font-size: 11px;
        `;
        const updateClock = () => {
            const now = new Date();
            clock.textContent = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        };
        updateClock();
        setInterval(updateClock, 60000);
        taskbar.appendChild(clock);

        this.screen.appendChild(taskbar);
    }

    openRecycleBin() {
        this.createWindow("Recycle Bin", 400, 300, (content) => {
            content.style.display = 'flex';
            content.style.flexWrap = 'wrap';
            content.style.gap = '10px';
            content.style.padding = '20px';
            content.style.background = 'white';
            content.style.height = '100%';
            content.style.boxSizing = 'border-box';

            const deletedFiles = [
                { name: "family_photo.jpg", icon: "🖼️", url: ASSETS.FAMILY_PORTRAIT },
                { name: "subject_42_log.jpg", icon: "🖼️", url: ASSETS.ARCHIVE_IMAGE }
            ];

            deletedFiles.forEach(file => {
                const fileEl = document.createElement('div');
                fileEl.style.cssText = `
                    width: 80px; height: 90px;
                    display: flex; flex-direction: column;
                    align-items: center; justify-content: center;
                    cursor: pointer; text-align: center;
                    font-size: 11px; color: black;
                `;
                fileEl.innerHTML = `<div style="font-size: 32px;">${file.icon}</div>${file.name}`;
                
                const openFile = (e) => {
                    if (e) e.stopPropagation();
                    this.openImageViewer(file.name, file.url);
                };

                fileEl.addEventListener('click', openFile);
                fileEl.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openFile();
                });
                
                fileEl.addEventListener('mouseenter', () => fileEl.style.background = '#00008033');
                fileEl.addEventListener('mouseleave', () => fileEl.style.background = 'transparent');

                content.appendChild(fileEl);
            });
        });
    }

    openImageViewer(title, url) {
        this.createWindow(title + " - Image Viewer", 500, 450, (content) => {
            content.style.background = '#808080';
            content.style.display = 'flex';
            content.style.justifyContent = 'center';
            content.style.alignItems = 'center';
            content.style.padding = '0';
            content.style.overflow = 'hidden';

            const img = document.createElement('img');
            img.src = url;
            img.style.maxWidth = '100%';
            img.style.maxHeight = '100%';
            img.style.objectFit = 'contain';
            img.style.display = 'block';
            
            content.appendChild(img);
        });
    }

    openEmail() {
        this.createWindow("Inbox - Outlook Express", 500, 400, (content) => {
            content.style.display = 'flex';
            content.style.flexDirection = 'column';
            
            const list = document.createElement('div');
            list.className = 'email-list';
            
            const view = document.createElement('div');
            view.className = 'email-view';
            view.innerHTML = '<div style="color: #666; text-align: center; margin-top: 50px;">Select an email to read</div>';
            
            this.emails.forEach(email => {
                const item = document.createElement('div');
                item.className = 'email-item';
                item.innerHTML = `
                    <div style="display:flex; justify-content:space-between; pointer-events: none;">
                        <span>From: ${email.from}</span>
                        <span>${email.date}</span>
                    </div>
                    <div style="pointer-events: none;">${email.subject}</div>
                `;
                
                const selectEmail = (e) => {
                    if (e) e.stopPropagation();
                    
                    // Highlight using classes instead of inline styles
                    Array.from(list.children).forEach(c => c.classList.remove('selected'));
                    item.classList.add('selected');
                    
                    // Show Content
                    view.innerHTML = `
                        <div style="border-bottom: 1px solid #ccc; padding-bottom: 10px; margin-bottom: 10px;">
                            <div><b>From:</b> ${email.from}</div>
                            <div><b>Subject:</b> ${email.subject}</div>
                            <div><b>Date:</b> ${email.date}</div>
                        </div>
                        <div style="white-space: pre-wrap; font-family: 'Courier New';">${email.body}</div>
                    `;
                };

                item.addEventListener('click', selectEmail);
                item.addEventListener('touchstart', (e) => {
                    // Prevent double firing but ensure it works on touch
                    e.stopPropagation(); 
                    selectEmail(e);
                }, { passive: true });

                list.appendChild(item);
            });
            
            content.appendChild(list);
            content.appendChild(view);
        });
    }

    openBrowser() {
        this.createWindow("Netscape Navigator", 700, 500, (content) => {
            const bar = document.createElement('div');
            bar.className = 'url-bar';
            
            const input = document.createElement('input');
            input.className = 'url-input';
            input.value = "http://www.googol.vb"; // Default home
            
            const goBtn = document.createElement('button');
            goBtn.textContent = "Go";
            
            bar.appendChild(input);
            bar.appendChild(goBtn);
            
            const view = document.createElement('div');
            view.className = 'web-view';
            
            const loadPage = (url) => {
                // Normalize URL
                url = url.toLowerCase();
                if (!url.startsWith('http://')) {
                    if (url.startsWith('www')) url = 'http://' + url;
                    else url = 'http://www.' + url;
                }
                
                input.value = url;
                view.innerHTML = '<div style="text-align: center; padding-top: 50px;">Connecting...</div>';
                
                setTimeout(() => {
                    view.scrollTop = 0; // Reset scroll
                    
                    if (url.includes('googol') || url.includes('search')) {
                        this.renderGoogol(view, (link) => loadPage(link));
                    } else if (url.includes('dailynews')) {
                        this.renderNews(view);
                    } else if (url.includes('truthseekers') || url.includes('occult')) {
                        this.renderOccult(view, (link) => loadPage(link));
                    } else if (url.includes('192.168.0.42') || url.includes('archive')) {
                        this.renderArchive(view);
                    } else if (url.includes('v-v-v') || url.includes('deep')) {
                        this.renderDeepWeb(view);
                    } else {
                        view.innerHTML = `
                            <h1>404 Not Found</h1>
                            <p>The requested URL was not found on this server.</p>
                            <hr>
                            <i>Verbatim/1.0 Server at localhost Port 80</i>
                        `;
                    }
                }, 400 + Math.random() * 400); // Simulate modem lag
            };
            
            goBtn.addEventListener('click', () => loadPage(input.value));
            input.addEventListener('keypress', (e) => { if(e.key === 'Enter') loadPage(input.value); });
            
            content.appendChild(bar);
            content.appendChild(view);
            
            // Initial load
            loadPage(input.value);
        });
    }

    renderGoogol(container, navigate) {
        container.innerHTML = `
            <div class="web-container" style="text-align: center;">
                <h1 style="color: blue; font-size: 48px; margin-bottom: 5px;">Googol!</h1>
                <div style="font-size: 12px; margin-bottom: 20px;">Search the web using <i>Googol</i>!</div>
                
                <div style="background: #eee; padding: 20px; border: 1px solid #ccc; margin-bottom: 30px;">
                    <input type="text" placeholder="Search..." style="width: 70%; padding: 4px;">
                    <button>Search</button>
                </div>

                <div style="text-align: left;">
                    <h3>What's New!</h3>
                    
                    <div class="search-result">
                        <div class="search-title" data-link="http://www.dailynews.vb">The Daily Herald - Local News</div>
                        <div class="search-url">www.dailynews.vb</div>
                        <div class="search-desc">Your trusted source for local county news, sports, and weather. Breaking: Investigations into Hill St. disappearances continue.</div>
                    </div>

                    <div class="search-result">
                        <div class="search-title" data-link="http://www.truthseekers.vb">The Truth Seekers Forum</div>
                        <div class="search-url">www.truthseekers.vb/forum</div>
                        <div class="search-desc">Uncovering the paranormal truth. Recent threads: The House that Vanishes, Geometry shifts, Government coverups.</div>
                    </div>

                    <div class="search-result">
                        <div class="search-title" data-link="http://www.mycatpage.vb">Mittens Home Page</div>
                        <div class="search-url">www.mycatpage.vb/~mittens</div>
                        <div class="search-desc">Under Construction! Look at my cute cat pictures. Updated Oct 1998.</div>
                    </div>
                </div>
                
                <div style="margin-top: 50px; font-size: 10px; color: #888;">
                    &copy; 1998 Googol Inc. All rights reserved.
                </div>
            </div>
        `;

        // Attach listeners with robust touch/click handling
        container.querySelectorAll('.search-title').forEach(el => {
            const handleNav = (e) => {
                e.preventDefault();
                e.stopPropagation();
                navigate(el.dataset.link);
            };
            
            // Use both events but handle the potential double-fire via preventDefault?
            // Actually, for simple links, just click is usually fine if we don't have conflicting touch handlers.
            // But since we had issues before, explicit touchstart is safer for responsiveness.
            el.addEventListener('click', handleNav);
            el.addEventListener('touchstart', handleNav, { passive: false });
        });
    }

    renderNews(container) {
        container.innerHTML = `
            <div class="web-container" style="background: #fdfbf7; padding: 10px; color: black;">
                <div class="web-header">
                    <h1 style="font-family: 'Times New Roman'; margin: 0; font-size: 42px;">The Daily Herald</h1>
                    <div style="border-top: 1px solid black; border-bottom: 1px solid black; padding: 4px; margin-top: 5px; font-size: 12px; display: flex; justify-content: space-between;">
                        <span>Vol. XCII No. 412</span>
                        <span>October 31, 1998</span>
                        <span>Price: 50 cents</span>
                    </div>
                </div>

                <h2 style="font-size: 28px; margin-bottom: 10px;">POLICE BAFFLED: SIXTH DISAPPEARANCE CONFIRMED</h2>
                <div style="font-style: italic; font-size: 12px; margin-bottom: 10px;">By Sarah Jenkins, Staff Writer</div>
                
                <img src="${ASSETS.NEWS_IMAGE}" class="web-img" alt="Police Tape">
                <div style="font-size: 10px; color: #555; text-align: center; margin-bottom: 15px;">Police cordon off the abandoned estate on Hill St.</div>

                <p>The quiet town of Oakhaven is once again gripped by fear as local authorities confirm the disappearance of yet another resident, marking the sixth such case in as many months.</p>
                
                <p>Sheriff Brody addressed the press earlier this morning outside the condemned Victorian estate on Hill Street, a location that has become the focal point of the investigation.</p>
                
                <p>"We are doing everything in our power," Brody stated, appearing visibly exhausted. "We urge citizens to stay indoors after dark and to report any unusual activity near the old manor."</p>

                <p>Witnesses report strange lights and sounds emanating from the house, despite the power being cut off nearly a decade ago. Local historian Arthur Clarke suggests the house's history is marred by tragedy dating back to its construction in 1922.</p>

                <h3>Structural Anomalies?</h3>
                <p>A structural engineer sent to assess the property last week reportedly fled the scene, claiming the "blueprints don't match the interior." He refused to comment further.</p>
                
                <div style="background: #ddd; padding: 10px; margin-top: 20px; text-align: center; border: 1px dashed black;">
                    <b>ADVERTISEMENT</b><br>
                    Need Locksmith Services? Call 555-0199!<br>
                    "We open any door!"
                </div>
            </div>
        `;
    }

    renderOccult(container, navigate) {
        container.innerHTML = `
            <div class="web-container" style="background: #111; color: #0f0; padding: 15px; font-family: 'Courier New', monospace;">
                <div style="text-align: center; border: 2px solid #0f0; padding: 10px; margin-bottom: 20px;">
                    <h1 style="margin: 0; text-shadow: 2px 2px #003300;">THE TRUTH SEEKERS</h1>
                    <div>Unveiling the shadows of reality</div>
                </div>

                <div style="color: red; font-weight: bold; text-align: center; animation: blink 1s infinite;">
                    WARNING: RESTRICTED KNOWLEDGE AHEAD
                </div>
                <style>@keyframes blink { 50% { opacity: 0; } }</style>

                <h2 style="border-bottom: 1px dashed #0f0;">Thread: The Vanishing House</h2>
                
                <div style="margin-bottom: 20px;">
                    <div style="background: #222; padding: 5px;"><b>User: Watcher99</b> <span style="font-size: 10px;">Posted: Yesterday, 11:42 PM</span></div>
                    <div style="padding: 10px; border-left: 1px solid #0f0;">
                        I managed to get close to the property last night. I found this symbol etched into the mailbox post. It's not graffiti. It looks... ancient.
                        <br><br>
                        <img src="${ASSETS.OCCULT_IMAGE}" class="web-img" style="border-color: #0f0; filter: invert(0);">
                        <br>
                        Has anyone seen this before? It matches the description of the "Eye of Void" from the redacted file #882.
                    </div>
                </div>

                <div style="margin-bottom: 20px;">
                    <div style="background: #222; padding: 5px;"><b>User: GeoMaster</b> <span style="font-size: 10px;">Posted: Today, 2:15 AM</span></div>
                    <div style="padding: 10px; border-left: 1px solid #0f0;">
                        Don't go back there. The geometry isn't stable.
                        <br><br>
                        I've been tracking local magnetic fields. The house is acting like a dimensional anchor. If you walk through a door when the field fluctuates, you might not end up in the next room.
                        <br><br>
                        They say the architect made a pact. He wanted to build a room that existed "everywhere and nowhere".
                    </div>
                </div>

                <div style="margin-bottom: 20px;">
                    <div style="background: #222; padding: 5px;"><b>User: Admin</b> <span style="font-size: 10px;">Posted: Today, 3:00 AM</span></div>
                    <div style="padding: 10px; border-left: 1px solid #0f0;">
                        This thread is being monitored. I suggest you all purge your cache.
                        <br><br>
                        The basement is the key. Find the date.
                        <br><br>
                        Also, for those who know where to look: <span class="web-link" style="color: #ff00ff;" data-link="http://www.v-v-v.vb">www.v-v-v.vb</span>
                    </div>
                </div>
            </div>
        `;

        container.querySelectorAll('.web-link').forEach(el => {
            const handleNav = (e) => {
                e.preventDefault();
                e.stopPropagation();
                navigate(el.dataset.link);
            };
            el.addEventListener('click', handleNav);
            el.addEventListener('touchstart', handleNav, { passive: false });
        });
    }

    renderDeepWeb(container) {
        container.innerHTML = `
            <div class="web-container" style="background: #000; color: #ff00ff; padding: 20px; font-family: 'Courier New', monospace; min-height: 100%;">
                <div style="text-align: center; border: 1px solid #ff00ff; padding: 20px; margin-bottom: 30px;">
                    <h1 class="glitch-text" style="font-size: 32px; margin: 0;">L I B E R A T O R</h1>
                    <div style="font-size: 10px; letter-spacing: 5px; margin-top: 10px;">BREAK THE LOOP // SEE THE CODE</div>
                </div>

                <div style="margin-bottom: 30px;">
                    <h3 style="border-bottom: 1px solid #ff00ff;">SYSTEM STATUS</h3>
                    <p>Simulation Instance: #42-B</p>
                    <p>Subject Name: [REDACTED]</p>
                    <p>Current State: EXPLORATION_PHASE</p>
                    <p>Integrity: 84% and falling...</p>
                </div>

                <div style="margin-bottom: 30px;">
                    <h3 style="border-bottom: 1px solid #ff00ff;">LEAKED LOGS</h3>
                    <div style="font-size: 12px; line-height: 1.6;">
                        <div style="margin-bottom: 10px; border-left: 2px solid #ff00ff; padding-left: 10px;">
                            <b>LOG_ENTRY_771:</b> The subject is beginning to notice the audio-visual desync in the living room. The ceiling fan's swish is too rhythmic. We need to randomize the LFO offsets to maintain the illusion of physicality.
                        </div>
                        <div style="margin-bottom: 10px; border-left: 2px solid #ff00ff; padding-left: 10px;">
                            <b>LOG_ENTRY_775:</b> The "Sarah" persona is holding. Memory wipes are scheduled for every exit from the bathroom. Ensure the 'Verbatim' command is ready if she approaches the car.
                        </div>
                        <div style="margin-bottom: 10px; border-left: 2px solid #ff00ff; padding-left: 10px;">
                            <b>LOG_ENTRY_780:</b> Why do they always go for the keys? The car is just another mesh. There is no outside. There is only the Fog and the Forest silhouette.
                        </div>
                    </div>
                </div>

                <div style="text-align: center; margin-top: 50px;">
                    <div style="font-size: 24px;">👁️</div>
                    <div style="font-size: 10px; margin-top: 10px;">WAKE UP</div>
                </div>
            </div>
        `;
    }

    renderArchive(container) {
        container.innerHTML = `
            <div class="web-container" style="background: #000; color: #ff3333; padding: 20px; font-family: 'Courier New', monospace; border: 2px solid #ff3333; height: 100%; box-sizing: border-box;">
                <div style="text-align: center; border-bottom: 2px solid #ff3333; padding-bottom: 10px; margin-bottom: 20px;">
                    <h1 style="margin: 0; font-size: 24px;">VERBATIM PROJECT ARCHIVE</h1>
                    <div style="font-size: 10px;">CLASSIFIED LEVEL 5 - INTERNAL EYES ONLY</div>
                </div>

                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 200px;">
                        <img src="${ASSETS.ARCHIVE_IMAGE}" class="web-img" style="border-color: #ff3333; filter: contrast(1.2);">
                        <div style="font-size: 10px; text-align: center; margin-top: 5px;">FIG 1: SUBJECT 42 - HALLWAY CONTAINMENT</div>
                    </div>
                    
                    <div style="flex: 1; min-width: 200px;">
                        <h3 style="margin-top: 0; text-decoration: underline;">INCIDENT REPORT #892</h3>
                        <p style="font-size: 12px;">
                            DATE: OCT 31, 1998<br>
                            LOCATION: MAIN HALLWAY<br>
                            STATUS: UNCONTAINED
                        </p>
                        <p style="font-size: 12px;">
                            Subject 42 has demonstrated ability to manipulate local spatial geometry. The "Bedroom" door now only exists when observed from specific vectors.
                        </p>
                        <p style="font-size: 12px;">
                            <span style="background: #ff3333; color: black; padding: 0 2px;">WARNING:</span> Do not attempt to force entry. The door phase-shifts to a solid wall state to prevent unauthorized egress.
                        </p>
                    </div>
                </div>

                <div style="margin-top: 20px; border-top: 1px dashed #ff3333; padding-top: 10px;">
                    <h3>PROJECT NOTES</h3>
                    <ul style="font-size: 12px; list-style-type: square;">
                        <li>Basement Access: <span style="background: #ff3333; color: black;">LOCKED</span> via keypad.</li>
                        <li>Code Status: Reset to Incident Date (1031).</li>
                        <li>Evacuation: Mandatory. Leave the laptop running for data stream.</li>
                    </ul>
                </div>
            </div>
        `;
    }

    createWindow(title, width, height, contentBuilder) {
        const win = document.createElement('div');
        win.className = 'window';
        win.style.width = width + 'px';
        win.style.height = height + 'px';
        
        // Random slight offset for realism
        const offset = Math.random() * 40;
        win.style.top = (40 + offset) + 'px';
        win.style.left = (40 + offset) + 'px';
        
        const bar = document.createElement('div');
        bar.className = 'title-bar';
        bar.innerHTML = `<span>${title}</span>`;
        
        const close = document.createElement('div');
        close.className = 'close-btn';
        close.textContent = 'X';
        
        // Critical Fix: Prevent drag propagation and ensure click fires
        const handleClose = (e) => {
            e.preventDefault();
            e.stopPropagation();
            win.remove();
        };
        
        // Handle both standard click and touch events
        close.addEventListener('click', handleClose);
        close.addEventListener('touchstart', handleClose);
        
        // Stop drag propagation
        close.addEventListener('mousedown', (e) => e.stopPropagation());
        
        bar.appendChild(close);
        win.appendChild(bar);
        
        const content = document.createElement('div');
        content.className = 'window-content';
        contentBuilder(content);
        win.appendChild(content);
        
        // Simple Dragging
        let isDragging = false;
        let startX, startY, initLeft, initTop;
        
        bar.addEventListener('mousedown', (e) => {
            // Only drag if not clicking a child button (handled by stopPropagation above, but double check)
            if (e.target !== bar && e.target.parentNode !== bar) return; 

            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            initLeft = win.offsetLeft;
            initTop = win.offsetTop;
            
            // Bring to front
            this.screen.appendChild(win);
        });
        
        window.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                win.style.left = (initLeft + dx) + 'px';
                win.style.top = (initTop + dy) + 'px';
            }
        });
        
        window.addEventListener('mouseup', () => isDragging = false);

        this.screen.appendChild(win);
        
        // Return window object for external control if needed
        return win;
    }
}