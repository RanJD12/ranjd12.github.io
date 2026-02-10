import * as THREE from 'three';
import * as Tone from 'tone';
import { PlayerController, FirstPersonCameraController } from './rosie/controls/rosieControls.js';
import { CONFIG, ASSETS } from './config.js';
import { World } from './World.js';
import { LaptopUI } from './LaptopUI.js';
import { NoteUI } from './NoteUI.js'; 
import { NewspaperUI } from './NewspaperUI.js';
import { Water } from 'three/addons/objects/Water.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

class Game {
    constructor() {
        window.game = this; // Global reference for debugging and World logging
        this.container = document.body;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);
        this.scene.fog = new THREE.FogExp2(0x000000, 0.07);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.scene.add(this.camera); 
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        this.inventory = new Set();
        this.interactiveTarget = null;
        this.raycaster = new THREE.Raycaster();
        this.clock = new THREE.Clock();
        
        this.isStarted = false;
        this.isGameOver = false;
        this.hasExitedBathroom = false;

        // Detect Mobile (User Agent or Touch Points)
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);

        this.setupPlayer();
        this.setupWorld();
        this.setupUI();
        this.setupEventListeners();
        
        this.setupLaptop(); 
        this.setupNoteUI(); // Setup Note UI
        this.setupNewspaperUI(); // Setup Newspaper UI

        this.setupMenuScene(); // Initialize Menu 3D Scene

        this.setUIMode('menu');
        this.playIntro(); // Play Slob Life Games intro

        this.animate();
        this.log("Game Engine initialized");
    }

    setUIMode(mode) {
        this.log(`Setting UI Mode: ${mode}`);
        
        // Hide everything first
        if (this.uiContainer) this.uiContainer.style.display = 'none';
        if (this.overlayEl) {
            this.overlayEl.style.display = 'none';
            this.overlayEl.style.opacity = '0';
        }
        if (this.loadingScreen) {
            this.loadingScreen.style.display = 'none';
            this.loadingScreen.style.opacity = '0';
        }
        if (this.gameOverEl) {
            this.gameOverEl.style.display = 'none';
            this.gameOverEl.style.opacity = '0';
        }
        if (this.settingsPanel) this.settingsPanel.style.display = 'none';

        // Reset initialization flag if returning to menu
        if (mode === 'menu') {
            this.isInitializing = false;
        }

        switch(mode) {
            case 'menu':
                if (this.overlayEl) {
                    this.overlayEl.style.display = 'flex';
                    // Check for save to show/hide load button
                    if (this.loadButton) {
                        this.loadButton.style.display = localStorage.getItem('verbatim_save') ? 'block' : 'none';
                    }
                    setTimeout(() => {
                        if (this.overlayEl) this.overlayEl.style.opacity = '1';
                    }, 50);
                }
                break;
            case 'game':
                if (this.uiContainer) this.uiContainer.style.display = 'flex';
                break;
            case 'loading':
                if (this.loadingScreen) {
                    this.loadingScreen.style.display = 'flex';
                    this.loadingScreen.style.opacity = '1';
                }
                break;
            case 'gameover':
                if (this.gameOverEl) {
                    this.gameOverEl.style.display = 'flex';
                    this.gameOverEl.style.opacity = '1';
                }
                break;
        }
    }

    playIntro() {
        const introContainer = document.getElementById('intro-logo');
        const introImg = document.getElementById('intro-logo-img');
        
        if (!introContainer || !introImg) return;

        // Step 1: Fade image in
        setTimeout(() => {
            introImg.style.opacity = '1';
        }, 500);

        // Step 2: Fade image out
        setTimeout(() => {
            introImg.style.opacity = '0';
        }, 3500);

        // Step 3: Fade container out
        setTimeout(() => {
            introContainer.style.opacity = '0';
            setTimeout(() => {
                introContainer.style.display = 'none';
            }, 2000);
        }, 5000);
    }

    setupLaptop() {
        this.laptopUI = new LaptopUI(() => {
            this.resumeGame();
        });
    }

    setupNoteUI() {
        this.noteUI = new NoteUI(() => {
            this.resumeGame();
        });
    }

    setupNewspaperUI() {
        this.newspaperUI = new NewspaperUI(() => {
            this.resumeGame();
        });
    }

    resumeGame() {
        if (this.isStarted && !this.isGameOver) {
            if (!this.isMobile) {
                this.renderer.domElement.requestPointerLock();
            }
            this.controller.enabled = true; 
        }
    }

    // --- Menu Scene Setup ---
    setupMenuScene() {
        this.menuScene = new THREE.Scene();
        this.menuScene.background = new THREE.Color(0x000000);
        this.menuScene.fog = new THREE.FogExp2(0x000000, 0.05);

        this.menuCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.menuCamera.position.set(0, 0, 7); // Back for width

        // 1. Text: "VERBATIM"
        const loader = new FontLoader();
        // Use a more reliable font URL or handle error
        const fontUrl = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/fonts/helvetiker_regular.typeface.json';
        loader.load(fontUrl, (font) => {
            const geometry = new TextGeometry('VERBATIM', {
                font: font,
                size: 0.8,
                height: 0.1,
                curveSegments: 12,
                bevelEnabled: true,
                bevelThickness: 0.03,
                bevelSize: 0.02,
                bevelOffset: 0,
                bevelSegments: 5
            });
            geometry.center();
            
            // Emissive material for spooky glow
            const material = new THREE.MeshStandardMaterial({ 
                color: 0xffffff, 
                emissive: 0xaaaaaa,
                emissiveIntensity: 0.5,
                roughness: 0.4 
            });
            
            this.titleMesh = new THREE.Mesh(geometry, material);
            this.titleMesh.position.y = 1.0; // Keep text height
            this.menuScene.add(this.titleMesh);

            // Add point light near text to make it pop
            const textLight = new THREE.PointLight(0xffffff, 1, 10);
            textLight.position.set(0, 2, 2);
            this.menuScene.add(textLight);
        }, undefined, (err) => {
            console.warn("Failed to load font for menu title", err);
        });

        // 2. Puddle (Water)
        // Generate a normal map for ripples
        const normalMap = this.createWaterNormalMap();
        normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;

        const waterGeometry = new THREE.PlaneGeometry(30, 30); // Even wider to catch edges
        this.water = new Water(waterGeometry, {
            textureWidth: 512,
            textureHeight: 512,
            waterNormals: normalMap,
            sunDirection: new THREE.Vector3(),
            sunColor: 0xffffff,
            waterColor: 0x000000, // Dark water
            distortionScale: 3.7,
            fog: this.menuScene.fog !== undefined
        });

        this.water.rotation.x = -Math.PI / 2;
        this.water.position.y = -1.0; // Moved UP significantly (was -2.0) to bring reflection into view
        this.menuScene.add(this.water);

        // Lighting for menu
        const ambient = new THREE.AmbientLight(0x222222);
        this.menuScene.add(ambient);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
        dirLight.position.set(-1, 3, 2);
        this.menuScene.add(dirLight);
    }

    createWaterNormalMap() {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // Fill with neutral blue (normal map flat)
        ctx.fillStyle = '#8080ff'; 
        ctx.fillRect(0, 0, size, size);

        // Add some noise (simplistic)
        // For better results, we'd use perlin noise, but random works for "choppy" water
        // Or we can draw random circles for ripples
        for (let i = 0; i < 100; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const r = Math.random() * 20 + 5;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${Math.random()*255}, ${Math.random()*255}, 255, 0.1)`;
            ctx.fill();
        }

        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    setupPlayer() {
        this.player = new THREE.Object3D();
        this.player.position.set(0, 1, 0); // Start in middle of bathroom
        this.scene.add(this.player);

        this.controller = new PlayerController(this.player, {
            moveSpeed: CONFIG.PLAYER.SPEED,
            jumpForce: CONFIG.PLAYER.JUMP_FORCE,
            gravity: CONFIG.PLAYER.GRAVITY,
            groundLevel: 0.1
        });
        this.controller.setCameraMode('first-person');

        this.fpsCamera = new FirstPersonCameraController(this.camera, this.player, this.renderer.domElement, {
            eyeHeight: CONFIG.PLAYER.HEIGHT
        });
        
        this.setupHand();
        
        // Raycaster for ground detection (Slopes/Stairs support)
        this.groundRaycaster = new THREE.Raycaster();
        this.groundRaycaster.ray.direction.set(0, -1, 0);
        this.missedGroundFrames = 0; // Track consecutive misses

        // Optimization: Reusable vectors/boxes to prevent GC in game loop
        this.tempVector = new THREE.Vector3();
        this.tempBox = new THREE.Box3();
        this.tempPlayerBox = new THREE.Box3();
        this.playerSize = new THREE.Vector3(0.6, 2, 0.6); // Cache player size
        this.tempColliderBox = new THREE.Box3(); // Extra temp for safety
        this.mirrorLookTime = 0;
    }

    setupHand() {
        this.hand = new THREE.Group();
        this.hand.position.set(0.2, -0.3, -0.5); // Relative to camera
        this.camera.add(this.hand);
        
        // Slot for Held Items (Flashlight is now just a light source)
        this.itemSlot = new THREE.Group();
        this.hand.add(this.itemSlot);
        
        this.equippedId = null;
        this.heldMeshes = {};
        this.initHeldItems();
        this.initFlashlight();
        
        this.highlightedObject = null;
        this.highlightStore = new Map(); // Stores original material states
    }

    setupWorld() {
        this.world = new World(this.scene);
        // Removed initial build() call to prevent potential race conditions or hanging before menu.
        // The world will be built properly when Start or Load is clicked.
    }

    setupUI() {
        this.uiContainer = document.getElementById('ui-container');
        this.promptEl = document.getElementById('prompt');
        this.inventoryEl = document.getElementById('inventory-list');
        this.equippedSlotEl = document.getElementById('equipped-slot');
        this.overlayEl = document.getElementById('overlay');
        this.startButton = document.getElementById('start-button');
        this.loadButton = document.getElementById('load-button');
        this.saveButton = document.getElementById('save-button');
        this.gameOverEl = document.getElementById('game-over');
        this.mobileInteractBtn = document.getElementById('mobile-interact');
        this.flashlightBtn = document.getElementById('flashlight-btn');
        this.batteryContainer = document.getElementById('battery-container');
        this.batteryLevelEl = document.getElementById('battery-level');
        this.subtitlesEl = document.getElementById('subtitles');
        this.returnToMenuBtn = document.getElementById('return-to-menu');

        // Loading UI
        this.loadingScreen = document.getElementById('loading-screen');
        this.loadingBar = document.getElementById('loading-bar');
        this.loadingStatus = document.getElementById('loading-status');

        this.log = (msg) => {
            console.log(msg);
        };

        // Settings UI
        this.settingsPanel = document.getElementById('settings-panel');
        this.settingsSlider = document.getElementById('sensitivity-slider');
        this.settingsValue = document.getElementById('sensitivity-value');
        this.fovSlider = document.getElementById('fov-slider');
        this.fovValue = document.getElementById('fov-value');
        this.closeSettingsBtn = document.getElementById('close-settings');
        this.settingsBtn = document.getElementById('settings-button');
        this.menuSettingsBtn = document.getElementById('menu-settings-button');
        this.invertYBtn = document.getElementById('invert-y-btn');
        this.crosshairBtn = document.getElementById('crosshair-btn');
        this.crosshairEl = document.getElementById('crosshair');
        this.restoreDefaultsBtn = document.getElementById('restore-defaults');
        this.reportBtn = document.getElementById('report-button');

        this.flashlightBattery = 100;
        this.batteryDrainRate = 1.0; // % per second
        this.batteryRechargeRate = 4.0; // 4x faster recharge than drain
        if (this.isMobile) {
            this.mobileInteractBtn.style.display = 'flex';
        }

        // Settings Buttons are part of setUIMode now
        
        // Load Global Settings
        this.applySettings({
            sensitivity: localStorage.getItem('verbatim_sensitivity') || 1.0,
            fov: localStorage.getItem('verbatim_fov') || 75,
            invertY: localStorage.getItem('verbatim_invert_y') === 'true',
            crosshair: localStorage.getItem('verbatim_crosshair') === 'true'
        });
    }

    applySettings(settings) {
        if (!this.fpsCamera) return; // Guard against early calls
        
        if (settings.sensitivity) {
            const val = parseFloat(settings.sensitivity);
            this.fpsCamera.setSensitivity(val * 0.002);
            if (this.settingsSlider) this.settingsSlider.value = val;
            if (this.settingsValue) this.settingsValue.textContent = val.toFixed(1);
            localStorage.setItem('verbatim_sensitivity', val);
        }
        if (settings.fov) {
            const val = parseInt(settings.fov);
            this.camera.fov = val;
            this.camera.updateProjectionMatrix();
            if (this.fovSlider) this.fovSlider.value = val;
            if (this.fovValue) this.fovValue.textContent = val;
            localStorage.setItem('verbatim_fov', val);
        }
        if (settings.invertY !== undefined) {
            const val = settings.invertY === true || settings.invertY === 'true';
            this.fpsCamera.setInvertY(val);
            localStorage.setItem('verbatim_invert_y', val);
            if (this.invertYBtn) {
                this.invertYBtn.textContent = val ? 'ON' : 'OFF';
                this.invertYBtn.style.background = val ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 255, 255, 0.1)';
                this.invertYBtn.style.borderColor = val ? '#ffd700' : 'rgba(255, 255, 255, 0.3)';
            }
        }
        if (settings.crosshair !== undefined) {
            const val = settings.crosshair === true || settings.crosshair === 'true';
            if (this.crosshairEl) this.crosshairEl.style.display = val ? 'block' : 'none';
            localStorage.setItem('verbatim_crosshair', val);
            if (this.crosshairBtn) {
                this.crosshairBtn.textContent = val ? 'ON' : 'OFF';
                this.crosshairBtn.style.background = val ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 255, 255, 0.1)';
                this.crosshairBtn.style.borderColor = val ? '#ffd700' : 'rgba(255, 255, 255, 0.3)';
            }
        }
    }

    setupEventListeners() {
        window.addEventListener('resize', () => {
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            if (this.menuCamera) {
                this.menuCamera.aspect = window.innerWidth / window.innerHeight;
                this.menuCamera.updateProjectionMatrix();
            }
        });

        // Helper to add robust click/touch listeners for menu buttons
        const addMenuButtonListener = (btn, handler) => {
            const wrappedHandler = async (e) => {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                if (this.isInitializing) return;
                this.log(`Menu button triggered: ${btn.id}`);
                await handler(e);
            };
            btn.addEventListener('click', wrappedHandler);
            btn.addEventListener('touchstart', wrappedHandler, { passive: false });
        };

        // Start/New Game Button
        addMenuButtonListener(this.startButton, async () => {
            this.isInitializing = true;
            this.log("Starting New Game sequence...");
            
            // Show loading screen immediately to cover the transition
            this.setUIMode('loading');
            if (this.loadingStatus) {
                this.loadingStatus.textContent = "INITIALIZING...";
            }

            try {
                this.log("Starting Tone.js...");
                // Wrap Tone.start in a timeout to prevent it from hanging the entire sequence
                const toneStartPromise = Tone.start();
                const timeoutPromise = new Promise(r => setTimeout(() => r('timeout'), 2000));
                const result = await Promise.race([toneStartPromise, timeoutPromise]);
                
                if (result === 'timeout') {
                    this.log("Tone.js start timed out, proceeding anyway");
                } else {
                    this.log("Tone.js context active");
                }
                
                if (this.loadingStatus) this.loadingStatus.textContent = "BUILDING WORLD...";
                await this.resetGame(); 
                
                this.log("Finalizing start...");
                await this.start();
            } catch (err) {
                this.log(`ERROR in New Game: ${err.message}`);
                console.error(err);
                if (this.loadingStatus) this.loadingStatus.textContent = "ERROR: " + err.message;
                this.isInitializing = false;
                setTimeout(() => {
                    this.setUIMode('menu');
                }, 3000);
            } finally {
                this.isInitializing = false;
            }
        });

        // Load Button
        addMenuButtonListener(this.loadButton, async () => {
            this.isInitializing = true;
            this.log("Starting Load Game sequence...");
            
            this.setUIMode('loading');
            if (this.loadingStatus) {
                this.loadingStatus.textContent = "INITIALIZING...";
            }

            try {
                this.log("Starting Tone.js...");
                await Promise.race([Tone.start(), new Promise(r => setTimeout(r, 2000))]);
                
                if (this.loadingStatus) this.loadingStatus.textContent = "RESTORING SAVE...";
                await this.loadGame();
            } catch (err) {
                this.log(`ERROR in Load Game: ${err.message}`);
                console.error(err);
                if (this.loadingStatus) this.loadingStatus.textContent = "ERROR: " + err.message;
                this.isInitializing = false;
                setTimeout(() => {
                    this.setUIMode('menu');
                }, 3000);
            } finally {
                this.isInitializing = false;
            }
        });

        // Menu Settings Button
        addMenuButtonListener(this.menuSettingsBtn, () => {
            const isVisible = this.settingsPanel.style.display === 'flex';
            this.settingsPanel.style.display = isVisible ? 'none' : 'flex';
            
            // Hide menu options when settings are open
            if (this.overlayEl) {
                this.overlayEl.style.visibility = isVisible ? 'visible' : 'hidden';
            }

            if (!isVisible) {
                if (document.pointerLockElement) document.exitPointerLock();
                const currentSens = this.fpsCamera.mouseSensitivity / 0.002;
                this.settingsSlider.value = currentSens.toFixed(1);
                this.settingsValue.textContent = currentSens.toFixed(1);
            }
        });

        // Save Button
        addMenuButtonListener(this.saveButton, () => {
            this.saveGame();
            this.isStarted = false;
            this.stopAudio();
            if (document.pointerLockElement) document.exitPointerLock();
            if (this.controller) this.controller.hideControls();
            this.setUIMode('menu');
        });

        // Settings Buttons
        addMenuButtonListener(this.settingsBtn, () => {
            const isVisible = this.settingsPanel.style.display === 'flex';
            this.settingsPanel.style.display = isVisible ? 'none' : 'flex';
            
            // Hide game UI when settings are open
            if (this.uiContainer) {
                this.uiContainer.style.visibility = isVisible ? 'visible' : 'hidden';
                // Keep settings button visible if in game so it can be closed
                this.settingsBtn.style.visibility = 'visible';
                this.saveButton.style.visibility = 'visible';
            }

            if (!isVisible) {
                if (document.pointerLockElement) document.exitPointerLock();
                const currentSens = this.fpsCamera.mouseSensitivity / 0.002;
                this.settingsSlider.value = currentSens.toFixed(1);
                this.settingsValue.textContent = currentSens.toFixed(1);
            }
        });

        addMenuButtonListener(this.closeSettingsBtn, () => {
            this.settingsPanel.style.display = 'none';
            if (this.overlayEl) this.overlayEl.style.visibility = 'visible';
            if (this.uiContainer) this.uiContainer.style.visibility = 'visible';
        });

        this.settingsSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.settingsValue.textContent = val.toFixed(1);
            // Base sensitivity is 0.002
            this.fpsCamera.setSensitivity(val * 0.002);
            localStorage.setItem('verbatim_sensitivity', val);
        });

        this.fovSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            this.fovValue.textContent = val;
            this.camera.fov = val;
            this.camera.updateProjectionMatrix();
            localStorage.setItem('verbatim_fov', val);
        });

        const updateToggleButton = (btn, state, storageKey, onToggle) => {
            const refreshUI = (isActive) => {
                btn.textContent = isActive ? 'ON' : 'OFF';
                btn.style.background = isActive ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 255, 255, 0.1)';
                btn.style.borderColor = isActive ? '#ffd700' : 'rgba(255, 255, 255, 0.3)';
            };

            const toggle = (e) => {
                const currentState = localStorage.getItem(storageKey) === 'true';
                const newState = !currentState;
                localStorage.setItem(storageKey, newState);
                refreshUI(newState);
                if (onToggle) onToggle(newState);
            };

            addMenuButtonListener(btn, toggle);
            
            // Initial UI sync
            refreshUI(localStorage.getItem(storageKey) === 'true');
        };

        updateToggleButton(this.invertYBtn, false, 'verbatim_invert_y', (state) => {
            this.fpsCamera.setInvertY(state);
        });

        updateToggleButton(this.crosshairBtn, false, 'verbatim_crosshair', (state) => {
            this.crosshairEl.style.display = state ? 'block' : 'none';
        });

        // Restore Defaults
        addMenuButtonListener(this.restoreDefaultsBtn, () => {
            this.applySettings({
                sensitivity: 1.0,
                fov: 75,
                invertY: false,
                crosshair: false
            });
        });

        // Report Button
        addMenuButtonListener(this.reportBtn, () => {
            window.open('https://docs.google.com/forms/d/e/1FAIpQLSfKoqgRA724jA9SkNIhQuiuioieSsxOGvnKwFc8Nwd_pvQphw/viewform?usp=header', '_blank');
        });

        // Return to Menu Button
        if (this.returnToMenuBtn) {
            addMenuButtonListener(this.returnToMenuBtn, () => {
                this.isStarted = false;
                this.isGameOver = false;
                this.stopAudio();
                
                if (this.controller) this.controller.hideControls();
                if (this.fpsCamera) this.fpsCamera.disable();
                
                this.setUIMode('menu');
            });
        }

        // Combined interaction handler for desktop and mobile
        const triggerInteraction = (e) => {
            if (this.isStarted && !this.isGameOver) {
                // Check if touch/click is on mobile UI
                if (e.target.id === 'mobile-interact' || e.target.closest('#mobile-game-controls') || e.target.id === 'save-button') {
                    return;
                }
                this.handleInteraction();
            }
        };

        this.renderer.domElement.addEventListener('mousedown', (e) => {
            if (e.button === 0) triggerInteraction(e);
        });

        this.mobileInteractBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.handleInteraction();
        }, { passive: false });

        // Use 'E' for interaction as well
        document.addEventListener('keydown', (e) => {
            if (this.isStarted && !this.isGameOver) {
                if (e.code === 'KeyE') {
                    this.handleInteraction();
                }
                if (e.code === 'KeyF') {
                    this.toggleFlashlight();
                }
            }
        });

        // Flashlight Button
        addMenuButtonListener(this.flashlightBtn, () => {
            this.toggleFlashlight();
        });
    }

    async start(isLoad = false) {
        // Shader Warm-up: Ensure all lights/meshes are processed by the renderer
        if (this.playerFlashlight) {
            this.playerFlashlight.visible = true;
            this.playerFlashlight.intensity = 0.001; 
        }
        if (this.heldMeshes['lighter']) {
            this.heldMeshes['lighter'].visible = true;
            this.heldMeshes['lighter'].traverse(c => { if (c.isLight) c.intensity = 0.001; });
        }
        this.renderer.render(this.scene, this.camera);
        
        // Reset to off
        if (this.playerFlashlight) {
            this.playerFlashlight.visible = false;
            this.playerFlashlight.intensity = 0;
        }
        if (this.heldMeshes['lighter']) {
            this.heldMeshes['lighter'].visible = false;
            this.heldMeshes['lighter'].traverse(c => { if (c.isLight) c.intensity = 0.3; }); // Reset to original
        }

        this.setUIMode('none'); // Hide all while fading in
        this.isStarted = true;

        // Delay gameplay availability until loading screen is fading
        setTimeout(async () => {
            this.setUIMode('game');
            
            this.fpsCamera.enable();
            this.controller.showControls();
            
            // Character Speech at start - only for New Game
            if (!isLoad) {
                setTimeout(() => {
                    this.speak("How long have I been in here?");
                }, 500);
            }

            // Only request pointer lock on desktop
            if (!this.isMobile) {
                this.renderer.domElement.requestPointerLock();
            }
        }, 500);
    }

    setupFootsteps() {
        // Higher gain for better visibility - Increased for more presence
        this.footstepGain = new Tone.Gain(3.5).toDestination();
        
        // Use a simple procedural synth for footsteps - more reliable on mobile
        this.footstepSynth = new Tone.MembraneSynth({
            pitchDecay: 0.05,
            octaves: 2,
            oscillator: { type: "sine" },
            envelope: {
                attack: 0.001,
                decay: 0.1,
                sustain: 0,
                release: 0.1
            }
        }).connect(this.footstepGain);

        this.footstepFilter = new Tone.Filter(1000, "bandpass").connect(this.footstepGain);
        
        this.footstepNoise = new Tone.NoiseSynth({
            noise: { type: "pink" },
            envelope: {
                attack: 0.001,
                decay: 0.05,
                sustain: 0,
                release: 0.05
            }
        }).connect(this.footstepFilter);
        
        console.log("Footstep audio ready");
        this.stepCycle = 0;
        this.nextStepTrigger = Math.PI * 1.5;
    }

    playFootstep() {
        if (!this.footstepSynth || !this.footstepNoise) return;
        
        const now = Tone.now();
        // Variation in pitch and volume
        const freq = 60 + Math.random() * 20;
        const vol = -8 + Math.random() * 4;
        
        this.footstepSynth.volume.value = vol;
        this.footstepNoise.volume.value = vol - 5;
        
        this.footstepSynth.triggerAttackRelease(freq, "32n", now);
        this.footstepNoise.triggerAttackRelease("32n", now);
    }

    stopAudio() {
        // Ambient
        if (this.humLow) { this.humLow.stop(); this.humLow.dispose(); this.humLow = null; }
        if (this.humHigh) { this.humHigh.stop(); this.humHigh.dispose(); this.humHigh = null; }
        if (this.gasNoise) { this.gasNoise.stop(); this.gasNoise.dispose(); this.gasNoise = null; }
        if (this.lightVolume) { this.lightVolume.dispose(); this.lightVolume = null; }
        
        if (this.fridgeOsc) { this.fridgeOsc.stop(); this.fridgeOsc.dispose(); this.fridgeOsc = null; }
        if (this.fridgeBuzz) { this.fridgeBuzz.stop(); this.fridgeBuzz.dispose(); this.fridgeBuzz = null; }
        if (this.fridgeVolume) { this.fridgeVolume.dispose(); this.fridgeVolume = null; }

        if (this.fanNoise) { this.fanNoise.stop(); this.fanNoise.dispose(); this.fanNoise = null; }
        if (this.fanFilter) { this.fanFilter.dispose(); this.fanFilter = null; }
        if (this.fanLFO) { this.fanLFO.stop(); this.fanLFO.dispose(); this.fanLFO = null; }
        if (this.fanGain) { this.fanGain.dispose(); this.fanGain = null; }
        if (this.fanVolumeLFO) { this.fanVolumeLFO.stop(); this.fanVolumeLFO.dispose(); this.fanVolumeLFO = null; }
        if (this.fanVolume) { this.fanVolume.dispose(); this.fanVolume = null; }

        if (this.outdoorNoise) { this.outdoorNoise.stop(); this.outdoorNoise.dispose(); this.outdoorNoise = null; }
        if (this.outdoorFilter) { this.outdoorFilter.dispose(); this.outdoorFilter = null; }
        if (this.outdoorVolume) { this.outdoorVolume.dispose(); this.outdoorVolume = null; }
        
        // Footsteps
        if (this.footstepSynth) { this.footstepSynth.dispose(); this.footstepSynth = null; }
        if (this.footstepNoise) { this.footstepNoise.dispose(); this.footstepNoise = null; }
        if (this.footstepFilter) { this.footstepFilter.dispose(); this.footstepFilter = null; }
        if (this.footstepGain) { this.footstepGain.dispose(); this.footstepGain = null; }
    }

    setupAmbientAudio() {
        // Master volume for the light (spatialized manually in update loop)
        this.lightVolume = new Tone.Volume(-Infinity).toDestination();
        this.fridgeVolume = new Tone.Volume(-Infinity).toDestination();
        this.fanVolume = new Tone.Volume(-Infinity).toDestination();
        this.outdoorVolume = new Tone.Volume(-Infinity).toDestination();

        // Outdoor Ambience (Wind/Forest rustle - Brown noise filtered)
        this.outdoorNoise = new Tone.Noise("brown").start();
        this.outdoorFilter = new Tone.Filter(250, "lowpass").connect(this.outdoorVolume);
        this.outdoorNoise.connect(this.outdoorFilter);

        // Fridge Hum (Lower frequency rumble + electric buzz)
        this.fridgeOsc = new Tone.Oscillator({
            frequency: 50,
            type: "sine",
            volume: -20
        }).start();
        this.fridgeBuzz = new Tone.Oscillator({
            frequency: 100,
            type: "sawtooth",
            volume: -35
        }).start();

        this.fridgeOsc.connect(this.fridgeVolume);
        this.fridgeBuzz.connect(this.fridgeVolume);

        // Fan "Swish" (Brown noise for lower, heavier air sound)
        this.fanNoise = new Tone.Noise("brown").start();
        this.fanFilter = new Tone.Filter({
            frequency: 250, // Much lower pitch for a "whoosh" (was 500)
            type: "lowpass",
            Q: 2 
        });
        
        // Match frequency to 4 blades at 2.5 rad/s rotation
        // (2.5 rad/s / 2π) * 4 blades = 1.59 swishes/sec
        const fanFreq = 1.59; 
        this.fanLFO = new Tone.LFO(fanFreq, 150, 450).start(); 
        this.fanLFO.connect(this.fanFilter.frequency);
        
        this.fanGain = new Tone.Gain(0.4);
        this.fanVolumeLFO = new Tone.LFO(fanFreq, 0.3, 0.8).start(); // Subtler volume pulses
        this.fanVolumeLFO.connect(this.fanGain.gain);
        
        this.fanNoise.connect(this.fanFilter);
        this.fanFilter.connect(this.fanGain);
        this.fanGain.connect(this.fanVolume);

        // 1. Mains Hum (60Hz Sawtooth) - The core electrical sound
        this.humLow = new Tone.Oscillator({
            frequency: 60,
            type: "sawtooth",
            volume: -25 // Lowered from -10
        }).start();

        // 2. Rectified Buzz (120Hz Sawtooth) - Adds the "angry" edge
        this.humHigh = new Tone.Oscillator({
            frequency: 120,
            type: "sawtooth",
            volume: -30 // Lowered from -15
        }).start();

        // 3. Plasma Hiss (Filtered Noise) - The gas inside the tube
        this.gasNoise = new Tone.Noise({
            type: "pink",
            volume: -28 // Lowered from -12
        }).start();
        
        // Filter noise to keep only high frequencies (hiss/crackle)
        const hissFilter = new Tone.Filter({
            frequency: 2500,
            type: "highpass",
            Q: 1
        });

        // 4. Subtle Saturation - To glue it together
        const saturation = new Tone.Distortion(0.2);

        // Connect Graph
        this.humLow.connect(this.lightVolume);
        this.humHigh.connect(this.lightVolume);
        
        this.gasNoise.connect(hissFilter);
        hissFilter.connect(saturation);
        saturation.connect(this.lightVolume);
    }

    async win() {
        if (this.isGameOver) return;
        this.isGameOver = true;
        this.log("Win sequence started");

        try {
            if (document.pointerLockElement) {
                document.exitPointerLock();
            }
            
            // Hide UI
            this.setUIMode('none');
            
            // Hide held item and hand
            if (this.hand) this.hand.visible = false;
            
            // Turn off flashlight
            if (this.isFlashlightOn) {
                this.toggleFlashlight(false);
            }
            
            // Stop movement
            if (this.controller) {
                this.controller.enabled = false;
                this.controller.hideControls();
            }
            
            // Audio Synthesis for Car
            const starter = new Tone.MembraneSynth({
                pitchDecay: 0.1,
                octaves: 4,
                oscillator: { type: "square" },
                volume: -10
            }).toDestination();

            // Crank - use safe offsets to prevent Tone.js scheduling errors
            const now = Tone.now() + 0.1;
            starter.triggerAttackRelease("C2", "16n", now);
            starter.triggerAttackRelease("C2", "16n", now + 0.3);
            starter.triggerAttackRelease("C2", "16n", now + 0.6);
            starter.triggerAttackRelease("C2", "16n", now + 0.9);
            
            // Schedule disposal
            setTimeout(() => { if (starter) starter.dispose(); }, 2000);

            // Vroom & Drive Animation
            if (this.world) this.world.startWinSequence();
            
            // Position Camera for Cinematic View
            if (this.fpsCamera) this.fpsCamera.disable();
            
            // Move camera to a cinematic spot
            this.camera.position.set(2, 1.8, -35); 
            this.camera.lookAt(new THREE.Vector3(0, 1.0, -50));

            // Start rumble after "start" sounds
            setTimeout(() => {
                try {
                    // Pre-check if nodes can be created
                    if (typeof Tone.Filter !== 'function' || typeof Tone.Noise !== 'function') return;

                    const filter = new Tone.Filter(200, "highpass").toDestination();
                    const rumble = new Tone.Noise("brown").connect(filter).start();
                    
                    if (filter.frequency) filter.frequency.rampTo(2000, 8);
                    if (rumble.volume) rumble.volume.rampTo(-50, 8);
                    
                    // Fade out global audio slightly but keep the win sound audible
                    Tone.Destination.volume.rampTo(-40, 8);
                    
                    // Cleanup
                    setTimeout(() => {
                        try {
                            if (rumble) {
                                rumble.stop();
                                rumble.dispose();
                            }
                            if (filter) filter.dispose();
                        } catch (e) {}
                    }, 12000);
                } catch (e) {
                    this.log("Win audio error: " + e.message);
                }
            }, 1200);
            
            // Show End Screen
            setTimeout(() => {
                // Check if user already returned to menu while waiting
                if (this.isStarted || this.isGameOver) {
                    // Ensure all ambient loops are stopped or muted
                    this.stopAudio();
                    this.setUIMode('gameover');
                    this.log("Win sequence completed");
                }
            }, 7500);

        } catch (err) {
            this.log(`ERROR in win sequence: ${err.message}`);
            console.error(err);
            // Fallback: show game over screen immediately if something explodes
            if (this.gameOverEl) this.gameOverEl.style.display = 'flex';
        }
    }
    
    updateBatteryUI() {
        if (!this.batteryContainer || !this.batteryLevelEl) return;
        
        this.batteryLevelEl.style.height = `${this.flashlightBattery}%`;
        
        if (this.flashlightBattery > 50) {
            this.batteryLevelEl.style.backgroundColor = '#ffd700';
        } else if (this.flashlightBattery > 20) {
            this.batteryLevelEl.style.backgroundColor = '#ffaa00';
        } else {
            this.batteryLevelEl.style.backgroundColor = '#ff3300';
        }
    }

    async resetGame() {
        console.log("Resetting game...");
        // Show Loading Screen
        this.setUIMode('loading');

        const report = (status, progress) => {
            if (this.loadingStatus) this.loadingStatus.textContent = status;
            if (this.loadingBar) this.loadingBar.style.width = `${progress}%`;
        };

        // Stop any running animations/audio first
        this.stopAudio();
        
        try {
            report('Preparing Audio...', 10);
            this.setupFootsteps();
            this.setupAmbientAudio();
            
            // Reset Audio Master Volume (in case of win sequence fade)
            Tone.Destination.volume.value = 0;
            
            // Reset Global Settings to Defaults for New Game
            this.applySettings({
                sensitivity: 1.0,
                fov: 75,
                invertY: false,
                crosshair: false
            });
            
            // Reset Player State
            if (this.hand) this.hand.visible = true;
            this.inventory.clear();
            this.equippedId = null;
            this.mirrorLookTime = 0;
            this.itemSlot.clear();
            this.initHeldItems();
            this.initFlashlight();
            
            if (this.controller) {
                this.controller.hideControls();
            }
            if (this.fpsCamera) {
                this.fpsCamera.disable();
            }
            
            // Clear Inventory UI List
            if (this.inventoryEl) {
                this.inventoryEl.innerHTML = '';
            }
            this.updateInventoryUI();
            
            // Reset Flashlight
            this.isFlashlightOn = false;
            this.flashlightBattery = 100;
            
            // Hide flashlight UI
            if (this.flashlightBtn) this.flashlightBtn.style.display = 'none';
            if (this.batteryContainer) this.batteryContainer.style.display = 'none';
            
            // Reset Position
            this.player.position.set(0, 1, 0);
            this.fpsCamera.rotationX = 0;
            this.fpsCamera.rotationY = 0;
            this.fpsCamera.currentY = undefined;
            this.fpsCamera.update();
            
            // Reset World
            // We offset progress to start from 20% and go to 95%
            await this.world.build((status, progress) => {
                const scaledProgress = 20 + (progress * 0.75);
                report(status, scaledProgress);
            }); 
            
            report('Ready', 100);
            
            // Artificial pause to show 100% completion
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Reset UI & Game Flags
            this.isGameOver = false;
            this.hasExitedBathroom = false;
        } catch (error) {
            console.error("Game reset failed:", error);
            report('Error during initialization. Check console.', 100);
            // Hide loading screen after 3 seconds so menu is at least accessible
            setTimeout(() => {
                this.setUIMode('menu');
            }, 3000);
        }
        
        // Cancel any pending speech
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
    }

    handleInteraction() {
        if (this.interactiveTarget) {
            // Haptic feedback for mobile
            if (this.isMobile && navigator.vibrate) {
                navigator.vibrate(15);
            }

            const gameState = {
                inventory: {
                    add: (id, name) => this.addToInventory(id, name),
                    has: (id) => this.inventory.has(id)
                },
                equippedId: this.equippedId, // Pass currently equipped item
                playerDirection: this.camera.getWorldDirection(new THREE.Vector3()), // Pass look direction
                win: () => this.win(),
                speak: (text) => this.speak(text), // Add speak to gameState
                readNote: (text) => {
                    this.noteUI.show(text);
                    document.exitPointerLock();
                },
                readNewspaper: () => {
                    this.newspaperUI.show();
                    document.exitPointerLock();
                },
                openLaptop: () => {
                    this.laptopUI.show();
                    document.exitPointerLock();
                }
            };
            const result = this.interactiveTarget.interact(gameState);
            if (typeof result === 'string') {
                this.speak(result, 4000, false); // Interaction results are silent (subtitles only)
            }
        }
    }

    saveGame() {
        const saveData = {
            player: {
                position: this.player.position.toArray(),
                rotation: { x: this.fpsCamera.rotationX, y: this.fpsCamera.rotationY }
            },
            inventory: Array.from(this.inventory),
            world: this.world.getWorldState(),
            hasExitedBathroom: this.hasExitedBathroom,
            settings: {
                sensitivity: parseFloat(this.settingsSlider.value),
                fov: parseInt(this.fovSlider.value),
                invertY: localStorage.getItem('verbatim_invert_y') === 'true',
                crosshair: localStorage.getItem('verbatim_crosshair') === 'true'
            }
        };
        localStorage.setItem('verbatim_save', JSON.stringify(saveData));
        console.log('Game Saved');
    }

    async loadGame() {
        console.log("Loading game...");
        const savedJson = localStorage.getItem('verbatim_save');
        if (!savedJson) return;

        try {
            // Show Loading Screen
            this.setUIMode('loading');
            if (this.loadingStatus) this.loadingStatus.textContent = "Loading Save...";
            console.log("Save data found, starting load sequence...");

            const saveData = JSON.parse(savedJson);
            
            // Stop any existing audio
            this.stopAudio();
            
            this.loadingStatus.textContent = "Preparing Audio...";
            this.setupFootsteps();
            this.setupAmbientAudio();
            
            // Restore Settings if they exist in the save
            if (saveData.settings) {
                this.applySettings(saveData.settings);
            }

            // Restore Player
            if (this.hand) this.hand.visible = true;
            this.player.position.fromArray(saveData.player.position);
            this.fpsCamera.rotationX = saveData.player.rotation.x;
            this.fpsCamera.rotationY = saveData.player.rotation.y;
            this.fpsCamera.update(); // Apply rotation immediately

            this.hasExitedBathroom = saveData.hasExitedBathroom || false;

            // Restore Inventory
            this.inventory = new Set(saveData.inventory);
            this.inventoryEl.innerHTML = ''; // Clear UI
            
            // Check for flashlight first
            if (this.inventory.has('flashlight')) {
                this.flashlightBtn.style.display = 'flex';
                this.batteryContainer.style.display = 'flex';
                this.updateBatteryUI();
            }

            this.inventory.forEach(itemId => {
                if (itemId === 'flashlight') return; // Handled separately

                const nameMap = { 
                    'lighter': 'Lighter', 
                    'key': 'Old Key', 
                    'house_key': 'House Key', 
                    'car_keys': 'Car Keys' 
                };
                // Call addToInventory to re-bind listeners
                this.addToInventory(itemId, nameMap[itemId] || itemId);
            });

            // Restore World
            await this.world.build((status, progress) => {
                if (this.loadingStatus) this.loadingStatus.textContent = status;
                if (this.loadingBar) this.loadingBar.style.width = `${progress}%`;
            });

            // Artificial pause to show 100% completion
            await new Promise(resolve => setTimeout(resolve, 500));

            this.world.restoreWorldState(saveData.world, this.inventory);

            // Start Game
            await this.start(true);

        } catch (e) {
            console.error('Failed to load save', e);
            if (this.loadingScreen) this.loadingScreen.style.display = 'none';
        }
    }

    initFlashlight() {
        // Pre-create Flashlight SpotLight and its target if they don't exist
        if (!this.playerFlashlight) {
            // Positioned slightly offset for better shadow depth without needing a physical model
            this.playerFlashlight = new THREE.SpotLight(0xccccff, 0, 40, Math.PI / 5, 0.3, 1);
            this.playerFlashlight.position.set(0, 0, 0); 
            this.playerFlashlight.target.position.set(0, 0, -1);
            
            this.camera.add(this.playerFlashlight);
            this.camera.add(this.playerFlashlight.target);
        }
        
        this.playerFlashlight.visible = false;
        this.playerFlashlight.intensity = 0;

        // Flashlight mesh is no longer added to the hand to keep the view clear
    }

    toggleFlashlight(forceState = null) {
        if (!this.inventory.has('flashlight')) return;
        
        // Prevent turning on if dead
        if (this.flashlightBattery <= 0 && (forceState === true || (!this.isFlashlightOn && forceState === null))) {
            const click = new Tone.MembraneSynth({ volume: -20 }).toDestination();
            click.triggerAttackRelease("C2", "32n"); // Dead click
            return;
        }

        const newState = forceState !== null ? forceState : !this.isFlashlightOn;
        if (newState === this.isFlashlightOn && forceState === null) return; 

        this.isFlashlightOn = newState;

        if (this.isFlashlightOn) {
            this.flashlightBtn.style.borderColor = '#ffd700';
            this.flashlightBtn.style.backgroundColor = 'rgba(255, 215, 0, 0.2)';
            
            if (this.playerFlashlight) {
                this.playerFlashlight.visible = true;
                this.playerFlashlight.intensity = 2.5;
            }

            const click = new Tone.MembraneSynth({ volume: -20 }).toDestination();
            click.triggerAttackRelease("C4", "32n");
        } else {
            this.flashlightBtn.style.borderColor = 'rgba(255, 255, 255, 0.4)';
            this.flashlightBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
            
            if (this.playerFlashlight) {
                this.playerFlashlight.visible = false;
                this.playerFlashlight.intensity = 0;
            }

             const click = new Tone.MembraneSynth({ volume: -25 }).toDestination();
             click.triggerAttackRelease("G3", "32n");
        }
        this.updateInventoryUI();
    }

    initHeldItems() {
        const ids = ['lighter', 'key', 'house_key', 'car_keys'];
        ids.forEach(id => {
            const mesh = this.createHeldMesh(id);
            if (mesh) {
                mesh.visible = false;
                this.heldMeshes[id] = mesh;
                this.itemSlot.add(mesh);
            }
        });
    }

    createHeldMesh(id) {
        let mesh;
        if (id === 'flashlight') {
            mesh = new THREE.Group();
            const body = new THREE.Mesh(
                new THREE.CylinderGeometry(0.025, 0.02, 0.2, 12),
                new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.5, roughness: 0.4 })
            );
            body.rotation.x = Math.PI / 2;
            mesh.add(body);
            
            const head = new THREE.Mesh(
                new THREE.CylinderGeometry(0.035, 0.025, 0.05, 12),
                new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6, roughness: 0.3 })
            );
            head.rotation.x = Math.PI / 2;
            head.position.z = -0.1;
            mesh.add(head);

            const lens = new THREE.Mesh(
                new THREE.CircleGeometry(0.03, 12),
                new THREE.MeshStandardMaterial({ color: 0xccccff, emissive: 0xccccff, emissiveIntensity: 0.5 })
            );
            lens.position.z = -0.126;
            lens.rotation.y = Math.PI;
            mesh.add(lens);

            mesh.position.set(0, 0, 0.1); // Adjust grip
        } else if (id === 'lighter') {
            mesh = new THREE.Group();
            const body = new THREE.Mesh(
                new THREE.BoxGeometry(0.04, 0.08, 0.02),
                new THREE.MeshStandardMaterial({ color: 0xff0000, metalness: 0.1, roughness: 0.5 })
            );
            mesh.add(body);
            const cap = new THREE.Mesh(
                new THREE.BoxGeometry(0.04, 0.03, 0.02),
                new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.9, roughness: 0.2 })
            );
            cap.position.y = 0.055;
            mesh.add(cap);

            const flame = new THREE.PointLight(0xffaa00, 0.3, 2);
            flame.position.set(0, 0.08, 0);
            mesh.add(flame);

            mesh.rotation.y = Math.PI / 4;
            mesh.rotation.x = Math.PI / 12;
        } else if (id === 'key') {
             const material = new THREE.MeshStandardMaterial({ 
                color: 0x887755, 
                metalness: 0.8, 
                roughness: 0.6 
            });
            mesh = this.createHeldKeyMesh(material, true);
        } else if (id === 'house_key') {
             const material = new THREE.MeshStandardMaterial({ 
                color: 0xcccccc, 
                metalness: 0.9, 
                roughness: 0.2 
            });
            mesh = this.createHeldKeyMesh(material, false);
        } else if (id === 'car_keys') {
            mesh = new THREE.Group();
            const blackPlastic = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
            const metal = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.2 });

            const fob = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.1), blackPlastic);
            mesh.add(fob);

            const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.005, 0.08), metal);
            blade.position.z = 0.08;
            mesh.add(blade);
            
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.005, 8, 16), metal);
            ring.position.z = -0.06;
            ring.rotation.x = Math.PI / 2;
            mesh.add(ring);

            mesh.rotation.y = Math.PI / 2;
            mesh.rotation.x = -Math.PI / 2; 
            mesh.rotation.z = Math.PI / 4;
        }
        return mesh;
    }

    equipItem(id) {
        // Hide currently equipped
        if (this.equippedId && this.heldMeshes[this.equippedId]) {
            this.heldMeshes[this.equippedId].visible = false;
        }

        if (this.equippedId === id) {
            this.equippedId = null;
        } else {
            this.equippedId = id;
            if (this.heldMeshes[id]) {
                this.heldMeshes[id].visible = true;
            }
        }
        
        this.updateInventoryUI();
    }

    createHeldKeyMesh(material, isSkeleton) {
        const group = new THREE.Group();
        
        if (isSkeleton) {
            // Skeleton Key Look
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.01, 8, 16), material);
            ring.position.y = 0.1;
            group.add(ring);
            
            const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.15, 8), material);
            shaft.position.y = 0.025;
            group.add(shaft);
            
            const teeth = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.005), material);
            teeth.position.set(0.015, -0.03, 0);
            group.add(teeth);
        } else {
            // Modern Key Look
            const head = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.01, 16), material);
            head.rotation.x = Math.PI / 2;
            head.position.y = 0.1;
            group.add(head);

            const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.15, 0.01), material);
            shaft.position.y = 0.025;
            group.add(shaft);

            const teeth1 = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), material);
            teeth1.position.set(0.01, -0.02, 0);
            group.add(teeth1);

            const teeth2 = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), material);
            teeth2.position.set(0.01, -0.04, 0);
            group.add(teeth2);
        }

        group.rotation.y = Math.PI / 2;
        group.rotation.x = -Math.PI / 2; 
        group.rotation.z = Math.PI / 4;
        return group;
    }

    updateInventoryUI() {
        // Update Equipped Slot
        this.equippedSlotEl.innerHTML = '';
        if (this.equippedId) {
            const img = document.createElement('img');
            img.src = this.getItemIcon(this.equippedId);
            this.equippedSlotEl.appendChild(img);
            this.equippedSlotEl.classList.add('active');
        } else {
            this.equippedSlotEl.classList.remove('active');
        }

        // Update active class in list
        const items = this.inventoryEl.children;
        for (let item of items) {
            if (item.dataset.id === this.equippedId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        }
    }

    getItemIcon(id) {
        if (id === 'key') return ASSETS.KEY_TEXTURE;
        if (id === 'house_key') return ASSETS.HOUSE_KEY_ICON;
        if (id === 'car_keys') return ASSETS.CAR_KEYS_ICON; 
        if (id === 'lighter') return ASSETS.LIGHTER_ICON;
        return 'https://via.placeholder.com/50?text=?'; 
    }

    addToInventory(id, name) {
        // Special logic for flashlight: It doesn't go into standard equip slots, it becomes a toggle
        if (id === 'flashlight') {
            if (!this.inventory.has('flashlight')) {
                this.inventory.add('flashlight');
                this.flashlightBtn.style.display = 'flex';
                this.batteryContainer.style.display = 'flex';
                // Auto-equip/turn on when picked up
                this.toggleFlashlight(true);
                this.speak("This will be useful.");
            }
            return;
        }

        // Remove strict check or handle restore better
        // The set logic is fine but we need to ensure UI is rebuilt if it was cleared
        if (!this.inventory.has(id) || this.inventoryEl.children.length < this.inventory.size) {
            this.inventory.add(id);
            // Check if element already exists to avoid dupes in restore scenario if logic changes
            if (!this.inventoryEl.querySelector(`[data-id="${id}"]`)) {
                const itemEl = document.createElement('div');
                itemEl.className = 'inventory-item';
                // itemEl.textContent = name; // Replaced with icon
                itemEl.dataset.id = id;

                const img = document.createElement('img');
                img.src = this.getItemIcon(id);
                itemEl.appendChild(img);
                
                const handleEquip = (e) => {
                    e.preventDefault(); // Prevent ghost clicks and scrolling
                    e.stopPropagation(); 
                    this.equipItem(id);
                };
                
                // Add both but ensure we don't double fire if device supports both
                // Using a flag or just relying on preventDefault in touchstart preventing click
                itemEl.addEventListener('touchstart', handleEquip, { passive: false });
                itemEl.addEventListener('click', handleEquip);
                
                this.inventoryEl.appendChild(itemEl);
            }
        }
    }

    showTempPrompt(text) {
        // Pop-up text removed for immersion
    }

    speak(text, duration = 4000, useVoice = true) {
        if (!this.subtitlesEl) return;

        // Visual Subtitles
        this.subtitlesEl.textContent = text;
        this.subtitlesEl.style.opacity = '1';
        
        // Voice Synthesis
        if (useVoice && 'speechSynthesis' in window) {
            // Cancel any ongoing speech
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            
            // Character Profile: Disoriented female, low energy
            utterance.rate = 0.85; 
            utterance.pitch = 0.9; 
            utterance.volume = 0.45; 
            
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                // Favor female voices
                const preferredVoice = voices.find(v => v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('zira') || v.name.toLowerCase().includes('samantha'));
                if (preferredVoice) utterance.voice = preferredVoice;
            }

            window.speechSynthesis.speak(utterance);
        }

        clearTimeout(this.subtitleTimeout);
        this.subtitleTimeout = setTimeout(() => {
            this.subtitlesEl.style.opacity = '0';
        }, duration);
    }

    updateRaycaster() {
        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        const intersects = this.raycaster.intersectObjects(this.world.interactiveObjects, true);

        if (intersects.length > 0) {
            const hit = intersects[0];
            let interactive = hit.object;
            // Traverse up to find the InteractiveObject
            while (interactive && !interactive.isInteractive) {
                interactive = interactive.parent;
            }

            if (interactive && interactive.isInteractive && interactive.visible && hit.distance < CONFIG.INTERACT_DISTANCE) {
                this.interactiveTarget = interactive;
                
                // Highlight Logic
                if (this.highlightedObject !== interactive) {
                    if (this.highlightedObject) this.unhighlightObject(this.highlightedObject);
                    this.highlightObject(interactive);
                }

                return;
            }
        }

        // Nothing hit or too far
        this.interactiveTarget = null;
        if (this.highlightedObject) {
            this.unhighlightObject(this.highlightedObject);
            this.highlightedObject = null;
        }
    }

    highlightObject(object) {
        // Exclude specific objects that shouldn't glow (Doors, Shower, Spout/Swivel, Mirror, and Soap Dispenser)
        const id = object.objectId?.toLowerCase() || "";
        if (id.includes('swivel') || id.includes('soap') || id.includes('door') || id.includes('shower') || id.includes('sink') || id.includes('handle') || id.includes('tap') || id.includes('mirror')) return;

        this.highlightedObject = object;
        this.highlightStore.clear();

        object.traverse((child) => {
            if (child.isMesh && child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(mat => {
                    // Use material uuid to correctly handle shared materials
                    if (mat.emissive && !this.highlightStore.has(mat.uuid)) {
                        // Save original state
                        this.highlightStore.set(mat.uuid, {
                            emissive: mat.emissive.clone(),
                            emissiveIntensity: mat.emissiveIntensity
                        });

                        // Apply gold highlight base - Much stronger for visibility
                        mat.emissive.setHex(0xffd700);
                        mat.emissiveIntensity = 0.5; // Brighter start
                    }
                });
            }
        });
    }

    unhighlightObject(object) {
        object.traverse((child) => {
            if (child.isMesh && child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(mat => {
                    const stored = this.highlightStore.get(mat.uuid);
                    if (stored) {
                        if (mat.emissive) {
                            mat.emissive.copy(stored.emissive);
                            mat.emissiveIntensity = stored.emissiveIntensity;
                        }
                    }
                });
            }
        });
        this.highlightStore.clear();
    }

    checkColliders(oldPos) {
        // Optimization: Use reusable temp objects to avoid GC stutter
        
        // Helper to check collision at a specific position
        const check = (pos) => {
            this.tempPlayerBox.setFromCenterAndSize(pos, this.playerSize);

            for (const collider of this.world.colliders) {
                // Optimization: Lazy cache bounding box
                if (!collider.geometry.boundingBox) collider.geometry.computeBoundingBox();
                
                // Use tempBox to avoid creating new Box3 every iteration
                // We must apply the world matrix to get world bounds
                if (collider.matrixWorldNeedsUpdate) collider.updateMatrixWorld();
                
                this.tempColliderBox.copy(collider.geometry.boundingBox);
                this.tempColliderBox.applyMatrix4(collider.matrixWorld);
                
                if (this.tempPlayerBox.intersectsBox(this.tempColliderBox)) {
                    return true;
                }
            }
            return false;
        };

        // If current position is bad
        if (check(this.player.position)) {
            const currentX = this.player.position.x;
            const currentZ = this.player.position.z;
            
            // Try sliding along X (Reset Z to safe oldZ)
            this.player.position.z = oldPos.z;
            if (check(this.player.position)) {
                // X movement was also bad? Or X was the problem.
                // Revert X to safe oldX
                this.player.position.x = oldPos.x;
                
                // Now at (oldX, oldZ) - Safe.
                // Try applying Z movement only (from oldX)
                this.player.position.z = currentZ;
                if (check(this.player.position)) {
                    // Z also bad. Revert Z.
                    this.player.position.z = oldPos.z;
                    // Result: stuck (both axes blocked)
                }
                // Else: We kept Z. Result: Slid along Z.
            } else {
                // X movement was safe. We are at (newX, oldZ).
                // Now try applying Z from here? 
                // No, we already know (newX, newZ) failed.
                // So we can only keep X OR keep Z.
                // But wait, if we are at (newX, oldZ) and it's safe, 
                // and (oldX, newZ) is safe, 
                // but (newX, newZ) is bad (corner).
                // We should pick one. Usually the one with larger movement?
                // Or just prioritize one axis. 
                // The logic above prioritizes sliding along X first.
                // Let's stick to simple "Try X only. If bad, revert X. Then Try Z only. If bad revert Z."
                // Wait, if I do:
                // 1. Reset X,Z to old.
                // 2. Apply X. If bad, revert X.
                // 3. Apply Z. If bad, revert Z.
                // This handles all cases:
                // - Hit flat wall normal to X: X bad (revert), Z good (keep). Slide along Z.
                // - Hit flat wall normal to Z: X good (keep), Z bad (revert). Slide along X.
                // - Hit corner: X bad (revert), Z bad (revert). Stop.
                
                // Let's implement this robustly:
                this.player.position.x = oldPos.x;
                this.player.position.z = oldPos.z;
                
                // Try X
                this.player.position.x = currentX;
                if (check(this.player.position)) {
                    this.player.position.x = oldPos.x;
                }
                
                // Try Z (from whatever X state we are in)
                // Note: If X was safe, we are testing (newX, newZ).
                // But we already know (newX, newZ) is bad (the initial check).
                // So if X was kept, Z MUST fail if it was a corner hit?
                // Not necessarily. 
                // Example: Corner. (newX, newZ) hits.
                // Try X (newX, oldZ): Safe. Keep X.
                // Try Z (newX, newZ): Hits. Revert Z.
                // Result: (newX, oldZ). Slide along X.
                
                // This effectively "slides" you past the obstacle.
                this.player.position.z = currentZ;
                if (check(this.player.position)) {
                     this.player.position.z = oldPos.z;
                }
            }
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        let deltaTime = this.clock.getDelta();
        // Cap deltaTime to prevent physics explosions during lag spikes (max 0.1s)
        deltaTime = Math.min(deltaTime, 0.1);

        if (this.isStarted) {
            // Ensure audio context is resumed on any interaction if it's suspended
            if (Tone.context.state === 'suspended') {
                Tone.context.resume();
            }

            if (!this.isGameOver) {
                // ... (rest of movement logic)
                const oldPos = this.player.position.clone();
                
                // Allow camera to process input (look)
                const rotation = this.fpsCamera.updateRotationOnly(); 
                
                // --- Ground Detection & Slope Handling ---
                if (this.groundRaycaster && this.world && this.world.floors.length > 0) {
                    this.groundRaycaster.ray.origin.set(this.player.position.x, this.player.position.y + 2.0, this.player.position.z);
                    const hits = this.groundRaycaster.intersectObjects(this.world.floors, false);
                    if (hits.length > 0) {
                        this.controller.groundLevel = hits[0].point.y;
                        this.missedGroundFrames = 0;
                    } else {
                        this.missedGroundFrames++;
                        if (this.missedGroundFrames > 10) {
                             this.controller.groundLevel = -Infinity; 
                        }
                    }
                }

                // Move player
                this.controller.update(deltaTime, rotation);
                this.checkColliders(oldPos);
                this.fpsCamera.updatePosition(); 
                
                // --- Head Bob & Footsteps ---
                this.tempVector.set(this.controller.velocity.x, 0, this.controller.velocity.z);
                const speed = this.tempVector.length();
                if (this.controller.isOnGround && speed > 0.1) {
                    this.stepCycle += speed * deltaTime * 5.0; 
                    const bobY = Math.sin(this.stepCycle) * 0.04;
                    this.camera.position.y += bobY;
                    if (this.stepCycle >= this.nextStepTrigger) {
                        this.playFootstep();
                        this.nextStepTrigger += Math.PI * 2;
                    }
                } else {
                    this.stepCycle = 0;
                    this.nextStepTrigger = Math.PI * 1.4;
                }
                
                this.updateRaycaster();

                // --- Mirror Scare Logic ---
                if (this.interactiveTarget && this.interactiveTarget.objectId === 'bathroom_mirror') {
                    this.mirrorLookTime += deltaTime;
                    if (this.mirrorLookTime >= 2.0) {
                        this.world.triggerMirrorScare();
                    }
                } else {
                    this.mirrorLookTime = 0;
                }

                // --- Highlight Pulsing ---
                if (this.highlightedObject) {
                    const time = this.clock.getElapsedTime();
                    // Stronger pulsing gold (0.3 to 0.7 intensity)
                    const pulseIntensity = 0.5 + Math.sin(time * 4) * 0.2;
                    this.highlightedObject.traverse((child) => {
                        if (child.isMesh && child.material) {
                            const mats = Array.isArray(child.material) ? child.material : [child.material];
                            mats.forEach(mat => {
                                if (mat.emissive && this.highlightStore.has(mat.uuid)) {
                                    mat.emissiveIntensity = pulseIntensity;
                                }
                            });
                        }
                    });
                }
                
                // Bathroom Exit Trigger
                // ... (rest of loop)
                if (!this.hasExitedBathroom && this.player.position.z < -2.6) {
                    this.hasExitedBathroom = true;
                    setTimeout(() => this.speak("Whose home am I in?"), 500);
                }

                // Flashlight Battery Logic
                if (this.isFlashlightOn && this.inventory.has('flashlight')) {
                    this.flashlightBattery -= deltaTime * this.batteryDrainRate;
                    if (this.flashlightBattery <= 0) {
                        this.flashlightBattery = 0;
                        this.toggleFlashlight(false);
                    }
                } else if (this.inventory.has('flashlight') && this.flashlightBattery < 100) {
                    this.flashlightBattery += deltaTime * this.batteryRechargeRate;
                }
            }

            // --- Updates that happen regardless of gameOver state (animations, cutscenes) ---
            const flashlightParams = {
                on: this.isFlashlightOn && this.inventory.has('flashlight'),
                pos: this.camera.getWorldPosition(new THREE.Vector3()),
                dir: this.camera.getWorldDirection(new THREE.Vector3())
            };
            this.world.update(deltaTime, this.player.position, flashlightParams);

            // Light flicker logic & Sound Sync
            const flickerLight = this.world?.flickerLight;
            if (flickerLight && this.lightVolume) {
                const isFlickering = Math.random() < 0.05;
                flickerLight.intensity = isFlickering ? 0 : 0.8 + Math.random() * 0.7;
                
                // Audio update throttled to ~10Hz
                if (!this._lastAudioUpdate || performance.now() - this._lastAudioUpdate > 100) {
                    const dist = this.player.position.distanceTo(flickerLight.position);
                    if (dist < 20) {
                        let targetVol = -10 - (dist * 4);
                        if (isFlickering) targetVol = -100;
                        this.lightVolume.volume.rampTo(Math.max(-100, targetVol), 0.1);
                    } else {
                        if (this.lightVolume.volume.value > -100) this.lightVolume.volume.rampTo(-100, 0.5);
                    }
                    this._audioUpdatedThisFrame = true;
                }
            }

            if (this.inventory.has('flashlight')) {
                this.updateBatteryUI();
            }
            
            // --- Spatial Audio Logic Throttled ---
            if (this._audioUpdatedThisFrame) {
                this._audioUpdatedThisFrame = false;
                this._lastAudioUpdate = performance.now();

                // 1. Outdoor Ambience: House ends at z = -24.5
                if (this.outdoorVolume) {
                    const isOutside = this.player.position.z < -24.5;
                    const targetOutdoorVol = isOutside ? -20 : -100;
                    if (Math.abs(this.outdoorVolume.volume.value - targetOutdoorVol) > 1) {
                        this.outdoorVolume.volume.rampTo(targetOutdoorVol, 1.5);
                    }
                }

                // 2. Fridge Hum: Kitchen area
                if (this.fridgeVolume && this.world.fridgePos) {
                    const dist = this.player.position.distanceTo(this.world.fridgePos);
                    if (dist < 12) {
                        const targetVol = -15 - (dist * 4.5);
                        this.fridgeVolume.volume.rampTo(Math.max(-100, targetVol), 0.2);
                    } else {
                        if (this.fridgeVolume.volume.value > -100) this.fridgeVolume.volume.rampTo(-100, 0.5);
                    }
                }

                // 3. Fan "Swish": Living Room area
                if (this.fanVolume && this.world.fanObject) {
                    const isFanOn = this.world.isFanOn;
                    const dist = this.player.position.distanceTo(this.world.fanObject.position);
                    
                    if (isFanOn && dist < 25) {
                        const targetVol = -22 - (dist * 2.8); 
                        this.fanVolume.volume.rampTo(Math.max(-100, targetVol), 0.2);
                    } else {
                        if (this.fanVolume.volume.value > -100) this.fanVolume.volume.rampTo(-100, 0.5);
                    }
                }
            }
            
            this.renderer.render(this.scene, this.camera);
        } else {
            // Render Menu Scene
            if (this.water) this.water.material.uniforms[ 'time' ].value += 1.0 / 60.0;
            if (this.titleMesh) {
                this.titleMesh.position.y = 1.5 + Math.sin(this.clock.getElapsedTime()) * 0.05;
                this.titleMesh.material.emissiveIntensity = 0.5 + Math.sin(this.clock.getElapsedTime() * 2) * 0.2;
            }
            if (this.menuScene && this.menuCamera) {
                this.renderer.render(this.menuScene, this.menuCamera);
            }
        }
    }
}

new Game();
