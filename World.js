import * as THREE from 'three';
import * as Tone from 'tone';
import { ASSETS } from './config.js';
import { InteractiveObject, Item } from './InteractiveObject.js';

class DustMotes {
    constructor(volumeSize, count = 100) {
        this.group = new THREE.Group();
        this.volumeSize = volumeSize;
        this.count = count;
        
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        
        for (let i = 0; i < count; i++) {
            positions[i * 3] = (Math.random() - 0.5) * volumeSize.x;
            positions[i * 3 + 1] = (Math.random() - 0.5) * volumeSize.y;
            positions[i * 3 + 2] = (Math.random() - 0.5) * volumeSize.z;
            sizes[i] = Math.random() * 0.02 + 0.005;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        const material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.02,
            transparent: true,
            opacity: 0.3,
            sizeAttenuation: true,
            blending: THREE.AdditiveBlending
        });
        
        this.points = new THREE.Points(geometry, material);
        this.group.add(this.points);
        
        this.velocities = [];
        for (let i = 0; i < count; i++) {
            this.velocities.push(new THREE.Vector3(
                (Math.random() - 0.5) * 0.01,
                (Math.random() - 0.5) * 0.01,
                (Math.random() - 0.5) * 0.01
            ));
        }
    }

    update(deltaTime) {
        const positions = this.points.geometry.attributes.position.array;
        for (let i = 0; i < this.count; i++) {
            const vel = this.velocities[i];
            
            positions[i * 3] += vel.x * deltaTime * 10.0;
            positions[i * 3 + 1] += vel.y * deltaTime * 10.0;
            positions[i * 3 + 2] += vel.z * deltaTime * 10.0;
            
            // Wrap around
            if (Math.abs(positions[i * 3]) > this.volumeSize.x / 2) positions[i * 3] *= -0.95;
            if (Math.abs(positions[i * 3 + 1]) > this.volumeSize.y / 2) positions[i * 3 + 1] *= -0.95;
            if (Math.abs(positions[i * 3 + 2]) > this.volumeSize.z / 2) positions[i * 3 + 2] *= -0.95;
        }
        this.points.geometry.attributes.position.needsUpdate = true;
    }
}

class ShowerWater {
    constructor(count = 400) {
        this.group = new THREE.Group();
        this.count = count;
        this.active = false;
        
        const geometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(count * 3);
        this.velocities = new Float32Array(count);
        
        for (let i = 0; i < count; i++) {
            this.resetParticle(i);
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        
        const material = new THREE.PointsMaterial({
            color: 0x88ccff,
            size: 0.015,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        });
        
        this.points = new THREE.Points(geometry, material);
        this.group.add(this.points);
    }

    resetParticle(i) {
        // Rain head radius approx 0.12
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * 0.12;
        this.positions[i * 3] = Math.cos(angle) * r;
        this.positions[i * 3 + 1] = -Math.random() * 0.1; // Start exactly at head or slightly below
        this.positions[i * 3 + 2] = Math.sin(angle) * r;
        this.velocities[i] = 1.5 + Math.random() * 2.0; // Falling speed
    }

    update(deltaTime) {
        if (!this.active && this.points.material.opacity <= 0.01) {
            this.points.visible = false;
            return;
        }

        this.points.visible = true;
        const positions = this.points.geometry.attributes.position.array;
        
        // Target opacity based on active state
        const targetOpacity = this.active ? 0.4 : 0;
        this.points.material.opacity += (targetOpacity - this.points.material.opacity) * 5.0 * deltaTime;

        for (let i = 0; i < this.count; i++) {
            positions[i * 3 + 1] -= this.velocities[i] * deltaTime;
            
            // If particle hits the "floor" of the shower (trayHeight is approx 0.15, head is at 2.2 + trayHeight)
            // Relative to head (0,0,0), floor is at -2.1
            if (positions[i * 3 + 1] < -2.1) {
                this.resetParticle(i);
            }
        }
        this.points.geometry.attributes.position.needsUpdate = true;
    }
}

class BeadCurtain {
    constructor(scene, position, rotationY, width, height) {
        this.scene = scene;
        this.position = position;
        this.rotationY = rotationY;
        this.width = width;
        this.height = height;
        
        this.numStrings = 35; 
        this.beadsPerString = 18; 
        this.spacing = width / this.numStrings;
        this.segLen = height / this.beadsPerString;
        
        this.strings = [];
        this.lastSoundTime = 0;

        // Pre-allocate temporary vectors for physics calculations
        this.temp = new THREE.Vector3();
        this.vel = new THREE.Vector3();
        this.delta = new THREE.Vector3();
        this.gravity = new THREE.Vector3(0, -9.8, 0);

        // Physics Init
        for (let i = 0; i < this.numStrings; i++) {
            const stringNodes = [];
            const offset = (i - this.numStrings / 2) * this.spacing;
            for (let j = 0; j < this.beadsPerString; j++) {
                const localPos = new THREE.Vector3(0, -j * this.segLen, offset);
                localPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
                const worldPos = localPos.add(position);
                
                stringNodes.push({
                    pos: worldPos.clone(),
                    oldPos: worldPos.clone(),
                    restPos: worldPos.clone(), // Ideal vertical rest position
                    isFixed: j === 0,
                    anchor: worldPos.clone() 
                });
            }
            this.strings.push({
                nodes: stringNodes,
                isSleeping: true,
                energy: 0
            });
        }

        const beadGeo = new THREE.CylinderGeometry(0.015, 0.015, this.segLen * 0.8, 6);
        beadGeo.rotateZ(Math.PI / 2); 
        
        const beadMat = new THREE.MeshStandardMaterial({ 
            color: 0x3a2a1a, 
            roughness: 0.8,
            metalness: 0.2 
        });
        
        this.mesh = new THREE.InstancedMesh(beadGeo, beadMat, this.numStrings * this.beadsPerString);
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);
        
        this.dummy = new THREE.Object3D();

        // Initial Matrix Update so they are visible even if far away initially
        this.updateMatrices();
    }

    updateMatrices() {
        let idx = 0;
        const up = new THREE.Vector3(1, 0, 0);
        for (let s = 0; s < this.strings.length; s++) {
            const string = this.strings[s];
            const nodes = string.nodes;
            for (let i = 0; i < nodes.length; i++) {
                const p = nodes[i];
                this.dummy.position.copy(p.pos);
                
                if (i > 0) {
                    const pPrev = nodes[i-1];
                    this.delta.copy(p.pos).sub(pPrev.pos).normalize();
                    this.dummy.quaternion.setFromUnitVectors(up, this.delta);
                } else {
                    this.dummy.rotation.set(0, 0, -Math.PI/2);
                }

                this.dummy.updateMatrix();
                this.mesh.setMatrixAt(idx++, this.dummy.matrix);
            }
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    update(deltaTime, playerPos, poolAudio) {
        const playerRadius = 0.55; 
        const curtainPos = this.position;
        const distToCurtainSq = playerPos.distanceToSquared(curtainPos);
        
        // Increase threshold for physics but always update matrices if close enough to see
        if (distToCurtainSq > 1600) return; 

        let curtainInteracted = false;
        const damping = 0.994; 
        const subSteps = 8;
        const subDt = Math.min(deltaTime, 0.032) / subSteps;
        const subDtSq = subDt * subDt;

        const isVisible = distToCurtainSq < 900; // Within 30m

        for (let s = 0; s < this.strings.length; s++) {
            const string = this.strings[s];
            const nodes = string.nodes;
            
            // Proximity check for waking up
            const distToPlayerSq = nodes[nodes.length - 1].pos.distanceToSquared(playerPos);
            
            if (distToPlayerSq < 4.0 || string.energy > 0.00001) {
                string.isSleeping = false;
            } else {
                if (!string.isSleeping) {
                    string.isSleeping = true;
                    for (let i = 1; i < nodes.length; i++) {
                        nodes[i].pos.copy(nodes[i].restPos);
                        nodes[i].oldPos.copy(nodes[i].restPos);
                    }
                }
                if (string.isSleeping) continue;
            }

            string.energy = 0;

            for (let step = 0; step < subSteps; step++) {
                // 1. Integration
                for (let i = 1; i < nodes.length; i++) {
                    const p = nodes[i];
                    this.temp.copy(p.pos);
                    this.vel.copy(p.pos).sub(p.oldPos).multiplyScalar(damping);
                    
                    p.pos.add(this.vel);
                    p.pos.addScaledVector(this.gravity, subDtSq);
                    p.oldPos.copy(this.temp);
                }

                // 2. Constraints
                for (let iter = 0; iter < 4; iter++) {
                    // Length Constraints
                    for (let i = 1; i < nodes.length; i++) {
                        const p1 = nodes[i-1];
                        const p2 = nodes[i];
                        this.delta.copy(p2.pos).sub(p1.pos);
                        const currentLen = this.delta.length();
                        if (currentLen < 0.0001) continue;
                        const diff = (currentLen - this.segLen) / currentLen;
                        
                        const factor = p1.isFixed ? 1.0 : 0.5;
                        this.delta.multiplyScalar(diff * factor);
                        
                        if (!p1.isFixed) p1.pos.add(this.delta);
                        p2.pos.sub(this.delta);
                    }

                    // Player Collision
                    for (let i = 1; i < nodes.length; i++) {
                        const p = nodes[i];
                        const dx = p.pos.x - playerPos.x;
                        const dz = p.pos.z - playerPos.z;
                        const distSq = dx * dx + dz * dz;
                        const dy = p.pos.y - playerPos.y; 

                        if (distSq < playerRadius * playerRadius && dy > -0.2 && dy < 2.2) {
                            const dist = Math.sqrt(distSq);
                            if (dist > 0) {
                                const push = (playerRadius - dist) / dist;
                                p.pos.x += dx * push;
                                p.pos.z += dz * push;
                                curtainInteracted = true;
                            }
                        }
                    }
                }
            }

            // Update energy for next frame's sleep check
            for (let i = 1; i < nodes.length; i++) {
                string.energy += nodes[i].pos.distanceToSquared(nodes[i].oldPos);
            }
        }

        // Update Visual Mesh
        let idx = 0;
        const up = new THREE.Vector3(1, 0, 0);
        for (let s = 0; s < this.strings.length; s++) {
            const string = this.strings[s];
            const nodes = string.nodes;
            for (let i = 0; i < nodes.length; i++) {
                const p = nodes[i];
                this.dummy.position.copy(p.pos);
                
                if (i > 0) {
                    const pPrev = nodes[i-1];
                    this.delta.copy(p.pos).sub(pPrev.pos).normalize();
                    this.dummy.quaternion.setFromUnitVectors(up, this.delta);
                } else {
                    this.dummy.rotation.set(0, 0, -Math.PI/2);
                }

                this.dummy.updateMatrix();
                this.mesh.setMatrixAt(idx++, this.dummy.matrix);
            }
        }
        this.mesh.instanceMatrix.needsUpdate = true;

        if (curtainInteracted && performance.now() - this.lastSoundTime > 80) {
            if (poolAudio && poolAudio.clack) {
                poolAudio.clack.triggerAttackRelease("A5", "64n", "+0.05");
            }
            this.lastSoundTime = performance.now();
        }
    }
}

class Rat {
    constructor(scene, audio) {
        this.scene = scene;
        this.audio = audio;
        this.group = new THREE.Group();
        this.active = false;
        this.triggered = false;
        this.despawned = false;
        this.speed = 4.8;
        this.waypoints = [
            new THREE.Vector3(1.2, 0.05, -5.5),   // Start near right wall
            new THREE.Vector3(0.0, 0.05, -7.8),   // Pass DIRECTLY in front of floor flashlight
            new THREE.Vector3(-1.0, 0.05, -10.5), // Scurry towards living room wall
            new THREE.Vector3(0.1, 0.05, -13.5),  // Into living room entrance
            new THREE.Vector3(5, 0.05, -18.5),    // Turn towards kitchen
            new THREE.Vector3(12, 0.05, -18.5)    // Deep into kitchen/pantry
        ];
        this.currentWaypoint = 0;

        // Realistic dark brownish-grey with slight specular for visibility in light
        const bodyMat = new THREE.MeshStandardMaterial({ 
            color: 0x4a4540, 
            roughness: 0.6,
            metalness: 0.1,
            emissive: 0x050505, // Extremely faint for volume definition
            emissiveIntensity: 0.1
        });
        
        // Body (Slightly larger for better visibility)
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), bodyMat);
        body.scale.set(1.8, 0.8, 1.0);
        body.castShadow = true;
        this.group.add(body);

        // Head
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), bodyMat);
        head.position.set(0, 0.01, 0.13);
        head.castShadow = true;
        this.group.add(head);

        // Eyes (Tiny black beads)
        const eyeGeo = new THREE.SphereGeometry(0.008, 6, 6);
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.1 });
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(0.02, 0.02, 0.16);
        head.add(eyeL);
        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(-0.02, 0.02, 0.16);
        head.add(eyeR);

        // Ears
        const earGeo = new THREE.SphereGeometry(0.022, 8, 8);
        const earL = new THREE.Mesh(earGeo, bodyMat);
        earL.position.set(0.03, 0.05, 0.12);
        earL.castShadow = true;
        this.group.add(earL);
        const earR = new THREE.Mesh(earGeo, bodyMat);
        earR.position.set(-0.03, 0.05, 0.12);
        earR.castShadow = true;
        this.group.add(earR);

        // Tail
        this.tail = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.002, 0.25), bodyMat);
        this.tail.rotation.x = Math.PI / 2;
        this.tail.position.set(0, -0.01, -0.18);
        this.tail.castShadow = true;
        this.group.add(this.tail);

        this.group.position.copy(this.waypoints[0]);
        this.group.visible = false;
        this.scene.add(this.group);
        
        // Improved Organic Squeak Sound
        this.squeakSynth = new Tone.FMSynth({
            harmonicity: 3,
            modulationIndex: 10,
            oscillator: { type: "sine" },
            modulation: { type: "triangle" },
            envelope: { attack: 0.01, decay: 0.1, sustain: 0.1, release: 0.2 },
            volume: -20
        }).toDestination();
        
        this.rustleSynth = new Tone.NoiseSynth({
            noise: { type: 'pink' },
            envelope: { attack: 0.01, decay: 0.08, sustain: 0, release: 0.05 }
        }).toDestination();
        this.rustleSynth.volume.value = -35;
        this.lastRustleTime = 0;
        this.lastScheduledTime = 0;
    }

    trigger() {
        if (this.triggered || this.despawned) return;
        this.triggered = true;
        
        this.group.visible = true;
        
        // Organic rapid squeaking with pitch ramps - use safe scheduling
        const now = Math.max(Tone.now(), this.lastScheduledTime) + 0.05;
        this.squeakSynth.triggerAttackRelease("C7", "32n", now);
        this.squeakSynth.frequency.exponentialRampTo("C8", 0.05, now);
        
        const secondSqueak = now + 0.15;
        this.squeakSynth.triggerAttackRelease("A6", "32n", secondSqueak);
        this.squeakSynth.frequency.exponentialRampTo("A7", 0.05, secondSqueak);

        this.lastScheduledTime = secondSqueak + 0.1;

        setTimeout(() => {
            this.active = true;
        }, 150);
    }

    reset() {
        this.active = false;
        this.triggered = false;
        this.despawned = false;
        this.currentWaypoint = 0;
        this.group.position.copy(this.waypoints[0]);
        this.group.visible = false;
        this.lastScheduledTime = 0;
    }

    update(deltaTime) {
        if (!this.active || this.despawned) return;

        const target = this.waypoints[this.currentWaypoint];
        const dir = new THREE.Vector3().subVectors(target, this.group.position);
        const dist = dir.length();

        if (dist < 0.2) {
            this.currentWaypoint++;
            if (this.currentWaypoint >= this.waypoints.length) {
                this.active = false;
                this.despawned = true;
                this.group.visible = false;
                return;
            }
        }

        dir.normalize();
        this.group.position.addScaledVector(dir, this.speed * deltaTime);
        
        const targetRot = Math.atan2(dir.x, dir.z);
        this.group.rotation.y = targetRot;

        const time = performance.now();
        // Faster, shallower scuttle bounce
        this.group.position.y = 0.05 + Math.abs(Math.sin(time * 0.06)) * 0.02;
        
        // Dynamic tail twitch
        if (this.tail) {
            this.tail.rotation.z = Math.sin(time * 0.08) * 0.3;
            this.tail.rotation.x = (Math.PI / 2) + Math.cos(time * 0.04) * 0.1;
        }
        
        if (time - this.lastRustleTime > 120 && Math.random() < 0.15) {
            const schedTime = Math.max(Tone.now(), this.lastScheduledTime) + 0.05;
            this.rustleSynth.triggerAttackRelease("32n", schedTime);
            this.lastScheduledTime = schedTime + 0.05;
            this.lastRustleTime = time;
        }
    }
}

export class World {
    constructor(scene) {
        this.scene = scene;
        this.loadingManager = new THREE.LoadingManager();
        this.textureLoader = new THREE.TextureLoader(this.loadingManager);
        this.texturesLoaded = false;
        this.loadError = false;

        this.loadingManager.onLoad = () => {
            this.texturesLoaded = true;
            this.loadError = false;
            console.log("All textures loaded successfully");
        };

        this.loadingManager.onError = (url) => {
            this.loadError = true;
            console.error("Error loading texture:", url);
            // We still want to allow the game to proceed if some textures fail
        };

        this.loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
            const progress = (itemsLoaded / itemsTotal) * 100;
            if (this.onLoadProgress) this.onLoadProgress(progress);
        };
        
        // Root group for easy cleanup
        this.root = new THREE.Group();
        this.scene.add(this.root);

        this.interactiveObjects = [];
        this.colliders = []; 
        this.floors = []; 
        this.activeAnimations = [];
        this.lights = []; 
        this.dustSystems = []; 
        
        // Audio Pool for Pool Table to prevent node accumulation
        this.poolAudio = {
            plop: new Tone.MembraneSynth({ volume: -15 }).toDestination(),
            clack: new Tone.PolySynth(Tone.MembraneSynth, { 
                volume: -25,
                envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 }
            }).toDestination(),
            success: new Tone.PolySynth({ volume: -20 }).toDestination(),
            error: new Tone.MembraneSynth({ volume: -15 }).toDestination(),
            creak: new Tone.Synth({
                oscillator: { type: "sawtooth" },
                envelope: { attack: 0.5, decay: 0.5, sustain: 0.5, release: 1.0 },
                volume: -15
            }).toDestination(),
            glassBreak: new Tone.NoiseSynth({
                noise: { type: 'white' },
                envelope: { attack: 0.005, decay: 0.2, sustain: 0 }
            }).toDestination(),
            scream: new Tone.NoiseSynth({
                noise: { type: 'white' },
                envelope: { attack: 0.005, decay: 0.5, sustain: 0.2, release: 1.0 }
            }).connect(new Tone.Filter(3000, "highpass").toDestination())
        };
        this.poolAudio.scream.volume.value = -10;
        
        // High pitched stingers for the scream
        this.screamStinger = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "sawtooth" },
            envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.5 }
        }).toDestination();
        this.screamStinger.volume.value = -15;
        
        // Audio Pool for World Interactions
        this.worldAudio = {
            water: new Tone.NoiseSynth({
                noise: { type: 'pink' },
                envelope: { attack: 0.1, decay: 0.2, sustain: 1, release: 0.2 }
            }).connect(new Tone.Filter(800, "lowpass").toDestination()),
            clack: this.poolAudio.clack // Reuse for taps
        };
        this.worldAudio.water.volume.value = -20;
        this.activeWaterSources = 0;
        
        this.winSequenceActive = false;
        this.portraitObject = null;
        this.portraitTriggered = false;
        this.winTimer = 0;
        this.carDriveSpeed = 0;
        this.carObject = null;
        this.carWheels = [];
        this.rat = new Rat(this.root, this.poolAudio);
        
        this.materials = {
            wall: new THREE.MeshStandardMaterial({ 
                map: this.textureLoader.load(ASSETS.WALL_TEXTURE),
                roughness: 0.8,
                metalness: 0.1,
                color: 0x666666
            }),
            floor: new THREE.MeshStandardMaterial({ 
                map: this.textureLoader.load(ASSETS.FLOOR_TEXTURE),
                roughness: 0.9,
                metalness: 0.05,
                color: 0x666666
            }),
            houseWall: new THREE.MeshStandardMaterial({ 
                map: this.textureLoader.load(ASSETS.HOUSE_WALL_TEXTURE),
                roughness: 0.9,
                metalness: 0.05,
                color: 0x666666
            }),
            houseFloor: new THREE.MeshStandardMaterial({ 
                map: this.textureLoader.load(ASSETS.HOUSE_FLOOR_TEXTURE),
                roughness: 0.9,
                metalness: 0.1,
                color: 0x555555
            }),
            ceiling: new THREE.MeshStandardMaterial({ color: 0x1a1a1a }),
            wood: new THREE.MeshStandardMaterial({ 
                map: this.textureLoader.load(ASSETS.DOOR_TEXTURE),
                roughness: 0.9,
                color: 0x555555 // Tint to keep it dark
            }),
            metal: new THREE.MeshStandardMaterial({ 
                map: this.textureLoader.load(ASSETS.METAL_TEXTURE),
                roughness: 0.7, 
                metalness: 0.5,
                color: 0x666666
            }),
            porcelain: new THREE.MeshStandardMaterial({ 
                map: this.textureLoader.load(ASSETS.PORCELAIN_TEXTURE),
                roughness: 0.1,
                metalness: 0.2,
                color: 0xf8f8f8,
                side: THREE.DoubleSide
            }),
            web: new THREE.MeshStandardMaterial({ 
                map: this.textureLoader.load(ASSETS.SPIDERWEB),
                transparent: true,
                opacity: 0.8,
                side: THREE.DoubleSide
            }),
            grass: new THREE.MeshStandardMaterial({
                map: this.textureLoader.load(ASSETS.GRASS_TEXTURE),
                roughness: 1.0,
                metalness: 0.0
            }),
            sky: new THREE.MeshBasicMaterial({
                map: this.textureLoader.load(ASSETS.SKY_TEXTURE),
                side: THREE.BackSide
            }),
            glass: new THREE.MeshStandardMaterial({
                color: 0x88ccff,
                transparent: true,
                opacity: 0.2,
                roughness: 0.0,
                metalness: 0.9
            }),
            bark: new THREE.MeshStandardMaterial({ 
                map: this.textureLoader.load(ASSETS.BARK_TEXTURE),
                roughness: 1.0, 
                color: 0x888888 
            }),
            concrete: new THREE.MeshStandardMaterial({
                 map: this.textureLoader.load(ASSETS.CONCRETE_TEXTURE),
                 roughness: 0.9,
                 metalness: 0.1
            }),
            bedroomWall: new THREE.MeshStandardMaterial({
                map: this.textureLoader.load(ASSETS.BEDROOM_WALL_TEXTURE),
                roughness: 0.9,
                metalness: 0.05
            }),
            basementWall: new THREE.MeshStandardMaterial({
                map: this.textureLoader.load(ASSETS.BASEMENT_WALL),
                roughness: 0.9,
                metalness: 0.2,
                color: 0x888888 // Darken it a bit
            }),
            waterStain: new THREE.MeshStandardMaterial({
                map: this.textureLoader.load(ASSETS.WATER_STAIN),
                transparent: true,
                opacity: 0.6,
                roughness: 0.2,
                metalness: 0.1,
                side: THREE.DoubleSide
            }),
            screen: new THREE.MeshStandardMaterial({
                map: this.textureLoader.load(ASSETS.LAPTOP_SCREEN),
                emissive: 0x8888ff,
                emissiveIntensity: 0.5,
                roughness: 0.2,
                metalness: 0.8
            }),
            blackPlastic: new THREE.MeshStandardMaterial({
                color: 0x111111,
                roughness: 0.6,
                metalness: 0.1
            }),
            carPaint: new THREE.MeshStandardMaterial({
                color: 0x1a1a1a,
                roughness: 0.1,
                metalness: 0.9,
            }),
            tireSidewall: new THREE.MeshStandardMaterial({
                map: this.textureLoader.load(ASSETS.TIRE_SIDEWALL_TEXTURE),
                color: 0x111111,
                roughness: 0.9
            }),
            carRim: new THREE.MeshStandardMaterial({
                map: this.textureLoader.load(ASSETS.RIM_TEXTURE),
                roughness: 0.2,
                metalness: 0.8
            }),
            headlightLens: new THREE.MeshStandardMaterial({
                map: this.textureLoader.load(ASSETS.HEADLIGHT_TEXTURE),
                emissive: 0xffffff,
                emissiveIntensity: 0.5,
                transparent: true,
                opacity: 0.9
            }),
            taillightLens: new THREE.MeshStandardMaterial({
                map: this.textureLoader.load(ASSETS.TAILLIGHT_TEXTURE),
                emissive: 0xaa0000,
                emissiveIntensity: 0.5,
                transparent: true,
                opacity: 0.9
            }),
            dashboard: new THREE.MeshStandardMaterial({
                map: this.textureLoader.load(ASSETS.DASHBOARD_TEXTURE),
                emissive: 0x00ffff,
                emissiveIntensity: 0.2,
                roughness: 0.3
            }),
            steeringWheel: new THREE.MeshStandardMaterial({
                map: this.textureLoader.load(ASSETS.STEERING_WHEEL_TEXTURE),
                roughness: 0.5,
                metalness: 0.2
            }),
            familyPortrait: new THREE.MeshStandardMaterial({
                map: this.textureLoader.load(ASSETS.FAMILY_PORTRAIT),
                roughness: 0.8,
                metalness: 0.0
            }),
            granite: new THREE.MeshStandardMaterial({
                map: this.textureLoader.load(ASSETS.GRANITE_TEXTURE),
                roughness: 0.2,
                metalness: 0.3,
                color: 0x888888
            })
        };

        // Texture repeats
        [
            this.materials.wall.map, 
            this.materials.floor.map, 
            this.materials.houseWall.map, 
            this.materials.houseFloor.map, 
            this.materials.metal.map,
            this.materials.concrete.map,
            this.materials.bark.map,
            this.materials.bedroomWall.map,
            this.materials.granite.map
        ].forEach(map => {
            if (map) {
                map.wrapS = map.wrapT = THREE.RepeatWrapping;
                map.repeat.set(2, 2);
            }
        });
        
        if (this.materials.grass.map) {
             this.materials.grass.map.wrapS = this.materials.grass.map.wrapT = THREE.RepeatWrapping;
             this.materials.grass.map.repeat.set(10, 10);
        }
        
        // Adjust repeat for house materials for larger areas
        this.materials.houseWall.map.repeat.set(3, 2);
        this.materials.houseFloor.map.repeat.set(3, 6); // Long hallway needs more repeats on Z?
        // Wait, repeat is UV based. BoxGeometry UVs map 0..1 per face by default? 
        // No, BoxGeometry usually stretches texture over the whole face.
        // If I want flawless blending, I might need to adjust UVs or use a higher repeat count.
        // Let's stick to simple repeats for now. Hallway is 10 long. Bathroom is 5.
        // So hallway needs double the repeat of bathroom on the long axis.

        
        // Porcelain shouldn't repeat as much to avoid patterns on small props
        this.materials.porcelain.map.wrapS = this.materials.porcelain.map.wrapT = THREE.RepeatWrapping;
        this.materials.porcelain.map.repeat.set(1, 1);
    }

    destroy() {
        this.scene.remove(this.root);
        if (this.lights) {
            this.lights.forEach(l => this.scene.remove(l));
            this.lights = [];
        }
        // Clear references
        this.interactiveObjects = [];
        this.colliders = [];
        this.floors = [];
        this.activeAnimations = [];
        this.doorObject = null;
        this.keyItem = null;
    }

    async build(onProgress) {
        if (this.isBuilding) {
            console.warn("World build already in progress, skipping.");
            return;
        }
        this.isBuilding = true;

        const log = (msg) => {
            console.log(`[World] ${msg}`);
            // If the game instance has a log method, use it
            if (window.game && window.game.log) window.game.log(`[World] ${msg}`);
        };

        try {
            // Clear previous if any
            this.root.clear();
            
            // Ensure the rat is in the scene (since root was cleared)
            if (this.rat) {
                this.rat.reset();
                this.root.add(this.rat.group);
            }

            this.interactiveObjects = [];
            this.colliders = [];
            this.floors = [];
            this.activeAnimations = [];

            const report = async (status, progress) => {
                if (onProgress) onProgress(status, progress);
                // Yield to browser using setTimeout to avoid hangs if tab is not active/visible
                await new Promise(resolve => setTimeout(resolve, 32));
            };

            // Reset Sequence Flags
            this.winSequenceActive = false;
            this.portraitTriggered = false;
            this.scareTriggered = false;
            this.winTimer = 0;
            this.carDriveSpeed = 0;
            this.bedroomDoorRevealed = false;
            this.activeWaterSources = 0;
            this.isFanOn = true;

            if (!this.texturesLoaded) {
                log('Waiting for textures...');
                await report('Streaming Textures...', 5);
                // Wait for textures with a timeout to prevent hanging
                await new Promise(resolve => {
                    const timeout = setTimeout(() => {
                        log("Texture loading timed out, proceeding anyway...");
                        resolve();
                    }, 5000); 

                    this.onLoadProgress = (percent) => {
                        report(`Streaming Textures (${Math.round(percent)}%)...`, 5 + (percent * 0.1));
                    };

                    const originalOnLoad = this.loadingManager.onLoad;
                    this.loadingManager.onLoad = () => {
                        log("Texture loading manager: All loaded");
                        if (originalOnLoad) originalOnLoad();
                        clearTimeout(timeout);
                        setTimeout(resolve, 100); 
                    };

                    const originalOnError = this.loadingManager.onError;
                    this.loadingManager.onError = (url) => {
                        log(`Texture Error: ${url}`);
                        if (originalOnError) originalOnError(url);
                    };

                    if (this.texturesLoaded) {
                        log("Textures already flagged as loaded");
                        clearTimeout(timeout);
                        resolve();
                    }
                });
            } else {
                log("Textures already loaded, skipping wait");
            }

            log("Building geometry...");
            await report('Constructing Bathroom...', 10);
            this.createRoom(0, 0, 0, 5, 3.5, 5, 'bathroom');
            
            await report('Constructing Hallway...', 20);
            this.createRoom(0, 0, -7.5, 3, 3.5, 10, 'hallway', ['front', 'back', 'left']);
            
            await report('Constructing Living Room...', 30);
            this.createRoom(0, 0, -18.5, 10, 4, 12, 'living', ['front', 'right', 'back', 'left']);
            this.createDoorwayWall(10, 4, 0.2, 0, 0, -12.5, 0);
            this.createFrontWallWithWindow(10, 4, 0.2, 0, 0, -24.5, 0);
            this.createLivingRoomLeftWall(-5, 4, 0.2, -18.5);
            this.createArchwayWall(12, 4, 0.2, 5, 0, -18.5, Math.PI / 2);

            await report('Constructing Kitchen & Bedroom...', 40);
            this.createRoom(9, 0, -18.5, 8, 4, 10, 'kitchen', ['left']);
            this.createRoom(-4.0, 0, -7.5, 5, 3.5, 6, 'bedroom', ['right', 'left']);
            this.createBedroomWindowWall(-6.5, 3.5, 0.2, -7.5);

            await report('Adding Furniture...', 50);
            this.addBathroomFurniture();
            this.addHallwayFurniture();
            this.addLivingRoomFurniture();
            this.addKitchenFurniture();
            this.addBedroomFurniture();
            this.createNewspaper(8.5, 0.77, -14.5); 
            this.createBeadCurtain(); 
            this.createFamilyPortraitTrigger();

            await report('Excavating Basement...', 70);
            this.createBasement(); 

            await report('Lighting and Atmosphere...', 80);
            this.setupLights(); 
            this.buildOutdoorScenery();
            this.addDustMotes(); 
            this.addInteractiveElements();
            this.addNotes(); 
            
            await report('Finalizing World...', 90);
            this.bedroomDoorRevealed = false;
            this.updateHallwayWall();
            this.createWorldBoundaries();

            log("World built successfully");
            await report('Ready', 100);
        } catch (err) {
            log(`BUILD ERROR: ${err.message}`);
            throw err;
        } finally {
            this.isBuilding = false;
        }
    }

    addDustMotes() {
        const createDust = (x, y, z, w, h, d, count) => {
            const system = new DustMotes(new THREE.Vector3(w, h, d), count);
            system.group.position.set(x, y, z);
            this.root.add(system.group);
            this.dustSystems.push(system);
        };

        // Bathroom
        createDust(0, 1.75, 0, 5, 3.5, 5, 150);
        // Hallway
        createDust(0, 1.75, -7.5, 3, 3.5, 10, 100);
        // Living Room
        createDust(0, 2, -18.5, 10, 4, 12, 100);
        // Basement
        createDust(-15, -1.5, -18.5, 10, 4, 12, 200);
    }

    addNotes() {
        const createNote = (id, name, content, x, y, z, rotationY = 0) => {
            const note = new InteractiveObject(id, name, 'Read Note', (state) => {
                state.readNote(content);
                return null;
            });
            
            // Paper Mesh
            const paperGeo = new THREE.PlaneGeometry(0.21, 0.297); // A4 ratio
            const paperMat = new THREE.MeshStandardMaterial({ 
                color: 0xf4f1ea, 
                side: THREE.DoubleSide,
                roughness: 1.0 
            });
            const mesh = new THREE.Mesh(paperGeo, paperMat);
            mesh.rotation.x = -Math.PI / 2;
            note.add(mesh);
            
            note.position.set(x, y, z);
            note.rotation.y = rotationY;
            this.root.add(note);
            this.interactiveObjects.push(note);
        };

        // Note 1: Kitchen Island
        createNote(
            'kitchen_note', 
            'Scrawled Note', 
            "Sarah, \n\nI've hidden the house key in the base cabinet right under the sink. Use it to get out. I'm taking the car to the shop. If I'm not back, just... keep running. \n\n- Arthur",
            9.5, 0.96, -18.2,
            0.5
        );

        // Note 2: Bedroom Desk
        createNote(
            'bedroom_note',
            'Journal Entry',
            "Day 42. The lights in the bathroom are flickering again. I can't shake the feeling that the hallway is getting longer. \n\nI've locked the basement. I don't want to hear those sounds anymore.",
            -5.8, 0.77, -9.6,
            -0.2
        );
    }

    createWorldBoundaries() {
        const bounds = {
            minX: -25, maxX: 25,
            minZ: -50, maxZ: 10
        };
        const height = 10;
        const mat = new THREE.MeshBasicMaterial({ visible: false }); // Invisible

        // North Wall (Max Z)
        const nWall = new THREE.Mesh(new THREE.BoxGeometry(bounds.maxX - bounds.minX, height, 1), mat);
        nWall.position.set((bounds.minX + bounds.maxX)/2, height/2, bounds.maxZ);
        this.root.add(nWall);
        this.colliders.push(nWall);

        // South Wall (Min Z - Behind Car)
        const sWall = new THREE.Mesh(new THREE.BoxGeometry(bounds.maxX - bounds.minX, height, 1), mat);
        sWall.position.set((bounds.minX + bounds.maxX)/2, height/2, bounds.minZ);
        this.root.add(sWall);
        this.colliders.push(sWall);

        // East Wall (Max X)
        const eWall = new THREE.Mesh(new THREE.BoxGeometry(1, height, bounds.maxZ - bounds.minZ), mat);
        eWall.position.set(bounds.maxX, height/2, (bounds.minZ + bounds.maxZ)/2);
        this.root.add(eWall);
        this.colliders.push(eWall);

        // West Wall (Min X)
        const wWall = new THREE.Mesh(new THREE.BoxGeometry(1, height, bounds.maxZ - bounds.minZ), mat);
        wWall.position.set(bounds.minX, height/2, (bounds.minZ + bounds.maxZ)/2);
        this.root.add(wWall);
        this.colliders.push(wWall);

        // --- Driveway Constraints ---
        // Restrict player to the 3m wide concrete path when outside (Z < -24.5)
        // House front wall is at z = -24.5
        
        const dwLength = Math.abs(-24.5 - bounds.minZ);
        const dwCenterZ = (-24.5 + bounds.minZ) / 2;
        
        // Left Driveway Barrier (x = -1.5)
        // Box is 1m thick, positioned at x = -2.0 so edge is at -1.5
        const dwLeft = new THREE.Mesh(new THREE.BoxGeometry(1, height, dwLength), mat);
        dwLeft.position.set(-2.0, height/2, dwCenterZ);
        this.root.add(dwLeft);
        this.colliders.push(dwLeft);

        // Right Driveway Barrier (x = 1.5)
        // Box is 1m thick, positioned at x = 2.0 so edge is at 1.5
        const dwRight = new THREE.Mesh(new THREE.BoxGeometry(1, height, dwLength), mat);
        dwRight.position.set(2.0, height/2, dwCenterZ);
        this.root.add(dwRight);
        this.colliders.push(dwRight);
    }

    buildOutdoorScenery() {
        // Ground with Hole for Basement Only
        // We allow grass to go under the main house (since house floor is at y=0 and opaque)
        // preventing the "moat" effect. We only cut out the basement and stairs.
        
        const groundSize = 100;
        const groundShape = new THREE.Shape();
        // Outer square (centered)
        groundShape.moveTo(-groundSize/2, -groundSize/2);
        groundShape.lineTo(groundSize/2, -groundSize/2);
        groundShape.lineTo(groundSize/2, groundSize/2);
        groundShape.lineTo(-groundSize/2, groundSize/2);
        groundShape.lineTo(-groundSize/2, -groundSize/2);

        // Hole for Basement + Stairs
        // World Z to Shape Y transform: Y = -30 - WorldZ
        // Room: X[-20.5, -9.5], Z[-24.5, -12.5] -> ShapeY[-17.5, -5.5]
        // Stairs: X[-9.5, -4.5], Z[-19.1, -17.9] -> ShapeY[-12.1, -10.9]
        // We use slightly wider margins for the hole to ensure no clipping
        
        const holePath = new THREE.Path();
        
        // Coordinates (Shape X, Shape Y)
        // Stair Part Right-Top (Front-ish)
        holePath.moveTo(-4.5, -10.5); 
        // Stair Part Right-Bottom
        holePath.lineTo(-4.5, -12.5);
        // Jog to Room Wall
        holePath.lineTo(-9.5, -12.5);
        // Room Bottom-Right
        holePath.lineTo(-9.5, -18.0);
        // Room Bottom-Left
        holePath.lineTo(-20.5, -18.0);
        // Room Top-Left
        holePath.lineTo(-20.5, -5.0);
        // Room Top-Right
        holePath.lineTo(-9.5, -5.0);
        // Jog back to Stair
        holePath.lineTo(-9.5, -10.5);
        // Close
        holePath.lineTo(-4.5, -10.5);
        
        groundShape.holes.push(holePath);
        
        const groundGeo = new THREE.ShapeGeometry(groundShape);
        
        // Fix UVs for tiling
        const posAttribute = groundGeo.attributes.position;
        const uvAttribute = groundGeo.attributes.uv;
        
        // Adjust scale to match previous tiling (10 repeats over 100 units = 0.1)
        for ( let i = 0; i < posAttribute.count; i ++ ) {
            const x = posAttribute.getX( i );
            const y = posAttribute.getY( i ); // Shape Y is World Z
            uvAttribute.setXY( i, x * 0.1, y * 0.1 );
        }
        
        const ground = new THREE.Mesh(groundGeo, this.materials.grass);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(0, -0.1, -30); // Lowered significantly to avoid raycast jitter with driveway
        this.root.add(ground);
        // Removed ground from this.floors to prevent jitter. Player is restricted to driveway by boundaries.

        // Driveway / Path
        // Length 25.5 so it starts at the house threshold (z = -24.5) and extends to the boundary (z = -50)
        // Center z: -24.5 - (25.5/2) = -37.25
        const path = new THREE.Mesh(
            new THREE.PlaneGeometry(3, 25.5),
            this.materials.concrete
        );
        path.rotation.x = -Math.PI / 2;
        path.position.set(0, 0, -37.25); 
        this.root.add(path);
        this.floors.push(path);

        // --- Upgraded Street Lamp ---
        const lampGroup = new THREE.Group();
        lampGroup.position.set(2.5, 0, -32); // Near driveway start

        // Concrete Base
        const base = new THREE.Mesh(
            new THREE.CylinderGeometry(0.25, 0.35, 0.4, 8),
            this.materials.concrete
        );
        base.position.y = 0.2;
        lampGroup.add(base);

        // Main Pole (Thinner, taller)
        const pole = new THREE.Mesh(
            new THREE.CylinderGeometry(0.1, 0.15, 4.0, 8),
            this.materials.metal
        );
        pole.position.y = 2.2;
        lampGroup.add(pole);

        // Decorative joint
        const joint = new THREE.Mesh(
            new THREE.SphereGeometry(0.15, 8, 8),
            this.materials.metal
        );
        joint.position.y = 4.0;
        lampGroup.add(joint);

        // Horizontal Arm (Curved look via rotation)
        const arm = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.1, 1.5, 8),
            this.materials.metal
        );
        arm.rotation.z = Math.PI / 2;
        arm.position.set(-0.6, 4.0, 0); 
        lampGroup.add(arm);

        // Lamp Head Housing (Cobra head style)
        const lampHead = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.2, 0.3),
            this.materials.metal
        );
        lampHead.position.set(-1.4, 4.0, 0); 
        lampGroup.add(lampHead);

        // Emissive Bulb area
        const bulb = new THREE.Mesh(
            new THREE.BoxGeometry(0.4, 0.05, 0.2),
            new THREE.MeshStandardMaterial({ 
                color: 0xffffaa, 
                emissive: 0xffffaa, 
                emissiveIntensity: 2.0 
            })
        );
        bulb.position.set(-1.4, 3.9, 0);
        lampGroup.add(bulb);

        // Actual Light (Spotlight)
        const lampLight = new THREE.SpotLight(0xffffaa, 1.5, 30, Math.PI / 3, 0.5, 1);
        lampLight.position.set(-1.4, 3.8, 0);
        lampLight.target.position.set(-1.4, 0, 0); 
        lampLight.castShadow = true;
        
        lampGroup.add(lampLight);
        lampGroup.add(lampLight.target);

        this.root.add(lampGroup);

        // --- Car at the end of driveway ---
        this.createCar(0, 0, -42, Math.PI); 

        // --- Trees ---
        // Big Tree NEXT TO the driveway (moved from center)
        this.createTree(5, -35, 1.5); 

        // Random Forest surrounding
        for (let i = 0; i < 30; i++) {
            // Keep clear of driveway path (x range -3 to 3)
            let tx = (Math.random() - 0.5) * 60;
            while (Math.abs(tx) < 4.0) {
                 tx = (Math.random() - 0.5) * 60;
            }

            const tz = -26 - Math.random() * 40; // Behind house
            
            // Varied scales
            const scale = 0.8 + Math.random() * 0.8;
            this.createTree(tx, tz, scale);
        }

        // Sky Sphere
        const skyGeo = new THREE.SphereGeometry(80, 32, 32);
        const sky = new THREE.Mesh(skyGeo, this.materials.sky);
        sky.position.set(0, 0, -30);
        this.root.add(sky);
    }

    createTree(x, z, scale = 1.0) {
        const treeGroup = new THREE.Group();
        treeGroup.position.set(x, 0, z);
        treeGroup.scale.setScalar(scale);
        treeGroup.rotation.y = Math.random() * Math.PI * 2; 

        const mat = this.materials.bark;
        const height = 5 + Math.random() * 2;

        // 1. Main Trunk - Tapered and slightly irregular
        // We compose it of 2 segments to allow a slight bend
        const trunkR = 0.4;
        const trunkH1 = height * 0.4;
        const trunkH2 = height * 0.6;
        
        const trunk1 = new THREE.Mesh(
            new THREE.CylinderGeometry(trunkR * 0.8, trunkR, trunkH1, 7),
            mat
        );
        trunk1.position.y = trunkH1 / 2;
        // Slight lean
        trunk1.rotation.z = (Math.random() - 0.5) * 0.1;
        trunk1.rotation.x = (Math.random() - 0.5) * 0.1;
        treeGroup.add(trunk1);

        const trunk2 = new THREE.Mesh(
            new THREE.CylinderGeometry(trunkR * 0.5, trunkR * 0.8, trunkH2, 7),
            mat
        );
        // Position at top of trunk1 (approximate accounting for rotation)
        trunk2.position.set(trunk1.position.x, trunkH1, trunk1.position.z);
        // Offset rotation
        trunk2.rotation.z = (Math.random() - 0.5) * 0.2;
        trunk2.rotation.x = (Math.random() - 0.5) * 0.2;
        // Move up half its height relative to join
        trunk2.translateY(trunkH2 / 2);
        
        // We add trunk2 to trunk1 to inherit transform? No, simpler to just place in group for this simple structure
        // Actually, attaching to trunk1 makes the joint stick better.
        trunk1.add(trunk2);
        // Reset local pos since it's now child
        trunk2.position.set(0, trunkH1/2, 0); 
        trunk2.rotation.set((Math.random() - 0.5) * 0.2, 0, (Math.random() - 0.5) * 0.2);
        trunk2.translateY(trunkH2 / 2);


        // 2. Branches
        // Function to add a branch cluster
        const addBranch = (parent, parentHeight, radius, length) => {
            const pivot = new THREE.Group();
            pivot.position.y = (Math.random() - 0.5) * (parentHeight * 0.4); // Spread along parent
            pivot.rotation.y = Math.random() * Math.PI * 2; // Azimuth
            pivot.rotation.z = Math.PI / 4 + Math.random() * 0.5; // Angle up (45-70 deg)
            
            const branch = new THREE.Mesh(
                new THREE.CylinderGeometry(radius * 0.5, radius, length, 5),
                mat
            );
            branch.position.y = length / 2;
            branch.castShadow = true;
            pivot.add(branch);
            parent.add(pivot);
            
            // Sub-twigs
            if (length > 1.5) {
                const numTwigs = 1 + Math.floor(Math.random() * 2);
                for(let k=0; k<numTwigs; k++) {
                    const tLen = length * (0.3 + Math.random() * 0.3);
                    const tRad = radius * 0.5;
                    const tPiv = new THREE.Group();
                    tPiv.position.y = length * (0.3 + Math.random() * 0.6);
                    tPiv.rotation.y = Math.random() * Math.PI * 2;
                    tPiv.rotation.z = Math.PI / 3; 
                    
                    const twig = new THREE.Mesh(
                        new THREE.CylinderGeometry(tRad * 0.5, tRad, tLen, 4),
                        mat
                    );
                    twig.position.y = tLen / 2;
                    tPiv.add(twig);
                    branch.add(tPiv);
                }
            }
        };

        // Add branches to Upper Trunk (trunk2)
        const numMain = 3 + Math.floor(Math.random() * 3);
        for(let i=0; i<numMain; i++) {
            addBranch(trunk2, trunkH2, 0.15, 2 + Math.random() * 2);
        }
        
        // Add a lower dead branch to Lower Trunk (trunk1)
        if (Math.random() > 0.3) {
            addBranch(trunk1, trunkH1, 0.2, 1.5 + Math.random());
        }

        this.root.add(treeGroup);
        
        // Colliders
        if (scale > 1.0) {
            const col = new THREE.Mesh(new THREE.BoxGeometry(1.2, 5, 1.2), new THREE.MeshBasicMaterial({visible:false}));
            col.position.set(x, 2.5, z);
            this.root.add(col);
            this.colliders.push(col);
        }
    }

    createCar(x, y, z, rotationY) {
        const carGroup = new THREE.Group();
        carGroup.position.set(x, y, z);
        carGroup.rotation.y = rotationY;

        const paintMat = this.materials.carPaint;
        const chromeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1.0, roughness: 0.1 });
        const glassMat = this.materials.glass;
        const interiorMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1.0 });

        // 1. Lower Body (Chassis + Fenders)
        const bodyMain = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 4.2), paintMat);
        bodyMain.position.y = 0.55;
        carGroup.add(bodyMain);
        this.colliders.push(bodyMain);

        // Front Hood (slight taper)
        const hood = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.15, 1.4), paintMat);
        hood.position.set(0, 0.85, -1.35);
        hood.rotation.x = -0.05;
        carGroup.add(hood);

        // Rear Trunk
        const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.15, 1.0), paintMat);
        trunk.position.set(0, 0.85, 1.55);
        carGroup.add(trunk);

        // 2. Cabin
        const cabinWidth = 1.6;
        const cabinHeight = 0.65;
        const cabinDepth = 2.0;
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(cabinWidth, cabinHeight, cabinDepth), paintMat);
        cabin.position.set(0, 1.15, 0.1);
        carGroup.add(cabin);

        // Windows (Decals/Planes for hyper-real look)
        const windowGeo = new THREE.BoxGeometry(cabinWidth + 0.02, cabinHeight - 0.1, cabinDepth - 0.2);
        const windows = new THREE.Mesh(windowGeo, glassMat);
        windows.position.copy(cabin.position);
        carGroup.add(windows);

        // Windshield (Angular)
        const windshield = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.8), glassMat);
        windshield.position.set(0, 1.15, -0.95);
        windshield.rotation.x = -Math.PI / 4;
        carGroup.add(windshield);

        // 3. Details
        // Side Mirrors
        const mirrorGeo = new THREE.BoxGeometry(0.2, 0.1, 0.1);
        const mirrorL = new THREE.Mesh(mirrorGeo, paintMat);
        mirrorL.position.set(-0.95, 1.1, -0.8);
        carGroup.add(mirrorL);
        const mirrorR = new THREE.Mesh(mirrorGeo, paintMat);
        mirrorR.position.set(0.95, 1.1, -0.8);
        carGroup.add(mirrorR);

        // Door Handles (Chrome)
        const handleGeo = new THREE.BoxGeometry(0.02, 0.03, 0.15);
        for(let i of [-1, 1]) {
            for(let j of [-0.5, 0.6]) {
                const handle = new THREE.Mesh(handleGeo, chromeMat);
                handle.position.set(0.91 * i, 0.75, j);
                carGroup.add(handle);
            }
        }

        // Bumpers (Chrome/Plastic)
        const bumperGeo = new THREE.BoxGeometry(1.9, 0.15, 0.2);
        const fBumper = new THREE.Mesh(bumperGeo, chromeMat);
        fBumper.position.set(0, 0.45, -2.15);
        carGroup.add(fBumper);
        const rBumper = new THREE.Mesh(bumperGeo, chromeMat);
        rBumper.position.set(0, 0.45, 2.15);
        carGroup.add(rBumper);

        // 4. Wheels (High Detail)
        this.carWheels = [];
        const wheelGroup = new THREE.Group();
        const tireGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 32);
        tireGeo.rotateZ(Math.PI / 2);
        
        const rimGeo = new THREE.CircleGeometry(0.25, 32);
        // Face the rims outward
        
        const wheelPositions = [
            [-0.85, 0.35, 1.35], [0.85, 0.35, 1.35], // Rear
            [-0.85, 0.35, -1.35], [0.85, 0.35, -1.35] // Front
        ];

        wheelPositions.forEach((pos, idx) => {
            const wheel = new THREE.Group();
            wheel.position.set(...pos);
            
            // Tire
            const tire = new THREE.Mesh(tireGeo, this.materials.blackPlastic);
            wheel.add(tire);
            
            // Rim Texture
            const rim = new THREE.Mesh(rimGeo, this.materials.carRim);
            rim.position.x = (pos[0] > 0) ? 0.126 : -0.126;
            rim.rotation.y = (pos[0] > 0) ? Math.PI / 2 : -Math.PI / 2;
            wheel.add(rim);

            // Sidewall Texture
            const sidewall = new THREE.Mesh(rimGeo, this.materials.tireSidewall);
            sidewall.position.x = (pos[0] > 0) ? 0.127 : -0.127; // Slightly in front of rim
            sidewall.rotation.y = (pos[0] > 0) ? Math.PI / 2 : -Math.PI / 2;
            sidewall.scale.setScalar(1.35);
            wheel.add(sidewall);

            carGroup.add(wheel);
            this.carWheels.push(wheel);
        });

        // 5. Lights (Textured)
        const lightBoxGeo = new THREE.PlaneGeometry(0.4, 0.2);
        
        // Headlights
        const headL = new THREE.Mesh(lightBoxGeo, this.materials.headlightLens);
        headL.position.set(-0.6, 0.7, -2.11);
        headL.rotation.y = Math.PI;
        carGroup.add(headL);
        const headR = new THREE.Mesh(lightBoxGeo, this.materials.headlightLens);
        headR.position.set(0.6, 0.7, -2.11);
        headR.rotation.y = Math.PI;
        carGroup.add(headR);

        // Taillights
        const tailL = new THREE.Mesh(lightBoxGeo, this.materials.taillightLens);
        tailL.position.set(-0.6, 0.7, 2.11);
        carGroup.add(tailL);
        const tailR = new THREE.Mesh(lightBoxGeo, this.materials.taillightLens);
        tailR.position.set(0.6, 0.7, 2.11);
        carGroup.add(tailR);

        // Add actual spot lights
        const leftSpot = new THREE.SpotLight(0xffffff, 3.0, 30, Math.PI/4, 0.3, 1);
        leftSpot.position.set(-0.6, 0.7, -2.0);
        leftSpot.target.position.set(-0.6, 0.0, -10);
        carGroup.add(leftSpot);
        carGroup.add(leftSpot.target);

        const rightSpot = new THREE.SpotLight(0xffffff, 3.0, 30, Math.PI/4, 0.3, 1);
        rightSpot.position.set(0.6, 0.7, -2.0);
        rightSpot.target.position.set(0.6, 0.0, -10);
        carGroup.add(rightSpot);
        carGroup.add(rightSpot.target);

        // License Plate
        const plateGeo = new THREE.PlaneGeometry(0.4, 0.2);
        const plateMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
        const fPlate = new THREE.Mesh(plateGeo, plateMat);
        fPlate.position.set(0, 0.45, -2.26);
        fPlate.rotation.y = Math.PI;
        carGroup.add(fPlate);
        const rPlate = new THREE.Mesh(plateGeo, plateMat);
        rPlate.position.set(0, 0.45, 2.26);
        carGroup.add(rPlate);

        // 6. Interior
        const interiorGroup = new THREE.Group();
        interiorGroup.position.set(0, 0.7, 0.1); // Inside cabin area
        carGroup.add(interiorGroup);

        // Dashboard
        const dashGeo = new THREE.BoxGeometry(1.5, 0.4, 0.5);
        const dash = new THREE.Mesh(dashGeo, interiorMat);
        dash.position.set(0, 0.35, -0.8);
        dash.rotation.x = -0.2;
        interiorGroup.add(dash);

        // Instrument Cluster (Gauges)
        const clusterGeo = new THREE.PlaneGeometry(0.6, 0.25);
        const cluster = new THREE.Mesh(clusterGeo, this.materials.dashboard);
        cluster.position.set(-0.35, 0.45, -0.56);
        cluster.rotation.x = -0.3;
        interiorGroup.add(cluster);

        // Steering Column
        const column = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8), interiorMat);
        column.position.set(-0.35, 0.3, -0.5);
        column.rotation.x = Math.PI / 3;
        interiorGroup.add(column);

        // Steering Wheel
        const wheelTor = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.02, 12, 32), interiorMat);
        wheelTor.position.set(-0.35, 0.45, -0.35);
        wheelTor.rotation.x = Math.PI / 3;
        interiorGroup.add(wheelTor);

        const wheelCenter = new THREE.Mesh(new THREE.CircleGeometry(0.08, 32), this.materials.steeringWheel);
        wheelCenter.position.set(-0.35, 0.455, -0.345);
        wheelCenter.rotation.x = -Math.PI / 6;
        interiorGroup.add(wheelCenter);

        // Ignition Slot
        const ignitionSlot = new InteractiveObject('ignition', 'Ignition Slot', 'Insert Keys', (state) => {
             if (state.equippedId === 'car_keys') {
                 state.win();
                 return null;
             } else if (state.inventory.has('car_keys')) {
                 state.speak("I have the keys, I just need to hold them.");
                 return null;
             } else {
                 state.speak("The car looks fine But I need the keys.");
                 return null;
             }
        });
        
        // Add a larger invisible hit-box for easier mobile interaction
        const ignitionProxy = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.3, 0.3),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        ignitionSlot.add(ignitionProxy);
        
        const slotMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 16), chromeMat);
        slotMesh.rotation.x = Math.PI / 2;
        ignitionSlot.add(slotMesh);
        ignitionSlot.position.set(-0.22, 0.3, -0.45);
        interiorGroup.add(ignitionSlot);
        this.interactiveObjects.push(ignitionSlot);

        // Seats (Front)
        const seatGeo = new THREE.BoxGeometry(0.6, 0.1, 0.6);
        const backGeo = new THREE.BoxGeometry(0.6, 0.8, 0.1);
        for(let i of [-1, 1]) {
            const seat = new THREE.Mesh(seatGeo, interiorMat);
            seat.position.set(0.4 * i, 0.1, -0.1);
            interiorGroup.add(seat);
            const back = new THREE.Mesh(backGeo, interiorMat);
            back.position.set(0.4 * i, 0.45, 0.2);
            back.rotation.x = -0.1;
            interiorGroup.add(back);
        }

        // 7. Interaction Wrapper (General car interaction if player misses slot)
        const interactionBox = new THREE.Mesh(
            new THREE.BoxGeometry(2.5, 2, 5),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        interactionBox.position.y = 1;
        
        const carInteractive = new InteractiveObject('car', 'Old Sedan', 'Use Keys', (state) => {
             if (state.equippedId === 'car_keys') {
                 state.win();
                 return null;
             } else if (state.inventory.has('car_keys')) {
                 state.speak("I should get in and hold the keys to start it.");
                 return null;
             }
             state.speak("The car looks fine But I need the keys.");
             return null;
        });
        carInteractive.add(interactionBox);
        carInteractive.add(carGroup);
        
        carInteractive.position.set(x, y, z);
        carInteractive.rotation.y = rotationY;
        
        carGroup.position.set(0,0,0);
        carGroup.rotation.set(0,0,0);

        this.carObject = carInteractive;
        this.root.add(carInteractive);
        this.interactiveObjects.push(carInteractive);
    }

    createFrontWallWithWindow(width, height, thickness, x, y, z, rotationY) {
        // Door in center (width 1.0)
        // Window to the right of the door
        const doorWidth = 1.0;
        const doorHeight = 2.2;
        const windowWidth = 1.5;
        const windowHeight = 1.2;
        const windowY = 1.5; // Center height of window
        
        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.rotation.y = rotationY;
        const mat = this.materials.houseWall;

        // Coordinates relative to wall center (0,0)
        // Wall spans x: -width/2 to width/2
        
        // Door is at x=0
        // Window let's place at x = 2.5
        
        // We need to construct this from pieces (CSG is hard, so we use panels)
        
        // 1. Bottom Panel (below window, and full sides)
        // Actually easier to do vertical strips.
        
        // Strip 1: Far Left to Door Left
        // x: -5 to -0.5 (Width 4.5)
        const leftStrip = new THREE.Mesh(new THREE.BoxGeometry(4.5, height, thickness), mat);
        leftStrip.position.set(-2.75, height/2, 0);
        group.add(leftStrip);
        this.colliders.push(leftStrip);

        // Strip 2: Door Top (Lintel)
        // x: -0.5 to 0.5 (Width 1.0). y: 2.2 to 4.
        const doorTop = new THREE.Mesh(new THREE.BoxGeometry(1.0, height - doorHeight, thickness), mat);
        doorTop.position.set(0, doorHeight + (height-doorHeight)/2, 0);
        group.add(doorTop);
        this.colliders.push(doorTop);
        
        // Strip 3: Between Door and Window
        // Door Right 0.5. Window Left (Center 2.5, Width 1.5 -> 1.75)
        // Gap: 0.5 to 1.75 (Width 1.25)
        const midStrip = new THREE.Mesh(new THREE.BoxGeometry(1.25, height, thickness), mat);
        midStrip.position.set(1.125, height/2, 0);
        group.add(midStrip);
        this.colliders.push(midStrip);

        // Strip 4: Window Area (Top and Bottom)
        // Window x range: 1.75 to 3.25
        // Bottom: 0 to (windowY - h/2) = 1.5 - 0.6 = 0.9
        const winBottom = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, thickness), mat);
        winBottom.position.set(2.5, 0.45, 0);
        group.add(winBottom);
        this.colliders.push(winBottom);

        // Top: (windowY + h/2) = 2.1 to 4. Height 1.9.
        const winTop = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.9, thickness), mat);
        winTop.position.set(2.5, 2.1 + 1.9/2, 0);
        group.add(winTop);
        this.colliders.push(winTop);
        
        // Strip 5: Far Right
        // x: 3.25 to 5 (Width 1.75)
        const rightStrip = new THREE.Mesh(new THREE.BoxGeometry(1.75, height, thickness), mat);
        rightStrip.position.set(4.125, height/2, 0);
        group.add(rightStrip);
        this.colliders.push(rightStrip);

        // Window Glass
        const glass = new THREE.Mesh(new THREE.BoxGeometry(windowWidth, windowHeight, 0.05), this.materials.glass);
        glass.position.set(2.5, windowY, 0);
        group.add(glass);
        // Glass doesn't need collider? Or maybe it does to block player.
        this.colliders.push(glass);
        
        // Window Frame (Simple cross)
        const frameV = new THREE.Mesh(new THREE.BoxGeometry(0.05, windowHeight, 0.06), this.materials.wood);
        frameV.position.set(2.5, windowY, 0);
        group.add(frameV);
        const frameH = new THREE.Mesh(new THREE.BoxGeometry(windowWidth, 0.05, 0.06), this.materials.wood);
        frameH.position.set(2.5, windowY, 0);
        group.add(frameH);

        this.root.add(group);
    }

    createCeilingFan(x, y, z) {
        this.isFanOn = true;
        
        const group = new THREE.Group();
        group.position.set(x, y, z);
        
        // Downrod
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8), this.materials.metal);
        rod.position.y = -0.2;
        group.add(rod);
        
        // Motor Housing
        const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.15, 16), this.materials.metal);
        motor.position.y = -0.45;
        group.add(motor);
        
        // Blades
        this.fanBlades = new THREE.Group();
        this.fanBlades.position.y = -0.45;
        
        const bladeGeo = new THREE.BoxGeometry(0.15, 0.02, 1.3);
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0x3d2817, roughness: 0.6 }); // Dark Wood
        
        for(let i=0; i<4; i++) {
            const blade = new THREE.Mesh(bladeGeo, bladeMat);
            const angle = (Math.PI / 2) * i;
            blade.position.set(Math.sin(angle)*0.8, 0, Math.cos(angle)*0.8);
            blade.rotation.y = angle;
            blade.rotation.x = 0.15; // Pitch
            this.fanBlades.add(blade);
            
            // Connector
            const conn = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.01, 0.25), this.materials.metal);
            conn.position.set(Math.sin(angle)*0.25, 0, Math.cos(angle)*0.25);
            conn.rotation.y = angle;
            this.fanBlades.add(conn);
        }
        
        group.add(this.fanBlades);
        
        this.root.add(group);
        this.fanObject = group;
    }

    createFanSwitch(x, y, z, rotationY) {
        const switchGroup = new InteractiveObject('fan_switch', 'Light Switch', 'Toggle Fan', (state) => {
            this.toggleFan();
            return null;
        });
        
        // Realistic Switch Design
        const group = new THREE.Group();

        // 1. Wall Plate (slightly beveled look via scaling/multiple boxes)
        const plateMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.3 });
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.02), plateMat);
        group.add(plate);

        // 2. Switch Housing (Inner part)
        const housing = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.01), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
        housing.position.z = 0.01;
        group.add(housing);

        // 3. Rocker Switch Nub
        this.switchNub = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, 0.08, 0.03),
            new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })
        );
        this.switchNub.position.z = 0.02;
        // Initial rotation for rocker look
        this.switchNub.rotation.x = this.isFanOn ? -0.3 : 0.3;
        group.add(this.switchNub);

        // 4. Invisible Proxy for easier interaction
        const proxy = new THREE.Mesh(
            new THREE.BoxGeometry(0.25, 0.25, 0.25),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        group.add(proxy);
        
        switchGroup.add(group);
        switchGroup.position.set(x, y, z);
        switchGroup.rotation.y = rotationY;
        
        this.root.add(switchGroup);
        this.interactiveObjects.push(switchGroup);
    }

    toggleFan() {
        this.isFanOn = !this.isFanOn;
        // Sound effect
        const click = new Tone.MembraneSynth({ volume: -30 }).toDestination();
        click.triggerAttackRelease(this.isFanOn ? "C5" : "G4", "32n");
        
        // Animate Switch - Rocker rotation
        if (this.switchNub) {
            this.switchNub.rotation.x = this.isFanOn ? -0.3 : 0.3;
        }
    }

    toggleWaterSound(opening) {
        if (opening) {
            if (this.activeWaterSources === 0) this.worldAudio.water.triggerAttack();
            this.activeWaterSources++;
        } else {
            this.activeWaterSources = Math.max(0, this.activeWaterSources - 1);
            if (this.activeWaterSources === 0) this.worldAudio.water.triggerRelease();
        }
    }

    createLivingRoomLeftWall(x, height, thickness, zCenter) {
        // Z Depth is 12. Range -24.5 to -12.5.
        // Center -18.5.
        // Door at center (-18.5).
        const depth = 12;
        const doorWidth = 1.0;
        const doorHeight = 2.2;
        
        const group = new THREE.Group();
        group.position.set(x, height/2, zCenter);
        // Left wall, normal +X. No rotation needed if we build along Z (depth) and Y (height), with thickness X.
        
        const mat = this.materials.houseWall;

        // 1. Front Panel (Towards Hallway/Z=-12.5)
        // From z = -18.5 + 0.5 = -18.0 to -12.5.
        // Length = 5.5.
        // Center local Z = 0.5 + 2.75 = 3.25.
        const frontPanel = new THREE.Mesh(new THREE.BoxGeometry(thickness, height, 5.5), mat);
        frontPanel.position.set(0, 0, 3.25);
        group.add(frontPanel);
        this.colliders.push(frontPanel);

        // 2. Back Panel (Towards Window/Z=-24.5)
        // From z = -24.5 to -19.0 (-18.5 - 0.5).
        // Length = 5.5.
        // Center local Z = -0.5 - 2.75 = -3.25.
        const backPanel = new THREE.Mesh(new THREE.BoxGeometry(thickness, height, 5.5), mat);
        backPanel.position.set(0, 0, -3.25);
        group.add(backPanel);
        this.colliders.push(backPanel);

        // 3. Header Panel (Above Door)
        // Z -0.5 to 0.5. Height 4 - 2.2 = 1.8.
        // Center Y local: 2.2 + 0.9 - 2 (since group is at h/2=2) = 1.1.
        // Actually: top is at 4. Bottom at 2.2. Center 3.1.
        // Group Y is 2. Relative pos = 1.1.
        const header = new THREE.Mesh(new THREE.BoxGeometry(thickness, 1.8, 1.0), mat);
        header.position.set(0, 1.1, 0);
        group.add(header);
        this.colliders.push(header);

        this.root.add(group);
    }

    createFamilyPortraitTrigger() {
        const x = 12.8; // On the right wall of the kitchen
        const y = 2.0;
        const z = -18.5;

        this.portraitObject = new THREE.Group();
        this.portraitObject.position.set(x, y, z);
        this.portraitObject.rotation.y = -Math.PI / 2; // Facing the kitchen

        // Frame
        const frameMesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 1.0, 0.05),
            this.materials.wood
        );
        this.portraitObject.add(frameMesh);

        // Picture
        const pictureMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(0.7, 0.9),
            this.materials.familyPortrait
        );
        pictureMesh.position.z = 0.03;
        this.portraitObject.add(pictureMesh);

        this.root.add(this.portraitObject);
    }

    createBeadCurtain() {
        // Kitchen entrance is an archway at x=5, z=-18.5, rotated PI/2.
        // Opening width 2.5m, height 2.5m.
        // FIX: rotationY = 0 to span the Z axis along the archway wall.
        this.beadCurtain = new BeadCurtain(
            this.root, 
            new THREE.Vector3(5, 2.5, -18.5), 
            0, 
            2.5, 
            2.3
        );
    }

    createBasement() {
        // 1. Stairwell (Leading down from Living Room)
        // Starts at x=-5, z=-18.5. goes Left (-X).
        const stairWidth = 1.2;
        const startX = -5.0;
        const startY = 0;
        const startZ = -18.5;
        
        const stairLen = 5.0; // Horizontal run
        const stairDrop = 3.5; // Vertical drop
        const endX = startX - stairLen; // -10.0
        const endY = startY - stairDrop; // -3.5

        // Basement Room Dimensions
        const baseW = 10;
        const baseD = 12;
        const baseH = 4;
        // Right wall is at endX (-10). So Center is endX - baseW/2
        const baseX = endX - baseW / 2;

        const mat = this.materials.concrete;
        
        // Stair Steps
        const numSteps = 15;
        const stepRun = stairLen / numSteps;
        const stepRise = stairDrop / numSteps;
        
        for(let i=0; i<numSteps; i++) {
            const sX = startX - (i * stepRun) - (stepRun/2);
            const sY = startY - (i * stepRise) - (stepRise/2);
            
            const step = new THREE.Mesh(
                new THREE.BoxGeometry(stepRun, stepRise * (i+1) + 0.2, stairWidth), // Extend down to fill gap
                mat
            );
            // step.position.set(sX, sY, startZ);
            // Better visual: just the treads
             const tread = new THREE.Mesh(
                new THREE.BoxGeometry(stepRun, 0.1, stairWidth),
                mat
            );
            tread.position.set(startX - (i * stepRun) - stepRun/2, startY - (i * stepRise), startZ);
            this.root.add(tread);
            // DO NOT add treads to colliders, they create a jagged surface that gets the player stuck.
            // The slope collider handles the physics.
        }
        
        // Invisible Slope Collider for smooth walking
        // Angle
        const angle = Math.atan2(stairDrop, stairLen);
        const slopeLen = Math.sqrt(stairLen*stairLen + stairDrop*stairDrop);
        const slopeMat = new THREE.MeshBasicMaterial({ visible: true, transparent: true, opacity: 0 }); // CHANGED
        const slope = new THREE.Mesh(
            new THREE.BoxGeometry(slopeLen, 0.1, stairWidth),
            slopeMat
        );
        slope.position.set(startX - stairLen/2, startY - stairDrop/2, startZ);
        slope.rotation.z = angle; 
        
        this.root.add(slope);
        this.floors.push(slope);
        // this.colliders.push(slope); // REMOVED
        
        // Stair Walls (Sides)
        const wallThick = 0.2;
        // North Wall (z = -18.5 - 0.6 - 0.1)
        // Increase height to 8 to ensure it covers the gap to the ceiling (living room Y=4)
        // Center Y at 0 so it goes from -4 to +4
        const nWall = new THREE.Mesh(
            new THREE.BoxGeometry(stairLen + 2, 8, wallThick),
            mat
        );
        nWall.position.set(startX - stairLen/2 - 1, 0, startZ - stairWidth/2 - wallThick/2);
        this.root.add(nWall);
        this.colliders.push(nWall);
        
        // South Wall
        const sWall = new THREE.Mesh(
            new THREE.BoxGeometry(stairLen + 2, 8, wallThick),
            mat
        );
        sWall.position.set(startX - stairLen/2 - 1, 0, startZ + stairWidth/2 + wallThick/2);
        this.root.add(sWall);
        this.colliders.push(sWall);
        
        // Ceiling over stairs (sloped)
        const ceiling = new THREE.Mesh(
            new THREE.BoxGeometry(slopeLen, 0.2, stairWidth + wallThick*2),
            mat
        );
        // Positioned to start exactly at living room ceiling height (y=4)
        // Center Y calculation: StartY(4.0) - Rise/2. Rise is stairDrop (3.5).
        // So CenterY = 4.0 - 1.75 = 2.25.
        // wait, offset was +4.0 from center (-1.75) => 2.25. This was correct mathematically.
        // Maybe the visual hole was the side walls.
        ceiling.position.set(startX - stairLen/2, startY - stairDrop/2 + 4.0, startZ); 
        ceiling.rotation.z = angle;
        this.root.add(ceiling);


        // Basement Walls with new texture
        const baseMat = this.materials.basementWall;
        baseMat.map.wrapS = baseMat.map.wrapT = THREE.RepeatWrapping;
        baseMat.map.repeat.set(2, 1);
        
        // Floor
        const bFloor = new THREE.Mesh(
            new THREE.BoxGeometry(baseW, 0.2, baseD),
            this.materials.concrete // Keep floor concrete
        );
        bFloor.position.set(baseX, endY - 0.1, startZ);
        this.root.add(bFloor);
        this.floors.push(bFloor); // Add to floors
        // this.colliders.push(bFloor); // Remove from colliders just in case
        
        // Ceiling
        const bCeil = new THREE.Mesh(
            new THREE.BoxGeometry(baseW, 0.2, baseD),
            this.materials.concrete
        );
        bCeil.position.set(baseX, endY + baseH, startZ);
        this.root.add(bCeil);
        
        // Walls
        // Far Left (x = baseX - W/2)
        const w1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, baseH, baseD), baseMat);
        w1.position.set(baseX - baseW/2, endY + baseH/2, startZ);
        this.root.add(w1);
        this.colliders.push(w1);
        
        // Add Water Stain Decal to Far Left Wall
        const stain = new THREE.Mesh(new THREE.PlaneGeometry(2, 3), this.materials.waterStain);
        stain.position.set(baseX - baseW/2 + 0.11, endY + baseH/2, startZ); // Slightly offset from wall
        stain.rotation.y = Math.PI / 2;
        this.root.add(stain);
        
        // Entrance Wall (Right side, x = baseX + W/2)
        // Needs gap for stairs
        // Stairs come in at center Z.
        // Wall Top
        const w2Top = new THREE.Mesh(new THREE.BoxGeometry(0.2, baseH - 2.5, baseD), baseMat);
        w2Top.position.set(baseX + baseW/2, endY + 2.5 + (baseH-2.5)/2, startZ);
        this.root.add(w2Top);
        this.colliders.push(w2Top);
        // Wall Sides (flanking stairs)
        const w2Side1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.5, (baseD - stairWidth)/2), baseMat);
        w2Side1.position.set(baseX + baseW/2, endY + 1.25, startZ - stairWidth/2 - (baseD - stairWidth)/4);
        this.root.add(w2Side1);
        this.colliders.push(w2Side1);
        const w2Side2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.5, (baseD - stairWidth)/2), baseMat);
        w2Side2.position.set(baseX + baseW/2, endY + 1.25, startZ + stairWidth/2 + (baseD - stairWidth)/4);
        this.root.add(w2Side2);
        this.colliders.push(w2Side2);
        
        // Front Wall (Z+)
        const w3 = new THREE.Mesh(new THREE.BoxGeometry(baseW, baseH, 0.2), baseMat);
        w3.position.set(baseX, endY + baseH/2, startZ + baseD/2);
        this.root.add(w3);
        this.colliders.push(w3);
        
        // Back Wall (Z-)
        const w4 = new THREE.Mesh(new THREE.BoxGeometry(baseW, baseH, 0.2), baseMat);
        w4.position.set(baseX, endY + baseH/2, startZ - baseD/2);
        this.root.add(w4);
        this.colliders.push(w4);
        
        // Basement Atmosphere (Lights)
        // A single hanging bulb in the center
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshStandardMaterial({
             emissive: 0xffaa00, emissiveIntensity: 2
        }));
        bulb.position.set(baseX, endY + 3.0, startZ);
        this.root.add(bulb);
        
        const baseLight = new THREE.PointLight(0xffaa00, 1.0, 15);
        baseLight.position.set(baseX, endY + 2.5, startZ);
        baseLight.castShadow = true;
        this.root.add(baseLight);
        
        // POOL TABLE
        this.createPoolTable(baseX, endY, startZ);

        // Clutter: Stack of boxes in the corner (Far Left - Back) to clear floor for pool
        const boxMat = this.materials.wood;
        const boxes = [
            { s: 0.8, pos: [baseX - 4.2, endY + 0.4, startZ - 4.2], rot: 0.2 },
            { s: 0.6, pos: [baseX - 4.2, endY + 0.8 + 0.3, startZ - 4.2], rot: -0.1 }, // Stacked
            { s: 0.7, pos: [baseX - 3.2, endY + 0.35, startZ - 4.5], rot: 0.5 },
            { s: 0.9, pos: [baseX - 4.5, endY + 0.45, startZ - 3.0], rot: 0 },
            { s: 0.5, pos: [baseX - 3.5, endY + 0.25, startZ - 3.5], rot: 0.8 }
        ];
        
        boxes.forEach(b => {
             const box = new THREE.Mesh(new THREE.BoxGeometry(b.s, b.s, b.s), boxMat);
             box.position.set(...b.pos);
             box.rotation.y = b.rot;
             this.root.add(box);
             this.colliders.push(box);
        });

        // Car Keys (On top of the small scattered box)
        // Position: baseX - 3.5, endY + 0.5 + 0.05, startZ - 3.5
        const carKeysMesh = this.createCarKeysMesh();
        const carKeys = new Item('car_keys', 'Car Keys', 'Pick up Car Keys', carKeysMesh);
        carKeys.position.set(baseX - 3.5, endY + 0.25 + 0.25 + 0.05, startZ - 3.5); // On top of box (0.25y + size/2)
        this.root.add(carKeys);
        this.interactiveObjects.push(carKeys);
    }

    createCarKeysMesh() {
        const group = new THREE.Group();
        const blackPlastic = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
        const metal = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.2 });

        // Fob Head
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.1), blackPlastic);
        group.add(head);

        // Blade
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.005, 0.08), metal);
        blade.position.z = 0.08;
        group.add(blade);
        
        // Ring
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.005, 8, 16), metal);
        ring.position.z = -0.06;
        ring.rotation.x = Math.PI / 2;
        group.add(ring);

        return group;
    }

    createPoolTable(x, y, z) {
        const tableGroup = new THREE.Group();
        tableGroup.position.set(x, y, z);

        // Physics State
        this.poolBalls = []; // Array of { mesh, velocity: Vector3 }
        // Shrink bounds slightly to account for rails being thick
        this.poolTableBounds = { minX: -1.15, maxX: 1.15, minZ: -0.55, maxZ: 0.55 }; 

        // 1. Table Body (Legs and Frame)
        const legGeo = new THREE.BoxGeometry(0.15, 0.8, 0.15);
        const legMat = this.materials.wood;
        
        const legPositions = [
            [-1.1, 0.4, -0.5], [1.1, 0.4, -0.5],
            [-1.1, 0.4, 0.5], [1.1, 0.4, 0.5]
        ];
        legPositions.forEach(pos => {
            const leg = new THREE.Mesh(legGeo, legMat);
            leg.position.set(...pos);
            tableGroup.add(leg);
        });

        const frame = new THREE.Mesh(
            new THREE.BoxGeometry(2.6, 0.2, 1.4),
            new THREE.MeshStandardMaterial({ color: 0x5a3a2a, roughness: 0.6 })
        );
        frame.position.y = 0.8;
        tableGroup.add(frame);
        this.colliders.push(frame); // Table blocks player

        // 2. Felt Surface
        const felt = new THREE.Mesh(
            new THREE.BoxGeometry(2.4, 0.05, 1.2),
            new THREE.MeshStandardMaterial({ color: 0x228822, roughness: 1.0 })
        );
        felt.position.y = 0.9;
        tableGroup.add(felt);

        // 3. Rails (Cushions)
        const railLong = new THREE.BoxGeometry(2.6, 0.1, 0.1);
        const railShort = new THREE.BoxGeometry(0.1, 0.1, 1.4);
        const railMat = new THREE.MeshStandardMaterial({ color: 0x4a2a1a, roughness: 0.6 });

        const rails = [
            { geo: railLong, pos: [0, 0.95, -0.65] }, // Back
            { geo: railLong, pos: [0, 0.95, 0.65] },  // Front
            { geo: railShort, pos: [-1.25, 0.95, 0] }, // Left
            { geo: railShort, pos: [1.25, 0.95, 0] }   // Right
        ];
        rails.forEach(r => {
            const rail = new THREE.Mesh(r.geo, railMat);
            rail.position.set(...r.pos);
            tableGroup.add(rail);
        });

        // 4. Pockets (Visual + Physics definitions)
        // Corners and Mids
        this.pockets = [
            { x: -1.2, z: -0.6 }, // Back Left
            { x: 1.2, z: -0.6 },  // Back Right
            { x: -1.2, z: 0.6 },  // Front Left
            { x: 1.2, z: 0.6 },   // Front Right
            { x: 0, z: -0.65 },   // Back Mid
            { x: 0, z: 0.65 }     // Front Mid
        ];
        
        const pocketGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.06, 16);
        const pocketMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        
        this.pockets.forEach(p => {
            const pocket = new THREE.Mesh(pocketGeo, pocketMat);
            pocket.position.set(p.x, 0.91, p.z);
            tableGroup.add(pocket);
        });

        // 5. Balls
        const ballGeo = new THREE.SphereGeometry(0.04, 16, 16);
        const createBall = (color, bx, bz, isCue = false) => {
            const ballMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.2, metalness: 0.1 });
            
            // Physics Object Container
            const ballObj = {
                mesh: null,
                velocity: new THREE.Vector3(0, 0, 0),
                radius: 0.04,
                isCue: isCue,
                active: true,
                startPos: { x: bx, z: bz }
            };
            this.poolBalls.push(ballObj);

            if (isCue) {
                 // Interactive Wrapper for Cue Ball
                 const cueWrap = new InteractiveObject('cue_ball', 'Cue Ball', 'Shoot (Aim with Camera)', (state) => {
                     // Get player look direction from state
                     const dir = state.playerDirection;
                     if (dir) {
                         // Project onto XZ plane
                         const power = 0.25; // Adjusted power
                         ballObj.velocity.set(dir.x * power, 0, dir.z * power);
                         
                         // Sound - use pooled
                         if (this.poolAudio && this.poolAudio.clack) {
                             this.poolAudio.clack.triggerAttackRelease("C4", "32n");
                         }
                         
                         return null;
                     }
                     return "Look at the ball to aim!";
                 });
                 cueWrap.position.set(bx, 0.9 + 0.04, bz);
                 tableGroup.add(cueWrap);
                 
                 const ball = new THREE.Mesh(ballGeo, ballMat);
                 cueWrap.add(ball);
                 ballObj.mesh = cueWrap; 
                 this.interactiveObjects.push(cueWrap);
            } else {
                const ball = new THREE.Mesh(ballGeo, ballMat);
                ball.position.set(bx, 0.9 + 0.04, bz);
                tableGroup.add(ball);
                ballObj.mesh = ball;
            }
        };

        // Rack of balls
        const startX = 0.5;
        const spacing = 0.082; 
        const colors = [0xffff00, 0x0000ff, 0xff0000, 0x800080, 0xffa500, 0x008000, 0x800000, 0x111111];
        
        let cIdx = 0;
        for (let i = 0; i < 5; i++) {
             for (let j = 0; j <= i; j++) {
                 const z = (j - i/2) * spacing;
                 const x = startX + i * (spacing * 0.866);
                 createBall(colors[cIdx % colors.length], x, z);
                 cIdx++;
             }
        }

        // Cue Ball
        createBall(0xffffff, -0.6, 0, true);

        this.root.add(tableGroup);
    }

    updatePoolPhysics() {
        if (!this.poolBalls) return;
        
        // Simple Physics Step
        this.poolBalls.forEach(ball => {
            if (!ball.active) return;
            
            // Apply Velocity
            ball.mesh.position.x += ball.velocity.x;
            ball.mesh.position.z += ball.velocity.z;
            
            // Friction
            ball.velocity.multiplyScalar(0.98); 
            if (ball.velocity.lengthSq() < 0.000001) ball.velocity.set(0,0,0);
            
            // Pocket Detection (Increased tolerance and checked before wall collisions)
            let potted = false;
            for (const p of this.pockets) {
                const dx = ball.mesh.position.x - p.x;
                const dz = ball.mesh.position.z - p.z;
                if (dx*dx + dz*dz < 0.15 * 0.15) { // Further increased pocket radius tolerance
                    potted = true;
                    
                    // Sound - use pooled synth
                    if (this.poolAudio && this.poolAudio.plop) {
                        this.poolAudio.plop.triggerAttackRelease("F2", "32n");
                    }
                    
                    if (ball.isCue) {
                        // Reset Cue Ball
                        ball.velocity.set(0,0,0);
                        ball.mesh.position.set(ball.startPos.x, 0.94, ball.startPos.z);
                    } else {
                        // Remove colored ball
                        ball.active = false;
                        ball.mesh.visible = false;
                        // Move far away to stop collisions
                        ball.mesh.position.set(0, -10, 0);
                    }
                    break;
                }
            }
            if (potted) return; // Skip wall collision if potted

            // Wall Collisions
            const bounds = this.poolTableBounds;
            const r = ball.radius;
            
            if (ball.mesh.position.x > bounds.maxX - r) {
                ball.mesh.position.x = bounds.maxX - r;
                ball.velocity.x *= -0.8;
            }
            if (ball.mesh.position.x < bounds.minX + r) {
                ball.mesh.position.x = bounds.minX + r;
                ball.velocity.x *= -0.8;
            }
            if (ball.mesh.position.z > bounds.maxZ - r) {
                ball.mesh.position.z = bounds.maxZ - r;
                ball.velocity.z *= -0.8;
            }
            if (ball.mesh.position.z < bounds.minZ + r) {
                ball.mesh.position.z = bounds.minZ + r;
                ball.velocity.z *= -0.8;
            }
        });

        // Ball-Ball Collisions
        for (let i = 0; i < this.poolBalls.length; i++) {
            if (!this.poolBalls[i].active) continue;
            for (let j = i + 1; j < this.poolBalls.length; j++) {
                if (!this.poolBalls[j].active) continue;
                
                const b1 = this.poolBalls[i];
                const b2 = this.poolBalls[j];
                
                const dx = b2.mesh.position.x - b1.mesh.position.x;
                const dz = b2.mesh.position.z - b1.mesh.position.z;
                const distSq = dx*dx + dz*dz;
                const minDist = b1.radius + b2.radius;
                
                if (distSq < minDist * minDist) {
                    // Collision Response
                    const dist = Math.sqrt(distSq);
                    if (dist < 0.001) continue; // Avoid div by zero

                    const nx = dx / dist;
                    const nz = dz / dist;
                    
                    // Separate
                    const overlap = minDist - dist;
                    const sepX = nx * overlap * 0.5;
                    const sepZ = nz * overlap * 0.5;
                    
                    b1.mesh.position.x -= sepX;
                    b1.mesh.position.z -= sepZ;
                    b2.mesh.position.x += sepX;
                    b2.mesh.position.z += sepZ;
                    
                    // Bounce
                    const v1x = b1.velocity.x; const v1z = b1.velocity.z;
                    const v2x = b2.velocity.x; const v2z = b2.velocity.z;
                    
                    const dot = (v1x - v2x) * nx + (v1z - v2z) * nz;
                    
                    if (dot > 0) continue; // Moving apart already

                    b1.velocity.x -= dot * nx;
                    b1.velocity.z -= dot * nz;
                    b2.velocity.x += dot * nx;
                    b2.velocity.z += dot * nz;
                    
                    // Sound - use pooled synth
                    if (Math.abs(dot) > 0.002 && this.poolAudio && this.poolAudio.clack) {
                         this.poolAudio.clack.triggerAttackRelease("G4", "64n");
                    }
                }
            }
        }
    }

    createKitchenBackWall() {
        const height = 4;
        const thickness = 0.2;
        const z = -23.5;
        const mat = this.materials.houseWall;

        const group = new THREE.Group();
        
        // 1. Large Left Section (from x=5 to x=10.5)
        // Width = 5.5, Center = 7.75
        const left = new THREE.Mesh(new THREE.BoxGeometry(5.5, height, thickness), mat);
        left.position.set(7.75, height/2, z);
        group.add(left);
        this.colliders.push(left);

        // 2. Small Right Section (from x=11.5 to x=13)
        // Width = 1.5, Center = 12.25
        const right = new THREE.Mesh(new THREE.BoxGeometry(1.5, height, thickness), mat);
        right.position.set(12.25, height/2, z);
        group.add(right);
        this.colliders.push(right);

        // 3. Top Door Frame (from x=10.5 to x=11.5)
        // Width = 1.0, Height = 1.8 (4 - 2.2)
        // Center X = 11, Center Y = 3.1
        const top = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.8, thickness), mat);
        top.position.set(11, 3.1, z);
        group.add(top);
        this.colliders.push(top);

        this.root.add(group);
    }

    setupLights() {
        // Clear old lights
        if (this.lights) {
            this.lights.forEach(l => this.scene.remove(l));
        }
        this.lights = [];

        const addLight = (light) => {
            this.scene.add(light);
            this.lights.push(light);
            return light;
        };

        // 0. Global Ambient (Very dim, just to prevent total blackness)
        const globalAmbient = new THREE.AmbientLight(0xffffff, 0.05);
        addLight(globalAmbient);

        // 1. Bathroom: Flicker light (Increased intensity)
        this.flickerLight = new THREE.PointLight(0xffccaa, 1.5, 15);
        this.flickerLight.position.set(0, 3, 0);
        this.flickerLight.castShadow = true;
        addLight(this.flickerLight);

        // Helper for Room "Ambient" (Soft, non-shadow casting fill light)
        const addRoomAmbient = (x, y, z, range, intensity, color = 0xffffff) => {
            const fill = new THREE.PointLight(color, intensity, range);
            fill.position.set(x, y, z);
            fill.castShadow = false; // Important: Fill light only
            addLight(fill);
        };

        // 2. Hallway 
        // Main Light - Slightly offset to create better shadows for the rat
        const hallwayLight = new THREE.PointLight(0xdddddd, 0.9, 20);
        hallwayLight.position.set(0.8, 3, -7.0);
        hallwayLight.castShadow = true;
        addLight(hallwayLight);
        // "Ambient" Fill (Low intensity)
        addRoomAmbient(0, 2, -7.5, 15, 0.15);

        // 3. Living Room
        // Main Lamp
        const livingLamp = new THREE.PointLight(0xffaa55, 1.0, 25);
        livingLamp.position.set(-2, 2.5, -18.5);
        livingLamp.castShadow = true;
        addLight(livingLamp);
        // "Ambient" Fill (Covers the large room, very low)
        addRoomAmbient(0, 2.5, -18.5, 25, 0.15);
        // Extra fill for the corner "moonlight"
        addRoomAmbient(4, 2, -22, 15, 0.2, 0x334455);

        // 4. Kitchen
        // Main Light
        const kitchenLight = new THREE.PointLight(0xddeeff, 0.9, 20);
        kitchenLight.position.set(9, 3, -18.5);
        kitchenLight.castShadow = true;
        addLight(kitchenLight);
        // "Ambient" Fill
        addRoomAmbient(9, 2, -18.5, 15, 0.15, 0xddeeff);

        // 5. Bedroom
        const bedroomLight = new THREE.PointLight(0xffeeaa, 0.8, 15);
        bedroomLight.position.set(-3.5, 1.2, -5.5); // At the nightstand lamp
        bedroomLight.castShadow = true;
        addLight(bedroomLight);
    }

    createArchwayWall(width, height, thickness, x, y, z, rotationY) {
        // Wider opening for kitchen/living connection (2.5m wide)
        const doorWidth = 2.5;
        const doorHeight = 2.5;
        
        const sideWidth = (width - doorWidth) / 2;
        const topHeight = height - doorHeight;

        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.rotation.y = rotationY;

        const mat = this.materials.houseWall; 

        // Left Panel
        const left = new THREE.Mesh(new THREE.BoxGeometry(sideWidth, height, thickness), mat);
        left.position.set(-width/2 + sideWidth/2, height/2, 0);
        group.add(left);
        this.colliders.push(left);

        // Right Panel
        const right = new THREE.Mesh(new THREE.BoxGeometry(sideWidth, height, thickness), mat);
        right.position.set(width/2 - sideWidth/2, height/2, 0);
        group.add(right);
        this.colliders.push(right);

        // Top Panel
        const top = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, topHeight, thickness), mat);
        top.position.set(0, height - topHeight/2, 0);
        group.add(top);
        this.colliders.push(top);

        this.root.add(group);
    }
    
    addLivingRoomFurniture() {
        // Welcome Rug/Mat
        // Front door is at z = -24.5. 
        // Placement slightly inside (z = -23.8)
        const rugWidth = 1.6;
        const rugHeight = 1.0;
        
        // Create canvas for "WELCOME" text
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        // Background color (Coir/Brown)
        ctx.fillStyle = '#442211';
        ctx.fillRect(0, 0, 512, 256);
        
        // Subtle border
        ctx.strokeStyle = '#331100';
        ctx.lineWidth = 20;
        ctx.strokeRect(10, 10, 492, 236);
        
        // Text
        ctx.fillStyle = '#111111';
        ctx.font = 'bold 80px "Crimson Text", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('WELCOME', 256, 128);
        
        const rugTexture = new THREE.CanvasTexture(canvas);
        const rugGeo = new THREE.PlaneGeometry(rugWidth, rugHeight);
        const rugMat = new THREE.MeshStandardMaterial({ 
            map: rugTexture,
            roughness: 1.0,
            metalness: 0.0
        });
        const rug = new THREE.Mesh(rugGeo, rugMat);
        rug.rotation.set(-Math.PI / 2, 0, Math.PI); // Rotate 180 so text faces correct way
        rug.position.set(0, 0.01, -23.8); // Slightly above floor to prevent z-fighting
        this.root.add(rug);

        // Ceiling Fan
        this.createCeilingFan(0, 4.0, -18.5);
        
        // Fan Switch (Front wall z=-12.5. Facing Living Room, so facing -Z)
        // Wall at -12.5. Switch slightly in front (-12.8).
        // x = -1.2 (Left of door)
        this.createFanSwitch(-1.2, 1.4, -12.8, Math.PI);

        // Sofa
        const sofaGroup = new THREE.Group();
        const sofaBase = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.5, 1), new THREE.MeshStandardMaterial({ color: 0x553333 }));
        sofaBase.position.y = 0.25;
        sofaGroup.add(sofaBase);
        const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.6, 0.2), new THREE.MeshStandardMaterial({ color: 0x553333 }));
        sofaBack.position.set(0, 0.6, -0.4);
        sofaGroup.add(sofaBack);
        
        sofaGroup.position.set(-2, 0, -18.5);
        sofaGroup.rotation.y = Math.PI / 2;
        this.root.add(sofaGroup);
        this.colliders.push(sofaBase); // Simplified collider
        
        // Coffee Table
        const table = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 0.8), this.materials.wood);
        table.position.set(0, 0.2, -18.5);
        this.root.add(table);
        this.colliders.push(table);
    }

    createWallCabinet(id, x, y, z, width, height, depth, rotationY) {
        const group = new THREE.Group();
        group.position.set(x, y + height / 2, z);
        group.rotation.y = rotationY;
        this.root.add(group);

        const material = this.materials.wood;
        const thickness = 0.03;

        // Hollow Cabinet Body (Panels instead of solid box)
        const leftWall = new THREE.Mesh(new THREE.BoxGeometry(thickness, height, depth), material);
        leftWall.position.x = -width / 2 + thickness / 2;
        
        const rightWall = new THREE.Mesh(new THREE.BoxGeometry(thickness, height, depth), material);
        rightWall.position.x = width / 2 - thickness / 2;
        
        const topWall = new THREE.Mesh(new THREE.BoxGeometry(width, thickness, depth), material);
        topWall.position.y = height / 2 - thickness / 2;
        
        const bottomWall = new THREE.Mesh(new THREE.BoxGeometry(width, thickness, depth), material);
        bottomWall.position.y = -height / 2 + thickness / 2;
        
        const backWall = new THREE.Mesh(new THREE.BoxGeometry(width, height, thickness), material);
        backWall.position.z = -depth / 2 + thickness / 2;

        group.add(leftWall, rightWall, topWall, bottomWall, backWall);
        this.colliders.push(leftWall, rightWall, topWall, bottomWall, backWall);

        // Interior Shelf
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(width - thickness * 2, thickness, depth - thickness), material);
        group.add(shelf);

        // Decorative Molding (Top)
        const molding = new THREE.Mesh(new THREE.BoxGeometry(width + 0.04, 0.05, depth + 0.02), material);
        molding.position.y = height / 2 + 0.025;
        group.add(molding);

        // Doors (Double)
        const doorW = width / 2;
        const doorH = height - 0.05;
        const doorT = 0.03;

        const createDoor = (isLeft) => {
            const doorObj = new InteractiveObject(`${id}_door_${isLeft ? 'l' : 'r'}`, 'Wall Cabinet', 'Open', (state) => {
                this.toggleDoor(doorObj);
                return null;
            });

            // Door Panel with "Shaker" style frame detail
            const panelGroup = new THREE.Group();
            const mainPanel = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, doorT), material);
            panelGroup.add(mainPanel);

            // Shaker frames (4 strips)
            const frameT = 0.01;
            const frameW = 0.06;
            const topF = new THREE.Mesh(new THREE.BoxGeometry(doorW, frameW, frameT), material);
            topF.position.set(0, doorH/2 - frameW/2, doorT/2 + frameT/2);
            const botF = new THREE.Mesh(new THREE.BoxGeometry(doorW, frameW, frameT), material);
            botF.position.set(0, -doorH/2 + frameW/2, doorT/2 + frameT/2);
            const leftF = new THREE.Mesh(new THREE.BoxGeometry(frameW, doorH - frameW*2, frameT), material);
            leftF.position.set(-doorW/2 + frameW/2, 0, doorT/2 + frameT/2);
            const rightF = new THREE.Mesh(new THREE.BoxGeometry(frameW, doorH - frameW*2, frameT), material);
            rightF.position.set(doorW/2 - frameW/2, 0, doorT/2 + frameT/2);
            panelGroup.add(topF, botF, leftF, rightF);

            panelGroup.position.x = isLeft ? doorW / 2 : -doorW / 2;
            doorObj.add(panelGroup);
            doorObj.colliderMesh = mainPanel;

            // Small handle
            const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.15), this.materials.metal);
            handle.position.set(isLeft ? doorW - 0.04 : -doorW + 0.04, -0.2, doorT/2 + 0.03);
            doorObj.add(handle);

            const pivotX = isLeft ? -width / 2 : width / 2;
            const pivotZ = depth / 2;
            const pivotVec = new THREE.Vector3(pivotX, 0, pivotZ).applyEuler(new THREE.Euler(0, rotationY, 0));
            
            doorObj.closedPos = new THREE.Vector3(x, y + height/2, z).add(pivotVec);
            doorObj.closedRotation = rotationY;
            doorObj.openTransform = {
                position: doorObj.closedPos.clone(),
                rotation: rotationY + (isLeft ? -Math.PI * 0.7 : Math.PI * 0.7)
            };

            doorObj.position.copy(doorObj.closedPos);
            doorObj.rotation.y = rotationY;
            this.root.add(doorObj);
            this.interactiveObjects.push(doorObj);
            this.colliders.push(mainPanel);
        };

        createDoor(true);
        createDoor(false);
    }

    createSink(x, y, z) {
        const group = new THREE.Group();
        group.position.set(x, y, z);
        this.root.add(group);

        // Stainless Steel Material
        const sinkMat = new THREE.MeshStandardMaterial({ 
            color: 0x888888, 
            metalness: 0.9, 
            roughness: 0.2,
            map: this.materials.metal.map
        });
        const waterMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.5, emissive: 0x224466 });
        
        // Basin Dimensions (matching the 0.8 x 0.5 hole)
        const outerW = 0.8;
        const outerD = 0.5;
        const basinH = 0.25;
        const wallT = 0.02;
        const rimW = 0.04; // Rim overlap

        // 1. Sink Rim (Sits on top of the granite)
        const rimShape = new THREE.Shape();
        rimShape.moveTo(-outerW/2 - rimW, -outerD/2 - rimW);
        rimShape.lineTo(outerW/2 + rimW, -outerD/2 - rimW);
        rimShape.lineTo(outerW/2 + rimW, outerD/2 + rimW);
        rimShape.lineTo(-outerW/2 - rimW, outerD/2 + rimW);
        rimShape.lineTo(-outerW/2 - rimW, -outerD/2 - rimW);

        const rimHole = new THREE.Path();
        rimHole.moveTo(-outerW/2 + wallT, -outerD/2 + wallT);
        rimHole.lineTo(outerW/2 - wallT, -outerD/2 + wallT);
        rimHole.lineTo(outerW/2 - wallT, outerD/2 - wallT);
        rimHole.lineTo(-outerW/2 + wallT, outerD/2 - wallT);
        rimHole.lineTo(-outerW/2 + wallT, -outerD/2 + wallT);
        rimShape.holes.push(rimHole);

        const rimGeo = new THREE.ExtrudeGeometry(rimShape, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01 });
        const rim = new THREE.Mesh(rimGeo, sinkMat);
        rim.rotation.x = -Math.PI / 2;
        rim.position.y = 0.025; // Sit slightly above counter height
        group.add(rim);

        // 2. Basin Walls (Hollow tub)
        const wallMat = sinkMat;
        // Bottom
        const bottom = new THREE.Mesh(new THREE.BoxGeometry(outerW - wallT*2, wallT, outerD - wallT*2), wallMat);
        bottom.position.y = -basinH + wallT/2;
        group.add(bottom);

        // Sides
        const sideL = new THREE.Mesh(new THREE.BoxGeometry(wallT, basinH, outerD), wallMat);
        sideL.position.set(-outerW/2 + wallT/2, -basinH/2, 0);
        group.add(sideL);

        const sideR = new THREE.Mesh(new THREE.BoxGeometry(wallT, basinH, outerD), wallMat);
        sideR.position.set(outerW/2 - wallT/2, -basinH/2, 0);
        group.add(sideR);

        const sideF = new THREE.Mesh(new THREE.BoxGeometry(outerW - wallT*2, basinH, wallT), wallMat);
        sideF.position.set(0, -basinH/2, outerD/2 - wallT/2);
        group.add(sideF);

        const sideB = new THREE.Mesh(new THREE.BoxGeometry(outerW - wallT*2, basinH, wallT), wallMat);
        sideB.position.set(0, -basinH/2, -outerD/2 + wallT/2);
        group.add(sideB);

        // 3. Drain
        const drain = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.01, 16), sinkMat);
        drain.position.y = -basinH + wallT + 0.001;
        group.add(drain);

        const drainHole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 16), new THREE.MeshBasicMaterial({ color: 0x000000 }));
        drainHole.position.y = -basinH + wallT + 0.005;
        group.add(drainHole);

        // Faucet and Swivel logic below...
        const metalMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1.0, roughness: 0.05 });
        
        // Faucet Base Plate
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.015, 0.12), metalMat);
        plate.position.set(0, 0.03, -outerD/2 - 0.02);
        group.add(plate);

        // Swivel Logic
        const swivel = new InteractiveObject('kitchen_faucet_swivel', 'Swivel Faucet', 'Rotate', (state) => {
            swivel.isRotated = !swivel.isRotated;
            swivel.rotation.y = swivel.isRotated ? 0.8 : 0;
            return null;
        });
        swivel.position.set(0, 0.04, -outerD/2 - 0.02);
        group.add(swivel);
        this.interactiveObjects.push(swivel);

        // Precision Segmented Spout
        const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.45, 24), metalMat);
        riser.position.y = 0.225;
        swivel.add(riser);

        const joint1 = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 16), metalMat);
        joint1.position.y = 0.45;
        swivel.add(joint1);

        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 24), metalMat);
        arm.rotation.x = Math.PI / 2;
        arm.position.set(0, 0.45, 0.11);
        swivel.add(arm);

        const joint2 = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 16), metalMat);
        joint2.position.set(0, 0.45, 0.22);
        swivel.add(joint2);

        const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.022, 0.1, 24), metalMat);
        nozzle.position.set(0, 0.4, 0.22);
        swivel.add(nozzle);

        // Water Stream
        const water = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5), waterMat);
        water.position.set(0, 0.1, 0.22);
        water.visible = false;
        swivel.add(water);

        // Handle
        const handle = new InteractiveObject('kitchen_handle_toggle', 'Water Toggle', 'Turn On/Off', (state) => {
            water.visible = !water.visible;
            handle.rotation.x = water.visible ? -0.5 : 0;
            this.toggleWaterSound(water.visible);
            return null;
        });
        handle.position.set(0.12, 0, 0);
        const hBase = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.04), metalMat);
        handle.add(hBase);
        const hLever = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.007, 0.12), metalMat);
        hLever.rotation.z = Math.PI / 2;
        hLever.position.set(0.06, 0.04, 0);
        handle.add(hLever);
        swivel.add(handle);
        this.interactiveObjects.push(handle);
    }

    createMirror(x, y, z, width, height, rotationY) {
        const mirrorGroup = new InteractiveObject('bathroom_mirror', 'Mirror', '', (state) => {
            return null; // Silent interaction
        });
        mirrorGroup.position.set(x, y, z);
        mirrorGroup.rotation.y = rotationY;
        
        const frameMat = this.materials.wood; 
        const glassMat = new THREE.MeshStandardMaterial({
            color: 0xdddddd,
            metalness: 1.0,
            roughness: 0.05,
            emissive: 0x222222, // Faint glow to look "glassy" in low light
            envMapIntensity: 1.0
        });

        // 1. Ornate Beveled Frame
        const frameThick = 0.08;
        const frameDepth = 0.06;
        
        const createFramePiece = (w, h, px, py) => {
            const piece = new THREE.Mesh(new THREE.BoxGeometry(w, h, frameDepth), frameMat);
            piece.position.set(px, py, 0);
            mirrorGroup.add(piece);
        };

        createFramePiece(width + frameThick * 2, frameThick, 0, height / 2 + frameThick / 2);
        createFramePiece(width + frameThick * 2, frameThick, 0, -height / 2 - frameThick / 2);
        createFramePiece(frameThick, height, -width / 2 - frameThick / 2, 0);
        createFramePiece(frameThick, height, width / 2 + frameThick / 2, 0);

        // 2. Mirror Surface
        const surface = new THREE.Mesh(
            new THREE.BoxGeometry(width, height, 0.03),
            glassMat
        );
        // Slightly forward in its own local space so it sits in front of the backing
        surface.position.z = 0.01;
        mirrorGroup.add(surface);

        // 3. Shine overlay for that "glass" effect
        const shine = new THREE.Mesh(
            new THREE.PlaneGeometry(width - 0.01, height - 0.01),
            new THREE.MeshStandardMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.1,
                roughness: 0,
                metalness: 0.8,
                side: THREE.DoubleSide
            })
        );
        shine.position.z = 0.026; // Just in front of the glass surface
        mirrorGroup.add(shine);

        // 4. Haunted Lady Sprite (Initially Hidden)
        const ladyTex = this.textureLoader.load(ASSETS.SCARE_LADY);
        const ladyMat = new THREE.MeshBasicMaterial({ 
            map: ladyTex, 
            transparent: true, 
            opacity: 0,
            side: THREE.DoubleSide 
        });
        // Match mirror dimensions exactly
        const ladyGeo = new THREE.PlaneGeometry(width, height);
        this.scareLady = new THREE.Mesh(ladyGeo, ladyMat);
        // Centered (0,0) will align bottom-to-bottom since heights match
        this.scareLady.position.set(0, 0, 0.05); 
        mirrorGroup.add(this.scareLady);

        this.root.add(mirrorGroup);
        this.interactiveObjects.push(mirrorGroup);
    }

    triggerMirrorScare() {
        if (this.scareTriggered || !this.scareLady) return;
        this.scareTriggered = true;

        // Visual Scare
        this.scareLady.material.opacity = 1;
        this.scareLady.visible = true; // Mesh visibility

        // Scream Sound
        if (this.poolAudio && this.poolAudio.scream) {
            this.poolAudio.scream.triggerAttackRelease("4n");
        }
        if (this.screamStinger) {
            this.screamStinger.triggerAttackRelease(["A4", "Bb4", "D#5"], "2n");
        }

        // Scare duration
        setTimeout(() => {
            if (this.scareLady) {
                this.scareLady.visible = false;
                this.scareLady.material.opacity = 0;
            }
        }, 800);
    }


    createToilet(x, y, z, rotationY) {
        const toiletGroup = new THREE.Group();
        toiletGroup.position.set(x, y, z);
        toiletGroup.rotation.y = rotationY;
        
        const porcelainMat = this.materials.porcelain;
        const metalMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 1.0, roughness: 0.1 });
        const plasticMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
        const waterMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.3, roughness: 0, metalness: 0.5 });

        // 1. Pedestal/Base - Tapered look
        const base = new THREE.Mesh(
            new THREE.CylinderGeometry(0.18, 0.25, 0.4, 16),
            porcelainMat
        );
        base.scale.set(1, 1, 1.4);
        base.position.y = 0.2;
        toiletGroup.add(base);
        this.colliders.push(base);

        // 2. Bowl - Rounded and deep
        const bowl = new THREE.Mesh(
            new THREE.SphereGeometry(0.35, 32, 24, 0, Math.PI * 2, 0, Math.PI / 2),
            porcelainMat
        );
        bowl.scale.set(1, 1, 1.3);
        bowl.rotation.x = Math.PI;
        bowl.position.y = 0.7;
        toiletGroup.add(bowl);
        this.colliders.push(bowl);

        // 3. Rim - Using Extrude for thickness and bevel
        const rimShape = new THREE.Shape();
        rimShape.absellipse(0, 0, 0.36, 0.46, 0, Math.PI * 2, false);
        const rimHole = new THREE.Path();
        rimHole.absellipse(0, 0, 0.28, 0.38, 0, Math.PI * 2, true);
        rimShape.holes.push(rimHole);
        
        const rimGeo = new THREE.ExtrudeGeometry(rimShape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 });
        const rim = new THREE.Mesh(rimGeo, porcelainMat);
        rim.rotation.x = -Math.PI / 2;
        rim.position.y = 0.72;
        toiletGroup.add(rim);

        // 4. Seat (down) - Slightly offset color/roughness
        const seatShape = new THREE.Shape();
        seatShape.absellipse(0, 0, 0.37, 0.47, 0, Math.PI * 2, false);
        const seatHole = new THREE.Path();
        seatHole.absellipse(0, 0, 0.25, 0.35, 0, Math.PI * 2, true);
        seatShape.holes.push(seatHole);
        
        const seatGeo = new THREE.ExtrudeGeometry(seatShape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 3 });
        const seat = new THREE.Mesh(seatGeo, plasticMat);
        seat.rotation.x = -Math.PI / 2;
        seat.position.y = 0.77;
        toiletGroup.add(seat);

        // 5. Water in Bowl (Static Plane)
        const water = new THREE.Mesh(new THREE.CircleGeometry(0.25, 32), waterMat);
        water.scale.set(1, 1.2, 1);
        water.rotation.x = -Math.PI / 2;
        water.position.y = 0.55;
        toiletGroup.add(water);

        // 6. Tank - Against the wall
        const tank = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.5, 0.25), porcelainMat);
        tank.position.set(0, 0.95, -0.42);
        toiletGroup.add(tank);
        this.colliders.push(tank);

        // 7. Tank Lid - Slightly larger than tank
        const lid = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.3), porcelainMat);
        lid.position.set(0, 1.23, -0.42);
        toiletGroup.add(lid);

        // 8. Flush Handle (Chrome)
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.02), metalMat);
        handle.position.set(-0.25, 1.15, -0.27);
        toiletGroup.add(handle);

        this.root.add(toiletGroup);
    }

    addKitchenFurniture() {
        // Countertop L-shape
        const counterHeight = 0.9;
        const counterDepth = 0.8;
        
        // Shorter counter to make room for fridge
        // Kitchen starts at x=5. Fridge is now further away from the wall.
        const counterWidth = 6.3; 
        const startX = 5;
        const backZ = -23.5;
        
        // --- Main Counter Cabinets (Under the counter) ---
        // Replacing the solid backCounter block with interactive cabinets
        const numCabinets = 7;
        const cabWidth = counterWidth / numCabinets;
        for (let i = 0; i < numCabinets; i++) {
            const cx = startX + (i * cabWidth) + cabWidth/2;
            const cz = backZ + counterDepth/2;
            // Cabinet under the sink (i=3) needs a cutout (no top)
            const hasTop = (i !== 3);
            this.createCabinet(`counter_cab_${i}`, cx, 0, cz, cabWidth, counterHeight, counterDepth, 0, true, hasTop);
        }

        // --- Countertop with Sink Hole ---
        const sinkX = startX + counterWidth / 2;
        const sinkW = 0.8;
        const sideW = (counterWidth - sinkW) / 2;

        const leftTop = new THREE.Mesh(new THREE.BoxGeometry(sideW, 0.05, counterDepth), this.materials.granite);
        leftTop.position.set(startX + sideW/2, counterHeight, backZ + counterDepth/2);
        
        const rightTop = new THREE.Mesh(new THREE.BoxGeometry(sideW, 0.05, counterDepth), this.materials.granite);
        rightTop.position.set(startX + counterWidth - sideW/2, counterHeight, backZ + counterDepth/2);
        
        const frontTop = new THREE.Mesh(new THREE.BoxGeometry(sinkW, 0.05, 0.15), this.materials.granite);
        frontTop.position.set(sinkX, counterHeight, backZ + counterDepth - 0.075);
        
        const backTop = new THREE.Mesh(new THREE.BoxGeometry(sinkW, 0.05, 0.15), this.materials.granite);
        backTop.position.set(sinkX, counterHeight, backZ + 0.075);

        this.root.add(leftTop, rightTop, frontTop, backTop);
        this.colliders.push(leftTop, rightTop, frontTop, backTop);

        // --- Sink ---
        this.createSink(sinkX, counterHeight, backZ + counterDepth/2);

        // --- Wall Cabinets (Above Counter) ---
        const wallCabH = 0.9;
        const wallCabD = 0.35;
        const wallCabY = 1.6; // Height from floor to bottom of wall cabinet
        const numWallCabs = 7;
        const wallCabW = counterWidth / numWallCabs;

        for (let i = 0; i < numWallCabs; i++) {
            const cx = startX + (i * wallCabW) + wallCabW/2;
            const cz = backZ + wallCabD/2;
            this.createWallCabinet(`wall_cab_${i}`, cx, wallCabY, cz, wallCabW, wallCabH, wallCabD, 0);
        }

        // Backsplash
        const backsplash = new THREE.Mesh(
            new THREE.BoxGeometry(counterWidth, 0.7, 0.05),
            this.materials.granite
        );
        backsplash.position.set(startX + counterWidth/2, counterHeight + 0.35, backZ + 0.025);
        this.root.add(backsplash);

        // Pantry (Built into the right wall x=13)
        this.createPantry(12.6, 0, -15.5);
        
        // Kitchen Island (Solid Base)
        const islandGroup = new THREE.Group();
        islandGroup.position.set(9, 0, -18.5);
        
        const islandBase = new THREE.Mesh(
            new THREE.BoxGeometry(3.0, counterHeight, 1.2),
            this.materials.wood
        );
        islandBase.position.y = counterHeight/2;
        islandGroup.add(islandBase);
        this.colliders.push(islandBase);

        const islandTop = new THREE.Mesh(
            new THREE.BoxGeometry(3.2, 0.05, 1.4),
            this.materials.granite
        );
        islandTop.position.y = counterHeight;
        islandGroup.add(islandTop);

        this.root.add(islandGroup);

        // House Key (Placed on the Island)
        const houseKeyMesh = this.createHouseKeyMesh();
        // Add a slight glow to the key to make it visible
        houseKeyMesh.traverse(child => {
            if (child.isMesh) {
                child.material.emissive = new THREE.Color(0xffd700);
                child.material.emissiveIntensity = 0.5;
            }
        });
        
        this.houseKeyItem = new Item('house_key', 'House Key', 'Pick up House Key', houseKeyMesh);
        // Custom interaction to add speech
        const baseInteract = this.houseKeyItem.onInteract;
        this.houseKeyItem.onInteract = (state) => {
            state.speak("This must be the key Arthur mentioned in the note to Sarah. I hope it still works.");
            return baseInteract(state);
        };
        
        // Moved to the base cabinet RIGHT under the sink (counter_cab_3)
        // Positioned slightly higher (y=0.15) and forward for better visibility
        this.houseKeyItem.position.set(8.5, 0.15, -23.0); 
        this.root.add(this.houseKeyItem);
        this.interactiveObjects.push(this.houseKeyItem);

        // 3 Island Chairs (Stools) - One side (Facing +Z towards the entrance)
        for (let i = 0; i < 3; i++) {
            const stool = new THREE.Group();
            const posX = 7.8 + (i * 1.2); // Spread across the island
            stool.position.set(posX, 0, -17.5);
            
            // Seat
            const seat = new THREE.Mesh(
                new THREE.CylinderGeometry(0.2, 0.2, 0.05, 12),
                this.materials.wood
            );
            seat.position.y = 0.6;
            stool.add(seat);
            
            // Legs
            const legGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.6, 4);
            const legPositions = [[0.1, 0.3, 0.1], [-0.1, 0.3, 0.1], [0.1, 0.3, -0.1], [-0.1, 0.3, -0.1]];
            legPositions.forEach(p => {
                const leg = new THREE.Mesh(legGeo, this.materials.metal);
                leg.position.set(...p);
                stool.add(leg);
            });
            
            this.root.add(stool);
            this.colliders.push(seat);
        }

        // Dining Table
        const diningTable = new THREE.Group();
        diningTable.position.set(8.5, 0, -14.5); // Near the living room archway
        
        const dTableTop = new THREE.Mesh(
            new THREE.BoxGeometry(2.0, 0.05, 1.2),
            this.materials.wood
        );
        dTableTop.position.y = 0.75;
        diningTable.add(dTableTop);
        this.colliders.push(dTableTop);

        // Table Legs
        const dLegGeo = new THREE.BoxGeometry(0.08, 0.75, 0.08);
        const dLegPos = [[0.9, 0.375, 0.5], [-0.9, 0.375, 0.5], [0.9, 0.375, -0.5], [-0.9, 0.375, -0.5]];
        dLegPos.forEach(p => {
            const leg = new THREE.Mesh(dLegGeo, this.materials.wood);
            leg.position.set(...p);
            diningTable.add(leg);
        });

        this.root.add(diningTable);
        
        // Fridge moved to touch the counter (Counter ends at 11.3)
        // Fridge width is 0.9, so center is 11.3 + 0.45 = 11.75
        this.createFridge(11.75, 0, -23.0);
        this.fridgePos = new THREE.Vector3(11.75, 1, -23.0);
    }

    createBedroomWindowWall(x, height, thickness, zCenter) {
        // Wall spans Z (depth 6). Center z = zCenter.
        // Left wall of room, so normal is +X.
        // We build it using panels along Z.
        // Standard Window Size
        const windowWidth = 1.5; // Actually width in Z terms
        const windowHeight = 1.2;
        const windowY = 1.5;

        // Total Wall Depth is 6.
        // Z Range: zCenter - 3 to zCenter + 3. (-10.5 to -4.5)
        
        // Window Center at zCenter (Middle of wall)
        // Window Z range: -0.75 to +0.75 relative to center.
        
        const group = new THREE.Group();
        group.position.set(x, height/2, zCenter);
        // No rotation needed if we build boxes with (thickness, h, d)
        
        const mat = this.materials.bedroomWall;

        // 1. Far Back Strip (Towards z = -10.5)
        // From Z -3 to -0.75. Length 2.25.
        const backStrip = new THREE.Mesh(new THREE.BoxGeometry(thickness, height, 2.25), mat);
        backStrip.position.set(0, 0, -3 + 2.25/2); // Local Z
        group.add(backStrip);
        this.colliders.push(backStrip);

        // 2. Far Front Strip (Towards z = -4.5)
        // From Z 0.75 to 3. Length 2.25.
        const frontStrip = new THREE.Mesh(new THREE.BoxGeometry(thickness, height, 2.25), mat);
        frontStrip.position.set(0, 0, 3 - 2.25/2);
        group.add(frontStrip);
        this.colliders.push(frontStrip);

        // 3. Under Window
        // Z -0.75 to 0.75 (Length 1.5).
        // Height: 0 to (windowY - h/2) = 1.5 - 0.6 = 0.9.
        // Local Y relative to wall center (h/2 = 1.75).
        // Actual Y pos: 0.45.
        // Relative to group center (1.75): 0.45 - 1.75 = -1.3
        const underWin = new THREE.Mesh(new THREE.BoxGeometry(thickness, 0.9, 1.5), mat);
        underWin.position.set(0, 0.45 - height/2, 0); 
        group.add(underWin);
        this.colliders.push(underWin);

        // 4. Over Window
        // Height: (windowY + h/2) = 2.1 to 3.5. Length 1.4.
        // Center Y: 2.1 + 0.7 = 2.8.
        // Relative: 2.8 - 1.75 = 1.05.
        const overWin = new THREE.Mesh(new THREE.BoxGeometry(thickness, 1.4, 1.5), mat);
        overWin.position.set(0, 2.8 - height/2, 0);
        group.add(overWin);
        this.colliders.push(overWin);

        // Window Glass
        const glass = new THREE.Mesh(new THREE.BoxGeometry(0.05, windowHeight, windowWidth), this.materials.glass);
        glass.position.set(0, windowY - height/2, 0);
        group.add(glass);
        this.colliders.push(glass); // Block player

        // Frame
        const frameV = new THREE.Mesh(new THREE.BoxGeometry(0.06, windowHeight, 0.05), this.materials.wood);
        frameV.position.set(0, windowY - height/2, 0);
        group.add(frameV);
        const frameH = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, windowWidth), this.materials.wood);
        frameH.position.set(0, windowY - height/2, 0);
        group.add(frameH);
        
        this.root.add(group);
    }

    addBedroomFurniture() {
        // 1. Bed (Double)
        const bedGroup = new THREE.Group();
        bedGroup.position.set(-5.0, 0, -5.5); // Back-Left corner area
        
        // Rotate 180 degrees (face opposite way)
        bedGroup.rotation.y = Math.PI;

        // Frame
        const frame = new THREE.Mesh(
            new THREE.BoxGeometry(1.6, 0.4, 2.2),
            this.materials.wood
        );
        frame.position.y = 0.2;
        bedGroup.add(frame);
        this.colliders.push(frame); // Bed blocks movement

        // Mattress
        const mattress = new THREE.Mesh(
            new THREE.BoxGeometry(1.5, 0.25, 2.1),
            new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 1.0 }) // White sheets
        );
        mattress.position.y = 0.5;
        bedGroup.add(mattress);

        // Headboard
        const headboard = new THREE.Mesh(
            new THREE.BoxGeometry(1.6, 1.2, 0.1),
            this.materials.wood
        );
        headboard.position.set(0, 0.6, -1.05);
        bedGroup.add(headboard);
        
        // Pillow
        const pillow = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 0.15, 0.4),
            new THREE.MeshStandardMaterial({ color: 0xffffff })
        );
        pillow.position.set(0, 0.65, -0.8);
        pillow.rotation.x = 0.1;
        bedGroup.add(pillow);

        this.root.add(bedGroup);

        // 2. Dresser (Interactive Wardrobe with Hangers)
        // Place against Right Wall (near the door but not blocking it)
        // Room Right is x=-1.5. Dresser x = -1.5 - 0.4 = -1.9
        // Move further from wall to prevent door clipping (x changed from -2.2 to -2.8)
        this.createWardrobe(-2.8, 0, -9.5, 0);

        // 3. Nightstand
        const nightstand = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.6, 0.5),
            this.materials.wood
        );
        // Next to bed. Bed is at x=-5.0. 
        // Bed width 1.6 -> edges at -5.8 and -4.2.
        // Place right of bed: x = -3.5?
        nightstand.position.set(-3.5, 0.3, -5.5); // Beside bed
        this.root.add(nightstand);
        this.colliders.push(nightstand);

        // Small lamp on nightstand
        const lampBase = new THREE.Mesh(
            new THREE.CylinderGeometry(0.1, 0.15, 0.2, 8),
            this.materials.porcelain
        );
        lampBase.position.set(-3.5, 0.7, -5.5);
        this.root.add(lampBase);
        
        const lampShade = new THREE.Mesh(
            new THREE.ConeGeometry(0.25, 0.3, 8, 1, true),
            new THREE.MeshStandardMaterial({ color: 0xffeeaa, side: THREE.DoubleSide })
        );
        lampShade.position.set(-3.5, 0.9, -5.5);
        this.root.add(lampShade);

        // 4. Desk (Across from Bed -> Back Wall)
        // Back wall is z = -10.5.
        // Desk Center z = -9.8.
        // X Position: Centered in room (-4.0) or offset? Let's center it on the back wall space.
        const deskGroup = new THREE.Group();
        deskGroup.position.set(-5.5, 0, -9.8); // Slightly towards window side

        const deskTable = new THREE.Mesh(
            new THREE.BoxGeometry(1.6, 0.75, 0.8),
            this.materials.wood
        );
        deskTable.position.y = 0.375;
        deskGroup.add(deskTable);
        this.colliders.push(deskTable);

        // Chair
        const chair = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.5, 0.5),
            new THREE.MeshStandardMaterial({ color: 0x444444 })
        );
        chair.position.set(0, 0.25, 0.8); // Pulled out slightly
        deskGroup.add(chair);
        this.colliders.push(chair);

        this.root.add(deskGroup);

        // 5. Laptop
        this.createLaptop(-5.5, 0.75, -9.8);

    }

    createLaptop(x, y, z) {
        const laptop = new InteractiveObject('laptop', 'Laptop', 'Use', (state) => {
             state.openLaptop();
             return null;
        });
        
        const group = new THREE.Group();
        
        // Base
        const base = new THREE.Mesh(
            new THREE.BoxGeometry(0.35, 0.02, 0.25),
            this.materials.blackPlastic
        );
        group.add(base);

        // Screen (Lid)
        const lid = new THREE.Group();
        lid.position.set(0, 0.01, -0.125); // Hinge at back
        lid.rotation.x = -Math.PI / 6; // Open 30 degrees from vertical (approx 100 deg total)

        const lidFrame = new THREE.Mesh(
            new THREE.BoxGeometry(0.35, 0.22, 0.02),
            this.materials.blackPlastic
        );
        lidFrame.position.set(0, 0.11, 0); // Up
        lid.add(lidFrame);

        // Screen Emission
        const screenGeo = new THREE.PlaneGeometry(0.32, 0.19);
        const screen = new THREE.Mesh(screenGeo, this.materials.screen);
        screen.position.set(0, 0.11, 0.011); // Slightly in front of frame
        lid.add(screen);

        group.add(lid);
        
        // Add light from screen
        const screenLight = new THREE.PointLight(0x8888ff, 0.5, 2);
        screenLight.position.set(0, 0.15, 0.1);
        group.add(screenLight);

        laptop.add(group);
        laptop.position.set(x, y, z);
        
        // Face the chair (Rotation)
        // Desk is at Back Wall, facing into room (Positive Z).
        // Default laptop faces +Z?
        // Base box geometry: width(x) 0.35, depth(z) 0.25.
        // Hinge at -z. So it opens towards +z.
        // Correct.
        
        this.root.add(laptop);
        this.interactiveObjects.push(laptop);
    }

    createNewspaper(x, y, z) {
        const newspaper = new InteractiveObject('newspaper', 'The County Sentinel', 'Read Newspaper', (state) => {
            state.readNewspaper();
            return null;
        });

        const paperGeo = new THREE.BoxGeometry(0.4, 0.01, 0.3);
        const paperMat = new THREE.MeshStandardMaterial({ 
            color: 0xe4e0d5, 
            roughness: 1.0
        });
        const paperMesh = new THREE.Mesh(paperGeo, paperMat);
        newspaper.add(paperMesh);

        // Simple text texture for newspaper look
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#e4e0d5';
        ctx.fillRect(0, 0, 512, 512);
        ctx.fillStyle = '#333';
        ctx.font = 'bold 40px serif';
        ctx.fillText('SENTINEL', 20, 60);
        ctx.font = '12px serif';
        for (let i = 0; i < 20; i++) {
            ctx.fillText('Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.', 20, 100 + i * 20);
        }
        const textTexture = new THREE.CanvasTexture(canvas);
        const textMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(0.38, 0.28),
            new THREE.MeshBasicMaterial({ map: textTexture, transparent: true, opacity: 0.8 })
        );
        textMesh.rotation.x = -Math.PI / 2;
        textMesh.position.y = 0.006;
        newspaper.add(textMesh);

        newspaper.position.set(x, y, z);
        newspaper.rotation.y = 0.2;
        this.root.add(newspaper);
        this.interactiveObjects.push(newspaper);
    }

    createFridge(x, y, z) {
        const width = 0.9;
        const height = 1.9;
        const depth = 0.8;
        
        const group = new THREE.Group();
        group.position.set(x, y + height/2, z);
        this.root.add(group);
        
        // --- Hyper-Realistic Materials ---
        const brushedSteelMat = new THREE.MeshStandardMaterial({ 
            color: 0x888888, 
            metalness: 1.0, 
            roughness: 0.25,
            name: 'BrushedSteel'
        });
        
        const darkInteriorMat = new THREE.MeshStandardMaterial({ 
            color: 0x111111,
            roughness: 0.9
        });

        // --- Main Chassis ---
        // Side walls, top, and bottom
        const thick = 0.05;
        const chassis = new THREE.Group();
        
        const leftWall = new THREE.Mesh(new THREE.BoxGeometry(thick, height, depth), brushedSteelMat);
        leftWall.position.x = -width/2 + thick/2;
        
        const rightWall = new THREE.Mesh(new THREE.BoxGeometry(thick, height, depth), brushedSteelMat);
        rightWall.position.x = width/2 - thick/2;
        
        const topWall = new THREE.Mesh(new THREE.BoxGeometry(width, thick, depth), brushedSteelMat);
        topWall.position.y = height/2 - thick/2;

        const bottomWall = new THREE.Mesh(new THREE.BoxGeometry(width, thick, depth), brushedSteelMat);
        bottomWall.position.y = -height/2 + thick/2;
        
        const backWall = new THREE.Mesh(new THREE.BoxGeometry(width, height, thick), brushedSteelMat);
        backWall.position.z = -depth/2 + thick/2;
        
        chassis.add(leftWall, rightWall, topWall, bottomWall, backWall);
        group.add(chassis);
        this.colliders.push(leftWall, rightWall, backWall, bottomWall);

        // Kickplate (Front base)
        const kickplate = new THREE.Mesh(new THREE.BoxGeometry(width - 0.02, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0x111111 }));
        kickplate.position.set(0, -height/2 + 0.05, depth/2 - 0.05);
        group.add(kickplate);

        // --- Interior Light System ---
        this.fridgeLight = new THREE.PointLight(0xe0f0ff, 0, 3);
        this.fridgeLight.position.set(0, height/2 - 0.2, 0.2);
        group.add(this.fridgeLight);

        // --- Shelves & Content ---
        const glassShelfMat = new THREE.MeshStandardMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.15,
            roughness: 0,
            metalness: 0.9
        });

        for(let i=1; i<4; i++) {
            const shelf = new THREE.Mesh(
                new THREE.BoxGeometry(width - thick*2, 0.015, depth - thick*2),
                glassShelfMat
            );
            shelf.position.y = -height/2 + i * 0.4;
            group.add(shelf);
        }

        const createRottenFruit = (type, px, py, pz) => {
            const fruit = new THREE.Group();
            fruit.position.set(px, py, pz);
            
            if (type === 'apple') {
                const body = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshStandardMaterial({color: 0x331100}));
                body.scale.set(1.1, 0.9, 1);
                const fuzz = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), new THREE.MeshStandardMaterial({color: 0x889988, roughness: 1}));
                fuzz.position.set(0.02, 0.03, 0.01);
                fruit.add(body, fuzz);
            } else if (type === 'orange') {
                const body = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshStandardMaterial({color: 0x552200}));
                body.scale.set(0.8, 0.7, 0.8); // Shriveled
                const mold = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), new THREE.MeshStandardMaterial({color: 0x22ffcc, emissive: 0x114433, emissiveIntensity: 0.2}));
                fruit.add(body, mold);
            }
            group.add(fruit);
        };

        createRottenFruit('apple', -0.15, -0.1, 0.1);
        createRottenFruit('orange', 0.2, -0.5, -0.1);

        // --- THE DOOR (Pivot-based) ---
        // Restore Hinge to Right side
        const doorPivot = new InteractiveObject('fridge_door', 'Refrigerator', 'Open', (state) => {
            const opening = !doorPivot.isOpen;
            this.toggleDoor(doorPivot);
            if (this.fridgeLight) this.fridgeLight.intensity = opening ? 2.5 : 0;
            return opening ? "The stench of decay is overwhelming." : null;
        });

        // Door geometry offset relative to pivot
        const doorW = width;
        const doorH = height;
        const doorT = 0.08;
        
        const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, doorT), brushedSteelMat);
        // Offset mesh so its right edge is at the pivot's local (0,0,0)
        doorMesh.position.x = -doorW / 2;
        doorPivot.add(doorMesh);
        doorPivot.colliderMesh = doorMesh;

        // Realistic Handle (Now back on the left side)
        const handle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.015, 0.015, 0.8, 8),
            new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.5, roughness: 0.8 })
        );
        handle.position.set(-doorW + 0.1, 0, doorT/2 + 0.04);
        doorPivot.add(handle);

        const handleMountT = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.04), handle.material);
        handleMountT.position.set(-doorW + 0.1, 0.35, doorT/2 + 0.02);
        doorPivot.add(handleMountT);
        
        const handleMountB = handleMountT.clone();
        handleMountB.position.y = -0.35;
        doorPivot.add(handleMountB);

        // Placement
        // The pivot is placed at the right front corner of the chassis
        doorPivot.closedPos = new THREE.Vector3(x + width/2, y + height/2, z + depth/2);
        doorPivot.closedRotation = 0;
        
        doorPivot.openTransform = {
            position: doorPivot.closedPos.clone(),
            rotation: Math.PI * 0.8 // Swing out right
        };

        doorPivot.position.copy(doorPivot.closedPos);
        doorPivot.rotation.y = doorPivot.closedRotation;
        
        this.root.add(doorPivot);
        this.interactiveObjects.push(doorPivot);
        this.colliders.push(doorMesh);
    }

    createCabinet(id, x, y, z, width, height, depth, rotationY, isDouble = true, hasTop = true) {
        const group = new THREE.Group();
        group.position.set(x, y + height / 2, z);
        group.rotation.y = rotationY;
        this.root.add(group);

        const material = this.materials.wood;
        const cabinetThickness = 0.05;

        // Cabinet Box (Sides, Top, Bottom, Back)
        const leftWall = new THREE.Mesh(new THREE.BoxGeometry(cabinetThickness, height, depth), material);
        leftWall.position.x = -width / 2 + cabinetThickness / 2;
        
        const rightWall = new THREE.Mesh(new THREE.BoxGeometry(cabinetThickness, height, depth), material);
        rightWall.position.x = width / 2 - cabinetThickness / 2;
        
        let topWall = null;
        if (hasTop) {
            topWall = new THREE.Mesh(new THREE.BoxGeometry(width, cabinetThickness, depth), material);
            topWall.position.y = height / 2 - cabinetThickness / 2;
        }
        
        const bottomWall = new THREE.Mesh(new THREE.BoxGeometry(width, cabinetThickness, depth), material);
        bottomWall.position.y = -height / 2 + cabinetThickness / 2;
        
        const backWall = new THREE.Mesh(new THREE.BoxGeometry(width, height, cabinetThickness), material);
        backWall.position.z = -depth / 2 + cabinetThickness / 2;

        if (topWall) {
            group.add(leftWall, rightWall, topWall, bottomWall, backWall);
            this.colliders.push(leftWall, rightWall, topWall, backWall);
        } else {
            group.add(leftWall, rightWall, bottomWall, backWall);
            this.colliders.push(leftWall, rightWall, backWall);
        }

        // Doors
        const doorWidth = isDouble ? width / 2 : width;
        const doorHeight = height;
        const doorThickness = 0.04;

        const createDoor = (isLeft) => {
            const doorId = `${id}_door_${isLeft ? 'l' : 'r'}`;
            const doorObj = new InteractiveObject(doorId, 'Cabinet Door', 'Open', (state) => {
                this.toggleDoor(doorObj);
                return null;
            });

            // Door Panel with Shaker Detail
            const panelGroup = new THREE.Group();
            const mainPanel = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, doorHeight, doorThickness), material);
            panelGroup.add(mainPanel);

            const frameT = 0.01;
            const frameW = 0.08;
            const topF = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, frameW, frameT), material);
            topF.position.set(0, doorHeight/2 - frameW/2, doorThickness/2 + frameT/2);
            const botF = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, frameW, frameT), material);
            botF.position.set(0, -doorHeight/2 + frameW/2, doorThickness/2 + frameT/2);
            const leftF = new THREE.Mesh(new THREE.BoxGeometry(frameW, doorHeight - frameW*2, frameT), material);
            leftF.position.set(-doorWidth/2 + frameW/2, 0, doorThickness/2 + frameT/2);
            const rightF = new THREE.Mesh(new THREE.BoxGeometry(frameW, doorHeight - frameW*2, frameT), material);
            rightF.position.set(doorWidth/2 - frameW/2, 0, doorThickness/2 + frameT/2);
            panelGroup.add(topF, botF, leftF, rightF);

            // Offset panel group for pivot
            panelGroup.position.x = isLeft ? doorWidth / 2 : -doorWidth / 2;
            doorObj.add(panelGroup);
            doorObj.colliderMesh = mainPanel;

            // Knob
            const knob = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), this.materials.metal);
            knob.position.set(isLeft ? doorWidth - 0.05 : -doorWidth + 0.05, 0.2, doorThickness / 2 + 0.03);
            doorObj.add(knob);

            const pivotX = isLeft ? -width / 2 : width / 2;
            const pivotZ = depth / 2;
            const pivotVec = new THREE.Vector3(pivotX, 0, pivotZ).applyEuler(new THREE.Euler(0, rotationY, 0));
            
            doorObj.closedPos = new THREE.Vector3(x, y + height/2, z).add(pivotVec);
            doorObj.closedRotation = rotationY;
            doorObj.openTransform = {
                position: doorObj.closedPos.clone(),
                rotation: rotationY + (isLeft ? -Math.PI * 0.6 : Math.PI * 0.6)
            };

            doorObj.position.copy(doorObj.closedPos);
            doorObj.rotation.y = doorObj.closedRotation;
            this.root.add(doorObj);
            this.interactiveObjects.push(doorObj);
            this.colliders.push(mainPanel);
        };

        if (isDouble) {
            createDoor(true);
            createDoor(false);
        } else {
            createDoor(true);
        }
    }

    createWardrobe(x, y, z, rotationY) {
        const width = 1.2;
        const height = 2.2;
        const depth = 0.7;
        
        const group = new THREE.Group();
        group.position.set(x, y + height/2, z);
        group.rotation.y = rotationY;
        this.root.add(group);
        
        const mat = this.materials.wood;
        const thick = 0.05;

        // Shell
        const back = new THREE.Mesh(new THREE.BoxGeometry(width, height, thick), mat);
        back.position.z = -depth/2 + thick/2;
        group.add(back);
        
        const left = new THREE.Mesh(new THREE.BoxGeometry(thick, height, depth), mat);
        left.position.x = -width/2 + thick/2;
        group.add(left);
        
        const right = new THREE.Mesh(new THREE.BoxGeometry(thick, height, depth), mat);
        right.position.x = width/2 - thick/2;
        group.add(right);
        
        const top = new THREE.Mesh(new THREE.BoxGeometry(width, thick, depth), mat);
        top.position.y = height/2 - thick/2;
        group.add(top);
        
        const bottom = new THREE.Mesh(new THREE.BoxGeometry(width, thick, depth), mat);
        bottom.position.y = -height/2 + thick/2;
        group.add(bottom);

        this.colliders.push(left, right, top, bottom, back);

        // Inside Content: Rod and Clothes
        const rod = new THREE.Mesh(
            new THREE.CylinderGeometry(0.015, 0.015, width - thick*2),
            new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.8, roughness: 0.2 })
        );
        rod.rotation.z = Math.PI / 2;
        rod.position.y = height/2 - 0.25;
        group.add(rod);

        const colors = [0x444444, 0x223344, 0x554433, 0x334422, 0x111111];
        for (let i = 0; i < 6; i++) {
            const clothGroup = new THREE.Group();
            const ox = (i - 2.5) * 0.15;
            clothGroup.position.set(ox, rod.position.y - 0.05, 0);
            
            // Hanger
            const hanger = new THREE.Mesh(
                new THREE.TorusGeometry(0.05, 0.005, 8, 16, Math.PI),
                rod.material
            );
            hanger.rotation.x = Math.PI / 2;
            clothGroup.add(hanger);
            
            // Cloth
            const cloth = new THREE.Mesh(
                new THREE.BoxGeometry(0.05, 0.8, 0.4),
                new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 1.0 })
            );
            cloth.position.y = -0.4;
            clothGroup.add(cloth);
            
            group.add(clothGroup);
        }

        // Doors
        const createWDoor = (isLeft) => {
            const doorW = width / 2;
            const doorObj = new InteractiveObject(`wardrobe_door_${isLeft?'l':'r'}`, 'Dresser Door', 'Open', (state) => {
                this.toggleDoor(doorObj);
                return null;
            });

            const panel = new THREE.Mesh(new THREE.BoxGeometry(doorW, height, 0.05), mat);
            panel.position.x = isLeft ? doorW/2 : -doorW/2;
            doorObj.add(panel);
            doorObj.colliderMesh = panel;

            const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.15), this.materials.metal);
            handle.position.set(isLeft ? doorW - 0.05 : -doorW + 0.05, 0, 0.04);
            doorObj.add(handle);

            const pivotX = isLeft ? -width/2 : width/2;
            const pivotVec = new THREE.Vector3(pivotX, 0, depth/2).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
            
            doorObj.closedPos = new THREE.Vector3(x, y + height/2, z).add(pivotVec);
            doorObj.closedRotation = rotationY;
            doorObj.openTransform = {
                position: doorObj.closedPos.clone(),
                rotation: rotationY + (isLeft ? -Math.PI * 0.7 : Math.PI * 0.7)
            };

            doorObj.position.copy(doorObj.closedPos);
            doorObj.rotation.y = doorObj.closedRotation;
            this.root.add(doorObj);
            this.interactiveObjects.push(doorObj);
            this.colliders.push(panel);
        };

        createWDoor(true);
        createWDoor(false);
    }

    createPantry(x, y, z) {
        const pantryWidth = 1.0;
        const pantryHeight = 2.4;
        const pantryDepth = 0.6;
        
        const group = new THREE.Group();
        group.position.set(x, y + pantryHeight/2, z);
        this.root.add(group);
        
        // Pantry Shell (Back and Sides)
        const shellMat = this.materials.wood;
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.1, pantryHeight, pantryWidth), shellMat);
        back.position.set(pantryDepth/2, 0, 0);
        group.add(back);
        
        const side1 = new THREE.Mesh(new THREE.BoxGeometry(pantryDepth, pantryHeight, 0.1), shellMat);
        side1.position.set(0, 0, pantryWidth/2);
        group.add(side1);
        
        const side2 = new THREE.Mesh(new THREE.BoxGeometry(pantryDepth, pantryHeight, 0.1), shellMat);
        side2.position.set(0, 0, -pantryWidth/2);
        group.add(side2);

        this.colliders.push(back, side1, side2);

        // Shelves
        const shelfGeo = new THREE.BoxGeometry(pantryDepth - 0.1, 0.05, pantryWidth - 0.1);
        for(let i=1; i<4; i++) {
            const shelf = new THREE.Mesh(shelfGeo, shellMat);
            shelf.position.set(-0.05, -pantryHeight/2 + i * 0.6, 0);
            group.add(shelf);
            this.colliders.push(shelf);
        }

        // Pantry Doors
        const createPantryDoor = (isLeft) => {
            const doorW = pantryWidth / 2;
            const doorH = pantryHeight;
            const doorT = 0.05;
            
            const doorObj = new InteractiveObject(`pantry_door_${isLeft?'l':'r'}`, 'Pantry Door', 'Open', (state) => {
                this.toggleDoor(doorObj);
                return null;
            });

            // Pivot-based hinge: pivot is at the outer edge
            const panel = new THREE.Mesh(new THREE.BoxGeometry(doorT, doorH, doorW), shellMat);
            // Offset panel so pivot is at the outer edge (hinge)
            panel.position.z = isLeft ? -doorW / 2 : doorW / 2;
            doorObj.add(panel);
            doorObj.colliderMesh = panel;

            // Knob - near the inner edge
            const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), this.materials.metal);
            // inner edge is at +doorW/2 for left door (if panel z is -doorW/2)
            // Wait, if panel.z = -doorW/2, the panel spans -doorW to 0.
            // Inner edge is at -doorW.
            // No, if panel.z = -doorW/2, local z=0 of doorObj is the hinge. 
            // The panel spans local z from -doorW to 0. 
            // Inner edge is at -doorW.
            knob.position.set(-doorT, -0.1, isLeft ? -doorW + 0.05 : doorW - 0.05);
            doorObj.add(knob);

            doorObj.closedPos = { 
                x: x - pantryDepth / 2, 
                y: y + pantryHeight / 2, 
                z: z + (isLeft ? pantryWidth / 2 : -pantryWidth / 2) 
            };
            doorObj.closedRotation = 0;
            
            // Swing open 120 degrees
            doorObj.openTransform = {
                position: new THREE.Vector3(doorObj.closedPos.x, doorObj.closedPos.y, doorObj.closedPos.z),
                rotation: isLeft ? Math.PI * 0.7 : -Math.PI * 0.7
            };

            doorObj.position.copy(doorObj.closedPos);
            this.root.add(doorObj);
            this.interactiveObjects.push(doorObj);
            this.colliders.push(panel);
        };

        createPantryDoor(true);
        createPantryDoor(false);

        // Cereal Box (Inside on the second shelf)
        const cerealBox = new InteractiveObject('cereal_box', 'Cereal Box', 'Search', (state) => {
            return 'Just some stale cereal left.';
        });

        const boxMesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 0.3, 0.1),
            new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.8 }) // Colorful box
        );
        cerealBox.add(boxMesh);
        cerealBox.position.set(x - 0.1, y + 1.2 + 0.15, z + 0.2); // On second shelf
        this.root.add(cerealBox);
        this.interactiveObjects.push(cerealBox);
    }

    createDoorwayWall(width, height, thickness, x, y, z, rotationY = 0, material = this.materials.houseWall) {
        // Creates a wall with a standard door opening (1m wide, 2.2m high) in the center
        const doorWidth = 1.0;
        const doorHeight = 2.2;
        
        const sideWidth = (width - doorWidth) / 2;
        const topHeight = height - doorHeight;

        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.rotation.y = rotationY;

        // Materials (default to wall material, but we can parameterize if needed)
        const mat = material; 

        // Left Panel
        const left = new THREE.Mesh(new THREE.BoxGeometry(sideWidth, height, thickness), mat);
        left.position.set(-width/2 + sideWidth/2, height/2, 0);
        group.add(left);
        this.colliders.push(left);

        // Right Panel
        const right = new THREE.Mesh(new THREE.BoxGeometry(sideWidth, height, thickness), mat);
        right.position.set(width/2 - sideWidth/2, height/2, 0);
        group.add(right);
        this.colliders.push(right);

        // Top Panel (Header)
        const top = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, topHeight, thickness), mat);
        top.position.set(0, height - topHeight/2, 0);
        group.add(top);
        this.colliders.push(top);

        this.root.add(group);
    }

    createRoom(x, y, z, width, height, depth, type, openWalls = []) {
        const wallThickness = 0.2;
        
        // Select Materials based on room type
        let wallMaterial = this.materials.wall;
        let floorMaterial = this.materials.floor;
        
        if (type === 'hallway' || type === 'living' || type === 'kitchen') {
            wallMaterial = this.materials.houseWall;
            floorMaterial = this.materials.houseFloor;
            if (type === 'kitchen') {
                 // Maybe use tile for kitchen later?
            }
        } else if (type === 'bedroom') {
            wallMaterial = this.materials.bedroomWall;
            floorMaterial = this.materials.houseFloor;
        }

        // Helper to create simple solid wall
        const createWall = (w, h, d, px, py, pz) => {
            const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMaterial);
            wall.position.set(px, py, pz);
            this.root.add(wall);
            this.colliders.push(wall);
            return wall;
        };

        // Floor - Top surface is at the passed 'y' coordinate
        const floor = new THREE.Mesh(new THREE.BoxGeometry(width, wallThickness, depth), floorMaterial);
        floor.position.set(x, y - wallThickness / 2, z);
        floor.receiveShadow = true;
        this.root.add(floor);
        this.floors.push(floor);

        // Ceiling
        const ceiling = new THREE.Mesh(new THREE.BoxGeometry(width, wallThickness, depth), this.materials.ceiling);
        ceiling.position.set(x, y + height + wallThickness / 2, z);
        this.root.add(ceiling);

        // --- Wall Generation with "Open" support ---
        // Front (Z + depth/2)
        if (!openWalls.includes('front')) {
            if (type === 'bathroom') { // Special bathroom door logic preserved
                 // This is the wall connecting to hallway
                 // Handled manually in old code, let's keep the manual logic for bathroom specific geometry
                 // Wait, this function IS the manual logic.
                 // Bathroom: Front is towards positive Z. Back is towards negative Z (Hallway).
                 // Actually in build(): Bathroom is at 0, Hallway is at -7.5.
                 // Bathroom Back Wall (z-2.5) connects to Hallway Front Wall (z-2.5).
            }
            createWall(width, height, wallThickness, x, y + height/2, z + depth/2);
        }

        // Back (Z - depth/2)
        if (!openWalls.includes('back')) {
            if (type === 'bathroom') {
                // Bathroom Back Wall has the door connecting to Hallway
                // We split this into two thinner walls back-to-back to support different textures
                // 1. Inner (Bathroom side) - Tiles
                this.createDoorwayWall(width, height, wallThickness/2, x, y, (z - depth/2) + wallThickness/4, 0, this.materials.wall);
                
                // 2. Outer (Hallway side) - Plaster
                this.createDoorwayWall(width, height, wallThickness/2, x, y, (z - depth/2) - wallThickness/4, 0, this.materials.houseWall);
            } else {
                createWall(width, height, wallThickness, x, y + height/2, z - depth/2);
            }
        }

        // Left (X - width/2)
        if (!openWalls.includes('left')) {
            createWall(wallThickness, height, depth, x - width/2, y + height/2, z);
        }

        // Right (X + width/2)
        if (!openWalls.includes('right')) {
             createWall(wallThickness, height, depth, x + width/2, y + height/2, z);
        }
    }

    addBathroomFurniture() {
        const sinkGroup = new THREE.Group();
        // Position it closer to the wall (Z=2.5 is the wall)
        // Face it towards the room (rotated 180 deg)
        sinkGroup.position.set(-1.8, 0, 2.1); 
        sinkGroup.rotation.y = Math.PI; 
        this.root.add(sinkGroup);

        const porcelainMat = this.materials.porcelain;
        const metalMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 1.0, roughness: 0.05 });
        const waterMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.4, emissive: 0x224466 });

        // 1. Sink Counter/Slab (Hollowed out to show the basin)
        const slabWidth = 1.0;
        const slabDepth = 0.55;
        const slabHeight = 0.12;
        const counterY = 0.85;

        const slabGroup = new THREE.Group();
        slabGroup.position.y = counterY;
        sinkGroup.add(slabGroup);

        // Build the slab from 4 pieces (Sides)
        const sideW = 0.15;
        const frontD = 0.05;

        const createSlabPart = (w, h, d, px, pz) => {
            const part = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), porcelainMat);
            part.position.set(px, 0, pz);
            slabGroup.add(part);
            this.colliders.push(part);
        };

        // Outer box walls
        createSlabPart(sideW, slabHeight, slabDepth, -slabWidth/2 + sideW/2, 0);
        createSlabPart(sideW, slabHeight, slabDepth, slabWidth/2 - sideW/2, 0);
        createSlabPart(slabWidth - sideW * 2, slabHeight, frontD, 0, -slabDepth/2 + frontD/2);
        createSlabPart(slabWidth - sideW * 2, slabHeight, frontD, 0, slabDepth/2 - frontD/2);

        // --- Top Deck with Elliptical Cutout ---
        // This fills the corners between the rectangular slab and the round basin
        const topShape = new THREE.Shape();
        topShape.moveTo(-slabWidth/2, -slabDepth/2);
        topShape.lineTo(slabWidth/2, -slabDepth/2);
        topShape.lineTo(slabWidth/2, slabDepth/2);
        topShape.lineTo(-slabWidth/2, slabDepth/2);
        topShape.lineTo(-slabWidth/2, -slabDepth/2);

        // The Cutout (matches basin rim: radius 0.35x0.28)
        const holePath = new THREE.Path();
        holePath.absellipse(0, 0, 0.35, 0.28, 0, Math.PI * 2, true);
        topShape.holes.push(holePath);

        const topGeo = new THREE.ShapeGeometry(topShape);
        const topDeck = new THREE.Mesh(topGeo, porcelainMat);
        topDeck.rotation.x = -Math.PI / 2;
        topDeck.position.y = slabHeight / 2;
        slabGroup.add(topDeck);

        // Backsplash
        const backsplash = new THREE.Mesh(
            new THREE.BoxGeometry(slabWidth, 0.15, 0.05),
            porcelainMat
        );
        backsplash.position.set(0, 0.1, -slabDepth / 2 + 0.025);
        slabGroup.add(backsplash);

        // 2. Recessed Basin (Ultra-Smooth)
        const basinInner = new THREE.Mesh(
            new THREE.SphereGeometry(0.35, 32, 24, 0, Math.PI * 2, 0, Math.PI / 2),
            new THREE.MeshStandardMaterial({ 
                color: 0xf8f8f8, 
                roughness: 0.1, 
                metalness: 0.2, 
                side: THREE.DoubleSide 
            })
        );
        basinInner.scale.set(1, 0.5, 0.8); 
        basinInner.rotation.x = Math.PI; 
        basinInner.position.set(0, slabHeight / 2, 0); // Flush with top deck
        slabGroup.add(basinInner);

        // Overflow Hole Detail
        const overflow = new THREE.Mesh(
            new THREE.CircleGeometry(0.015, 16),
            new THREE.MeshBasicMaterial({ color: 0x111111 })
        );
        overflow.position.set(0, -0.05, -0.2); // On the back inner wall
        slabGroup.add(overflow);

        // 3. Drain Details
        const drain = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.01, 16), metalMat);
        drain.position.set(0, -0.12, 0);
        slabGroup.add(drain);

        // 4. Plumbing (P-Trap) - Visible under the sink
        const pTrapGroup = new THREE.Group();
        pTrapGroup.position.set(0, counterY - 0.15, 0);
        const pipeRadius = 0.02;
        const vPipe = new THREE.Mesh(new THREE.CylinderGeometry(pipeRadius, pipeRadius, 0.15), metalMat);
        vPipe.position.y = -0.075;
        pTrapGroup.add(vPipe);
        
        const uBend = new THREE.Mesh(new THREE.TorusGeometry(0.05, pipeRadius, 12, 24, Math.PI), metalMat);
        uBend.position.set(0.05, -0.15, 0);
        uBend.rotation.z = Math.PI;
        pTrapGroup.add(uBend);
        
        const hPipeWall = new THREE.Mesh(new THREE.CylinderGeometry(pipeRadius, pipeRadius, 1.0), metalMat);
        hPipeWall.rotation.x = Math.PI / 2;
        hPipeWall.position.set(0.1, -0.15, -0.5); // Fixed pipe direction to go INTO the wall
        pTrapGroup.add(hPipeWall);
        sinkGroup.add(pTrapGroup);

        // 5. Minimalist Segmented Swan-Neck Faucet
        const faucetGroup = new THREE.Group();
        faucetGroup.position.set(0, counterY + 0.06, -0.18);
        
        const bRiser = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.22, 24), metalMat);
        bRiser.position.y = 0.11;
        faucetGroup.add(bRiser);

        const bJoint1 = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 16), metalMat);
        bJoint1.position.y = 0.22;
        faucetGroup.add(bJoint1);

        const bArm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 24), metalMat);
        bArm.rotation.x = Math.PI / 2;
        bArm.position.set(0, 0.22, 0.09);
        faucetGroup.add(bArm);

        const bJoint2 = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 16), metalMat);
        bJoint2.position.set(0, 0.22, 0.18);
        faucetGroup.add(bJoint2);

        const bTip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.015, 0.06, 24), metalMat);
        bTip.position.set(0, 0.19, 0.18);
        faucetGroup.add(bTip);

        // Drain Pop-up Lever (behind the faucet)
        const drainLever = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.08), metalMat);
        drainLever.position.set(0, 0.04, -0.05);
        faucetGroup.add(drainLever);

        const bWater = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.25), waterMat);
        bWater.position.set(0, 0.02, 0.18);
        bWater.visible = false;
        faucetGroup.add(bWater);

        // Interactive Hot/Cold Handles with Audio
        let hotHandle, coldHandle;
        const updateBathroomWater = () => {
            const isAnyOpen = hotHandle?.isOpen || coldHandle?.isOpen;
            bWater.visible = isAnyOpen;
        };

        const createHandle = (isHot) => {
            const hId = `bath_handle_${isHot ? 'hot' : 'cold'}`;
            const hObj = new InteractiveObject(hId, `${isHot ? 'Hot' : 'Cold'} Tap`, 'Turn Tap', (state) => {
                hObj.isOpen = !hObj.isOpen;
                // Animate handle rotation
                const targetRot = hObj.isOpen ? Math.PI / 2 : 0;
                this.addAnimation((dt) => {
                    const step = 5 * dt;
                    if (Math.abs(hObj.rotation.y - targetRot) < step) {
                        hObj.rotation.y = targetRot;
                        return false;
                    }
                    hObj.rotation.y += Math.sign(targetRot - hObj.rotation.y) * step;
                    return true;
                });

                this.toggleWaterSound(hObj.isOpen);
                updateBathroomWater();
                return null;
            });
            // Wider spacing and slightly raised to ensure interactability
            hObj.position.x = isHot ? -0.25 : 0.25;
            hObj.position.y = 0.02; 
            
            const hb = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.04), metalMat);
            hObj.add(hb);
            const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.012, 0.012), metalMat);
            cross1.position.y = 0.04;
            hObj.add(cross1);
            const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.12), metalMat);
            cross2.position.y = 0.04;
            hObj.add(cross2);

            // Add a larger interaction proxy for handles
            const hProxy = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), new THREE.MeshBasicMaterial({ visible: false }));
            hProxy.position.y = 0.04;
            hObj.add(hProxy);

            this.interactiveObjects.push(hObj);
            return hObj;
        };

        hotHandle = createHandle(true);
        coldHandle = createHandle(false);
        faucetGroup.add(hotHandle);
        faucetGroup.add(coldHandle);
        sinkGroup.add(faucetGroup);

        // 6. Soap Dispenser (Luxury Design) - Now Interactive
        const soapDispenser = new InteractiveObject('soap_dispenser', 'Soap Dispenser', 'Use Soap', (state) => {
            state.speak("The soap is cold and smells like antiseptic.");
            return null;
        });
        // Move to the right of the right (cold) handle. 
        // Right handle is at x=0.25 relative to faucetGroup.
        // We'll place it at x=0.45, z=-0.15 relative to sink center.
        soapDispenser.position.set(0.45, counterY + 0.06, -0.15); 
        
        const soapBody = new THREE.Mesh(
            new THREE.CylinderGeometry(0.04, 0.045, 0.12, 16),
            new THREE.MeshStandardMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.8, roughness: 0.1 })
        );
        soapDispenser.add(soapBody);
        
        const soapNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.02), metalMat);
        soapNeck.position.y = 0.07;
        soapDispenser.add(soapNeck);
        
        const pump = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.06), metalMat);
        pump.position.set(0, 0.08, 0.02);
        soapDispenser.add(pump);
        
        // Add a proxy for easier interaction
        const soapProxy = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.25, 0.15), new THREE.MeshBasicMaterial({ visible: false }));
        soapDispenser.add(soapProxy);

        sinkGroup.add(soapDispenser);
        this.interactiveObjects.push(soapDispenser);

        // Ultra-Realistic Mirror
        this.createMirror(-1.8, 2.0, 2.35, 1.0, 1.4, Math.PI);

        // Ultra-Realistic Toilet
        this.createToilet(1.5, 0, 1.95, Math.PI);

        // High-Fidelity Realistic Shower Assembly
        const showerGroup = new THREE.Group();
        // Tucked into the corner (X=2.5, Z=-2.5)
        // Room width 5, depth 5.
        const trayWidth = 1.1;
        const trayDepth = 1.8;
        const trayHeight = 0.15;
        
        // Position: Right side of the bathroom (X+), near the back wall (Z-)
        // Center calculation: X = 2.5 - 0.55 = 1.95. Z = -2.5 + 0.9 = -1.6.
        showerGroup.position.set(1.95, 0, -1.6);
        this.root.add(showerGroup);

        const glassMat = this.materials.glass;
        const chromeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1.0, roughness: 0.1 });
        const groutMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 1.0 });
        const floorTileMat = new THREE.MeshStandardMaterial({ 
            color: 0x888888, 
            map: this.textureLoader.load(ASSETS.CONCRETE_TEXTURE), 
            roughness: 0.8 
        });

        // 1. Shower Tray (Base)
        const tray = new THREE.Mesh(new THREE.BoxGeometry(trayWidth, trayHeight, trayDepth), porcelainMat);
        tray.position.y = trayHeight / 2;
        showerGroup.add(tray);
        this.floors.push(tray); // Allow walking on the tray base/rim
        
        // Use rims instead of a solid box for the tray collider so player can step inside
        const rimThickness = 0.05;
        const rimHeight = trayHeight + 0.05;
        const rimLeft = new THREE.Mesh(new THREE.BoxGeometry(rimThickness, rimHeight, trayDepth), new THREE.MeshBasicMaterial({visible:false}));
        rimLeft.position.set(-trayWidth/2 + rimThickness/2, rimHeight/2, 0);
        showerGroup.add(rimLeft);
        // this.colliders.push(rimLeft); // Removed to allow player to enter shower when door is open

        const rimRight = new THREE.Mesh(new THREE.BoxGeometry(rimThickness, rimHeight, trayDepth), new THREE.MeshBasicMaterial({visible:false}));
        rimRight.position.set(trayWidth/2 - rimThickness/2, rimHeight/2, 0);
        showerGroup.add(rimRight);
        this.colliders.push(rimRight);

        const rimBack = new THREE.Mesh(new THREE.BoxGeometry(trayWidth, rimHeight, rimThickness), new THREE.MeshBasicMaterial({visible:false}));
        rimBack.position.set(0, rimHeight/2, -trayDepth/2 + rimThickness/2);
        showerGroup.add(rimBack);
        this.colliders.push(rimBack);

        const rimFront = new THREE.Mesh(new THREE.BoxGeometry(trayWidth, rimHeight, rimThickness), new THREE.MeshBasicMaterial({visible:false}));
        rimFront.position.set(0, rimHeight/2, trayDepth/2 - rimThickness/2);
        showerGroup.add(rimFront);
        // Don't add front rim to colliders initially? No, we need it to block. 
        // Wait, if the door is open, the player needs to enter. 
        // Actually, the tray rim is usually something you can step over. 
        // But Three.js simple collision doesn't "step over".
        // I'll make the rims very low or just not have a front rim collider.
        // Most showers have a small lip. Let's make the front rim collider very thin or absent.
        
        // Shower floor (inner tiled part)
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(trayWidth - 0.1, trayDepth - 0.1), floorTileMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = trayHeight + 0.001;
        showerGroup.add(floor);
        this.floors.push(floor);

        // 2. Glass Enclosure
        const glassHeight = 2.2;
        const frameThick = 0.04;
        
        // Glass on the inner side (facing the bathroom center)
        const innerSideX = -trayWidth / 2;
        
        // Fixed Pane (Back half - against the wall)
        const fixedGlass = new THREE.Mesh(new THREE.BoxGeometry(0.02, glassHeight, trayDepth / 2), glassMat);
        fixedGlass.position.set(innerSideX, glassHeight / 2 + trayHeight, -trayDepth / 4);
        showerGroup.add(fixedGlass);
        this.colliders.push(fixedGlass);

        // Sliding Door (Front half)
        const doorDepth = trayDepth / 2;
        const showerDoor = new InteractiveObject('shower_door', 'Shower Door', 'Slide Door', (state) => {
            this.toggleDoor(showerDoor);
            return null;
        });
        
        const glassDoor = new THREE.Mesh(new THREE.BoxGeometry(0.02, glassHeight, doorDepth), glassMat);
        glassDoor.material = glassDoor.material.clone();
        glassDoor.material.opacity = 0.3;
        showerDoor.add(glassDoor);
        showerDoor.colliderMesh = glassDoor;

        // Handle for sliding door
        const hBar = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 12), chromeMat);
        hBar.position.set(-0.03, 0, doorDepth / 2 - 0.1);
        showerDoor.add(hBar);
        
        const hMountT = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.02), chromeMat);
        hMountT.position.set(-0.015, 0.2, doorDepth / 2 - 0.1);
        showerDoor.add(hMountT);
        const hMountB = hMountT.clone();
        hMountB.position.y = -0.2;
        showerDoor.add(hMountB);

        // Position door in closed state (Front)
        showerDoor.closedPos = new THREE.Vector3(innerSideX - 0.02, glassHeight / 2 + trayHeight, trayDepth / 4);
        showerDoor.closedRotation = 0;
        
        // Open position: Slide back behind fixed pane
        showerDoor.openTransform = {
            position: new THREE.Vector3(innerSideX - 0.02, glassHeight / 2 + trayHeight, -trayDepth / 2 + doorDepth / 2),
            rotation: 0
        };

        showerDoor.position.copy(showerDoor.closedPos);
        showerGroup.add(showerDoor);
        this.interactiveObjects.push(showerDoor);
        this.colliders.push(glassDoor);

        // Front Glass (facing the bathroom front)
        const frontGlass = new THREE.Mesh(new THREE.BoxGeometry(trayWidth, glassHeight, 0.02), glassMat);
        frontGlass.position.set(0, glassHeight / 2 + trayHeight, trayDepth / 2);
        showerGroup.add(frontGlass);
        this.colliders.push(frontGlass);

        // Chrome Frames
        const frameTop = new THREE.Mesh(new THREE.BoxGeometry(frameThick, frameThick, trayDepth), chromeMat);
        frameTop.position.set(innerSideX, glassHeight + trayHeight, 0);
        showerGroup.add(frameTop);

        const frameVertFront = new THREE.Mesh(new THREE.BoxGeometry(frameThick, glassHeight, frameThick), chromeMat);
        frameVertFront.position.set(innerSideX, glassHeight / 2 + trayHeight, trayDepth / 2);
        showerGroup.add(frameVertFront);

        // 3. Shower Fixtures (Close to the back wall at Z = -2.5)
        // Fixture pipe and head
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.0), chromeMat);
        pipe.position.set(-0.2, 1.2 + trayHeight, -trayDepth / 2 + 0.05); // Fixed rod position
        showerGroup.add(pipe);

        const headArm = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.4), chromeMat);
        headArm.rotation.x = Math.PI / 2;
        headArm.position.set(-0.2, 2.2 + trayHeight, -trayDepth / 2 + 0.3); 
        showerGroup.add(headArm);

        const head = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.04, 32), chromeMat);
        head.position.set(-0.2, 2.2 + trayHeight - 0.02, -trayDepth / 2 + 0.5); 
        showerGroup.add(head);

        // Water Effect
        this.showerWaterSystem = new ShowerWater(600);
        this.showerWaterSystem.group.position.set(-0.2, 2.16 + trayHeight, -trayDepth / 2 + 0.5); 
        showerGroup.add(this.showerWaterSystem.group);

        // Mixing valve - ATTACHED TO ROD
        const valve = new InteractiveObject('shower_valve', 'Shower Valve', 'Turn On', (state) => {
            valve.isOpen = !valve.isOpen;
            this.toggleWaterSound(valve.isOpen);
            if (this.showerWaterSystem) {
                this.showerWaterSystem.active = valve.isOpen;
            }
            valve.promptText = valve.isOpen ? "Turn Off" : "Turn On";
            return null;
        });
        valve.position.set(-0.2, 1.1 + trayHeight, -trayDepth / 2 + 0.08); // Attached to rod
        
        const valvePlate = new THREE.Mesh(new THREE.CircleGeometry(0.1, 32), chromeMat);
        valve.add(valvePlate);
        
        const handleHub = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05), chromeMat);
        handleHub.rotation.x = Math.PI / 2;
        valve.add(handleHub);
        
        const handleLever = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.15, 0.02), chromeMat);
        handleLever.position.set(0, 0.06, 0.03); // Lever sticks out and up
        valve.add(handleLever);
        
        showerGroup.add(valve);
        this.interactiveObjects.push(valve);

        // Drain
        const showerDrain = new THREE.Mesh(new THREE.CircleGeometry(0.05, 16), groutMat);
        showerDrain.rotation.x = -Math.PI / 2;
        showerDrain.position.y = trayHeight + 0.002;
        showerDrain.position.z = -trayDepth / 2 + 0.5;
        showerGroup.add(showerDrain);
    }

    addHallwayFurniture() {
        for(let i=0; i<3; i++) {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), this.materials.wood);
            mesh.position.set(1, 0.25, -6 - i);
            this.root.add(mesh);
            this.colliders.push(mesh);
        }
    }

    startWinSequence() {
        this.winSequenceActive = true;
        this.winTimer = 0;
        this.carDriveSpeed = 0;
    }

    update(deltaTime, playerPos, flashlightParams = null) {
        // Handle active animations
        // Use a backwards loop to safely splice dead animations while allowing new ones to be added
        if (this.activeAnimations) {
            for (let i = this.activeAnimations.length - 1; i >= 0; i--) {
                const anim = this.activeAnimations[i];
                // Check if animation exists (in case of index shift, though splice handles this safely downwards)
                if (anim) {
                    const keep = anim(deltaTime);
                    if (!keep) {
                        this.activeAnimations.splice(i, 1);
                    }
                }
            }
        }

        // Update Dust Systems
        if (this.dustSystems) {
            this.dustSystems.forEach(dust => dust.update(deltaTime));
        }

        // Update Shower Water
        if (this.showerWaterSystem) {
            this.showerWaterSystem.update(deltaTime);
        }

        // Update Fan
        if (this.isFanOn && this.fanBlades) {
            this.fanBlades.rotation.y -= deltaTime * 2.5; // Slower rotation (was 5.0)
        }

        // Update Bead Curtain
        if (this.beadCurtain) {
            this.beadCurtain.update(deltaTime, playerPos, this.poolAudio);
        }

        // Portrait Proximity Trigger
        if (playerPos && this.portraitObject && !this.portraitTriggered) {
            const dist = playerPos.distanceTo(this.portraitObject.position);
            if (dist < 2.5) {
                this.portraitTriggered = true;
                this.triggerPortraitFall();
            }
        }
        
        // Update Pool Physics
        this.updatePoolPhysics();

        // Win Sequence Animation
        if (this.winSequenceActive && this.carObject) {
            this.winTimer += deltaTime;
            
            // Wait 1.5 seconds for the engine to "crank" and start
            if (this.winTimer > 1.5) {
                // Accelerate
                this.carDriveSpeed = Math.min(this.carDriveSpeed + deltaTime * 8, 25);
                
                // Drive away from house (House is at z=0 to -24, car at -42. Drive to -100)
                const direction = new THREE.Vector3(0, 0, -1); 
                this.carObject.position.addScaledVector(direction, this.carDriveSpeed * deltaTime);
                
                // Spin wheels
                if (this.carWheels) {
                    this.carWheels.forEach(wheel => {
                        wheel.rotation.x += this.carDriveSpeed * deltaTime * 3.0; 
                    });
                }
            }
        }

        // Update Rat
        if (this.rat) {
            this.rat.update(deltaTime);
            
            // Proximity Trigger for Rat: Hallway Flashlight is at (0, 0.15, -7.5)
            if (playerPos && !this.rat.triggered && !this.rat.despawned) {
                const flashlightPos = new THREE.Vector3(0, 0.15, -7.5);
                const distToFlashlight = playerPos.distanceTo(flashlightPos);
                if (distToFlashlight < 3.5) {
                    this.rat.trigger();
                }
            }
        }

        // Trigger Check for Hallway Door Reveal
        if (playerPos && !this.bedroomDoorRevealed) {
             // Hallway ends at z = -12.5. Living room starts.
             // If player enters Living Room (z < -13.5 to be safe)
             if (playerPos.z < -13.5) {
                 this.bedroomDoorRevealed = true;
                 this.updateHallwayWall();
             }
        }
    }

    triggerPortraitFall() {
        const startY = this.portraitObject.position.y;
        const targetY = 0.5; // Height on floor
        let fallTime = 0;
        const duration = 0.4;

        this.addAnimation((dt) => {
            fallTime += dt;
            const t = Math.min(fallTime / duration, 1.0);
            
            // Gravity-like fall
            this.portraitObject.position.y = startY - (startY - targetY) * (t * t);
            
            // Tilt while falling
            this.portraitObject.rotation.x = t * (Math.PI / 2.5);
            
            if (t >= 1.0) {
                // Sound: Glass Break
                if (this.poolAudio && this.poolAudio.glassBreak) {
                    this.poolAudio.glassBreak.triggerAttackRelease("1n");
                }
                
                // Visual Shards
                this.createGlassShards(this.portraitObject.position);
                
                return false; // Stop animation
            }
            return true;
        });
    }

    createGlassShards(pos) {
        const shardGeo = new THREE.PlaneGeometry(0.1, 0.1);
        const shardMat = this.materials.glass;
        
        for (let i = 0; i < 8; i++) {
            const shard = new THREE.Mesh(shardGeo, shardMat);
            shard.position.copy(pos);
            shard.position.y = 0.11; // On floor
            shard.position.x += (Math.random() - 0.5) * 0.5;
            shard.position.z += (Math.random() - 0.5) * 0.5;
            shard.rotation.x = -Math.PI / 2;
            shard.rotation.z = Math.random() * Math.PI;
            shard.scale.setScalar(0.5 + Math.random() * 1.0);
            this.root.add(shard);
        }
    }

    addAnimation(callback) {
        if (!this.activeAnimations) this.activeAnimations = [];
        this.activeAnimations.push(callback);
    }

    updateHallwayWall() {
        // Cleanup existing
        if (this.hallwayWallGroup) {
            this.root.remove(this.hallwayWallGroup);
            // Remove its colliders
            if (this.hallwayWallColliders) {
                this.colliders = this.colliders.filter(c => !this.hallwayWallColliders.includes(c));
            }
        }

        this.hallwayWallGroup = new THREE.Group();
        this.hallwayWallColliders = [];

        // Dual-sided Material Array for BoxGeometry
        // Index: 0:Px, 1:Nx, 2:Py, 3:Ny, 4:Pz(Front), 5:Nz(Back)
        // Wall is rotated 90 deg (Y). 
        // Local Z+ faces Global X+ (Hallway). 
        // Local Z- faces Global X- (Bedroom).
        const dualMat = [
            this.materials.houseWall, // Right Edge
            this.materials.houseWall, // Left Edge
            this.materials.houseWall, // Top Edge
            this.materials.houseWall, // Bottom Edge
            this.materials.houseWall, // Front (Hallway Side)
            this.materials.bedroomWall // Back (Bedroom Side)
        ];

        if (!this.bedroomDoorRevealed) {
            // Solid Wall
            // x=-1.5, z=-7.5, width=10, height=3.5, rotY=PI/2
            const wall = new THREE.Mesh(
                new THREE.BoxGeometry(10, 3.5, 0.2),
                dualMat
            );
            wall.position.set(-1.5, 1.75, -7.5);
            wall.rotation.y = Math.PI / 2;
            
            this.hallwayWallGroup.add(wall);
            this.hallwayWallColliders.push(wall);
            this.colliders.push(wall);
            
            // Hide Door
            if (this.bedroomDoorObject) {
                this.bedroomDoorObject.visible = false;
                this.bedroomDoorObject.isInteractive = false;
                // Also remove door panel collider if it was somehow added
                if (this.bedroomDoorPanel) {
                     this.colliders = this.colliders.filter(c => c !== this.bedroomDoorPanel);
                }
            }
        } else {
            // Doorway Wall
            // Reuse logic roughly matching createDoorwayWall
            const width = 10;
            const height = 3.5;
            const thickness = 0.2;
            const doorWidth = 1.0;
            const doorHeight = 2.2;
            const sideWidth = (width - doorWidth) / 2;
            const topHeight = height - doorHeight;
            // Use dualMat for all pieces
            
            const group = this.hallwayWallGroup;
            group.position.set(-1.5, 0, -7.5);
            group.rotation.y = Math.PI / 2;

            // Left Panel
            const left = new THREE.Mesh(new THREE.BoxGeometry(sideWidth, height, thickness), dualMat);
            left.position.set(-width/2 + sideWidth/2, height/2, 0);
            group.add(left);
            this.hallwayWallColliders.push(left);

            // Right Panel
            const right = new THREE.Mesh(new THREE.BoxGeometry(sideWidth, height, thickness), dualMat);
            right.position.set(width/2 - sideWidth/2, height/2, 0);
            group.add(right);
            this.hallwayWallColliders.push(right);

            // Top Panel
            const top = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, topHeight, thickness), dualMat);
            top.position.set(0, height - topHeight/2, 0);
            group.add(top);
            this.hallwayWallColliders.push(top);

            // Add colliders to main list
            this.hallwayWallColliders.forEach(c => this.colliders.push(c));

            // Show Door
            if (this.bedroomDoorObject) {
                this.bedroomDoorObject.visible = true;
                this.bedroomDoorObject.isInteractive = true;
                
                // Add Door Panel Collider (if closed)
                if (!this.bedroomDoorObject.isOpen && this.bedroomDoorPanel) {
                     if (!this.colliders.includes(this.bedroomDoorPanel)) {
                         this.colliders.push(this.bedroomDoorPanel);
                     }
                }
            }
        }
        
        this.root.add(this.hallwayWallGroup);
    }

    createKeyMesh() {
        const keyGroup = new THREE.Group();
        const material = new THREE.MeshStandardMaterial({ 
            color: 0xc0a040, // Dark gold/bronze
            metalness: 0.9, 
            roughness: 0.6 
        });

        // Centered geometry (Pivot at center of mass approx)
        // Ring
        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.06, 0.02, 8, 16),
            material
        );
        ring.position.y = 0.05; // Was 0.15
        keyGroup.add(ring);

        // Shaft
        const shaft = new THREE.Mesh(
            new THREE.CylinderGeometry(0.015, 0.015, 0.2, 8),
            material
        );
        shaft.position.y = -0.05; // Was 0.05
        keyGroup.add(shaft);

        // Collar
        const collar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.025, 0.025, 0.02, 8),
            material
        );
        collar.position.y = 0.0; // Was 0.1
        keyGroup.add(collar);

        // Teeth
        const teeth = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, 0.03, 0.01),
            material
        );
        teeth.position.set(0.02, -0.13, 0); // Was -0.03
        keyGroup.add(teeth);

        const teeth2 = new THREE.Mesh(
            new THREE.BoxGeometry(0.03, 0.02, 0.01),
            material
        );
        teeth2.position.set(0.02, -0.11, 0); // Was -0.01
        keyGroup.add(teeth2);
        
        // Invisible Hitbox
        const hitboxMat = new THREE.MeshBasicMaterial({ 
            color: 0xff0000,
            transparent: true, 
            opacity: 0,
            depthWrite: false
        });
        const hitbox = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 0.4, 0.1),
            hitboxMat
        );
        hitbox.position.y = -0.05; // Centered on shaft
        keyGroup.add(hitbox);

        // Scale down
        keyGroup.scale.setScalar(0.7);

        return keyGroup;
    }

    createDoorVisuals(width, height, thickness, material) {
        const wrapper = new THREE.Group();
        
        // Door Panel
        const panel = new THREE.Mesh(new THREE.BoxGeometry(width, height, thickness), material);
        wrapper.add(panel);
        
        // Knobs
        // Add stem to prevent "digging in" look
        const knobGeo = new THREE.SphereGeometry(0.04, 16, 16);
        const stemGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.03, 8);
        stemGeo.rotateX(Math.PI / 2); // Orient along Z

        const knobMat = this.materials.metal;
        
        // Standardize: Hinge is at +x (Right), Knob is at -x (Left)
        // Panel center is 0. width=1. Hinge at +0.5. Left edge at -0.5.
        // Place knob near left edge.
        const knobX = width / 2 - 0.15;
        const knobY = -0.1; // 1.0m height (center is 1.1m)

        // Side 1 (Front/Z+)
        const stem1 = new THREE.Mesh(stemGeo, knobMat);
        stem1.position.set(knobX, knobY, thickness / 2 + 0.015); // Center of stem (len 0.03)
        wrapper.add(stem1);

        const knob1 = new THREE.Mesh(knobGeo, knobMat);
        knob1.position.set(knobX, knobY, thickness / 2 + 0.03 + 0.025); // End of stem + radius overlap
        wrapper.add(knob1);
        
        // Side 2 (Back/Z-)
        const stem2 = new THREE.Mesh(stemGeo, knobMat);
        stem2.position.set(knobX, knobY, -thickness / 2 - 0.015);
        wrapper.add(stem2);

        const knob2 = new THREE.Mesh(knobGeo, knobMat);
        knob2.position.set(knobX, knobY, -thickness / 2 - 0.03 - 0.025);
        wrapper.add(knob2);
        
        return { wrapper, panel };
    }

    createHouseKeyMesh() {
        const material = new THREE.MeshStandardMaterial({ 
            color: 0xffd700, // Gold color
            metalness: 0.9, 
            roughness: 0.1,
            emissive: 0xffd700,
            emissiveIntensity: 0.8 // Stronger glow
        });
        const group = new THREE.Group();
        
        // Scale the whole key up by 50% for visibility
        group.scale.set(1.5, 1.5, 1.5);
        
        const head = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.01, 16), material);
        head.rotation.x = Math.PI / 2;
        group.add(head);

        const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.15, 0.01), material);
        shaft.position.y = -0.075;
        group.add(shaft);

        const teeth1 = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), material);
        teeth1.position.set(0.01, -0.1, 0);
        group.add(teeth1);

        const teeth2 = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), material);
        teeth2.position.set(0.01, -0.12, 0);
        group.add(teeth2);

        group.rotation.x = Math.PI / 2;
        return group;
    }

    addInteractiveElements() {
        // Lighter - detailed mesh
        const lighterMesh = new THREE.Group();
        const lBody = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.15, 0.05),
            new THREE.MeshStandardMaterial({ color: 0xff0000, metalness: 0.1, roughness: 0.5 })
        );
        lighterMesh.add(lBody);
        const lCap = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.05, 0.05),
            new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.9, roughness: 0.2 })
        );
        lCap.position.y = 0.1;
        lighterMesh.add(lCap);

        const lighter = new Item('lighter', 'Lighter', 'Pick up lighter', lighterMesh);
        // Positioned on the right edge of the bathroom sink deck
        // Sink center X: -1.8. Width 1.0. Edge is at -1.3 approx.
        // Y: 0.85 (counter) + 0.12 (slab) = 0.97.
        // Z: Sink group at 2.1.
        lighter.position.set(-1.4, 0.98, 2.1); 
        this.root.add(lighter);
        this.interactiveObjects.push(lighter);


        // Key - Initially hidden/interactive false until webs burned
        // We create it now so it can be managed easily
        const keyMesh = this.createKeyMesh();
        // Initial state: Hanging vertically (as if caught in web)
        keyMesh.rotation.x = 0; 
        keyMesh.rotation.z = 0;

        this.keyItem = new Item('key', 'Old Key', 'Pick up Key', keyMesh);
        // Position suspended in the webs (Centered)
        this.keyItem.position.set(-2.2, 0.75, -2.2);
        this.keyItem.visible = false;
        this.keyItem.isInteractive = false;
        this.root.add(this.keyItem);
        this.interactiveObjects.push(this.keyItem);


        // Flashlight (Hallway Floor)
        // Hallway starts at z=-2.5, ends at -12.5. Halfway is -7.5.
        // On floor (y=0.1 approx). Pointing towards negative Z (House).
        const flashlightMesh = new THREE.Group();
        // Body
        const flBody = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 16), new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.2 }));
        flBody.rotation.x = Math.PI / 2;
        flashlightMesh.add(flBody);
        // Head
        const flHead = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.08, 16), new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.2 }));
        flHead.rotation.x = Math.PI / 2;
        flHead.position.z = -0.12; // Front of cylinder
        flashlightMesh.add(flHead);
        // Lens (emissive)
        const flLens = new THREE.Mesh(new THREE.CircleGeometry(0.05, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2 }));
        flLens.position.z = -0.161;
        flashlightMesh.add(flLens);

        // Actual Light Beam (Spotlight)
        const beam = new THREE.SpotLight(0xffffff, 3.0, 30, Math.PI / 6, 0.5, 1);
        beam.position.set(0, 0, -0.1);
        beam.target.position.set(0, 0, -1); // Point forward (relative)
        beam.castShadow = true; 
        beam.shadow.mapSize.width = 1024;
        beam.shadow.mapSize.height = 1024;
        beam.shadow.bias = -0.0001;
        flashlightMesh.add(beam);
        flashlightMesh.add(beam.target);

        // Wrapper for interact
        const flashlightItem = new Item('flashlight', 'Flashlight', 'Pick up Flashlight', flashlightMesh);
        flashlightItem.position.set(0, 0.15, -7.5); // Floor, center of hallway
        // Pointing away from bathroom (Negative Z)
        flashlightItem.rotation.y = 0; 

        this.root.add(flashlightItem);
        this.interactiveObjects.push(flashlightItem);


        // Spiderwebs in corner - moved next to door
        const webGroup = new InteractiveObject('webs', 'Spiderwebs', 'Burn spiderwebs', (state) => {
            // Check if lighter is EQUIPPED, not just in inventory
            if (state.equippedId === 'lighter') {
                // Prevent multiple triggers
                if (webGroup.isBurning) return;
                webGroup.isBurning = true;
                webGroup.isInteractive = false; // Disable interaction immediately

                // Start dissolve animation
                let time = 0;
                const duration = 1.5;
                let dropped = false;

                // Sizzle Sound
                // Reduced volume and duration
                const noise = new Tone.Noise({
                    type: "pink",
                    volume: -60 // Much quieter base
                }).start();
                
                const filter = new Tone.Filter(200, "highpass").toDestination();
                
                // Envelope for fade in/out
                const env = new Tone.AmplitudeEnvelope({
                    attack: 0.5, 
                    decay: 0.2, 
                    sustain: 0.5, 
                    release: 0.5
                }).connect(filter);
                
                noise.connect(env);
                
                // Shorter duration (0.8s)
                const soundDuration = 0.8; 
                env.triggerAttackRelease(soundDuration);
                
                // Crackle effect using LFO on volume/filter
                // FIXED: LFO was overriding volume with high values (-10dB). 
                // Now oscillates in a very quiet range.
                const lfo = new Tone.LFO(20, -65, -55).start(); 
                lfo.connect(noise.volume);

                setTimeout(() => {
                    noise.stop();
                    noise.dispose();
                    lfo.stop();
                    lfo.dispose();
                    env.dispose();
                    filter.dispose();
                }, soundDuration * 1000 + 1000);
                
                this.addAnimation((dt) => {
                    time += dt;
                    const progress = Math.min(time / duration, 1);
                    
                    // Dissolve effect: shrink and fade
                    webMesh.scale.setScalar(1 - progress);
                    webMesh.material.opacity = 0.8 * (1 - progress);
                    
                    // Add some ember particles/flicker effect here if desired (simplified as color pulse)
                    const pulse = Math.sin(time * 20) * 0.5 + 0.5;
                    webMesh.material.color.setHSL(0.05, 1, 0.5 + pulse * 0.5); // Orange flicker

                    // Drop key early as webs start to burn away
                    if (progress > 0.3 && !dropped) {
                        dropped = true;
                        this.revealKey();
                    }

                    if (progress >= 1) {
                        webGroup.visible = false;
                        if (!dropped) this.revealKey(); // Fallback
                        return false; // Remove animation
                    }
                    return true; // Keep animating
                });

                return 'Burning webs...';
            } else if (state.inventory.has('lighter')) {
                return 'Equip the lighter first.';
            } else {
                return 'You need something to burn these.';
            }
        });
        
        const webMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), this.materials.web.clone()); // Clone material to avoid affecting others
        webMesh.rotation.y = Math.PI / 4;
        webGroup.add(webMesh);
        webGroup.position.set(-2.2, 0.75, -2.2); // Corner next to door
        this.root.add(webGroup);
        this.interactiveObjects.push(webGroup);

        // Bathroom Door
        const { wrapper: bathDoorVisual, panel: bathDoorPanel } = this.createDoorVisuals(1, 2.2, 0.1, this.materials.wood);
        
        const door = new InteractiveObject('bathroom_door', 'Bathroom Door', 'Open Door', (state) => {
            if (state.equippedId === 'key') {
                this.toggleDoor(door);
                return null;
            } else if (state.inventory.has('key')) {
                state.speak("I have the key, I just need to hold it.");
                return null;
            } else {
                state.speak("Locked. I need a key... I think I see something in the spider webs.");
                return null;
            }
        });
        door.add(bathDoorVisual);
        door.colliderMesh = bathDoorPanel; // Link for toggle logic
        // Set properties for openDoor
        door.closedPos = { x: 0, y: 1.1, z: -2.5 };
        door.openTransform = {
             position: new THREE.Vector3(-0.5, 1.1, -3.0),
             rotation: Math.PI / 2
        };

        door.position.copy(door.closedPos);
        this.root.add(door);
        this.interactiveObjects.push(door);
        this.colliders.push(bathDoorPanel);
        this.doorObject = door;
        this.doorMesh = bathDoorPanel;

        // Exit Door (Front door) - Now in Living Room Back Wall
        const { wrapper: exitDoorVisual, panel: exitDoorPanel } = this.createDoorVisuals(1, 2.2, 0.1, this.materials.wood);
        
        const exitDoor = new InteractiveObject('exit_door', 'Front Door', 'Open Door', (state) => {
             if (state.equippedId === 'house_key') {
                 this.toggleDoor(exitDoor);
                 return null;
             } else if (state.inventory.has('house_key')) {
                 state.speak("I found the house key, I just need to hold it.");
                 return null;
             } else {
                 state.speak("Locked. That note on the island... it was for someone named Sarah. It mentioned a key.");
                 return null;
             }
        });
        exitDoor.add(exitDoorVisual);
        exitDoor.colliderMesh = exitDoorPanel; 
        
        exitDoor.closedPos = { x: 0, y: 1.1, z: -24.5 }; 
        exitDoor.openTransform = {
            position: new THREE.Vector3(-0.5, 1.1, -24.0),
            rotation: -Math.PI / 2
        };

        exitDoor.position.copy(exitDoor.closedPos);
        exitDoor.isInteractive = true; // Explicitly ensure it is interactive
        this.root.add(exitDoor);
        this.interactiveObjects.push(exitDoor);
        this.colliders.push(exitDoorPanel);
        this.exitDoorObject = exitDoor; 
        this.exitDoorMesh = exitDoorPanel;

        // Basement Door (Living Room Left Wall - Behind Couch)
        // Wall at x = -5. Center z = -18.5.
        // Door faces Right (+X).
        const { wrapper: basementDoorVisual, panel: basementDoorPanel } = this.createDoorVisuals(1, 2.2, 0.1, this.materials.houseWall);
        
        const basementDoor = new InteractiveObject('basement_door', 'Basement Door', 'Open Door', (state) => {
            if (basementDoor.isLocked) {
                state.speak("It won't budge. Looks like it's linked to this electronic keypad.");
                return null;
            }
            this.toggleDoor(basementDoor);
            return null;
        });
        basementDoor.isLocked = true; 
        
        basementDoor.add(basementDoorVisual);
        basementDoor.colliderMesh = basementDoorPanel;
        
        // Define open/close logic
        // Closed: At wall (-5), facing +X (PI/2).
        basementDoor.closedPos = { x: -5, y: 1.1, z: -18.5 };
        basementDoor.closedRotation = Math.PI / 2;
        
        // Open: Swing Out (Left Hinge at -18.0) -> Face +Z (0)
        // Center moves to x=-4.5, z=-18.0
        basementDoor.openTransform = {
            position: new THREE.Vector3(-4.5, 1.1, -18.0),
            rotation: 0 
        };

        basementDoor.position.copy(basementDoor.closedPos);
        basementDoor.rotation.y = basementDoor.closedRotation;
        
        this.root.add(basementDoor);
        this.interactiveObjects.push(basementDoor);
        this.colliders.push(basementDoorPanel);
        this.basementDoorObject = basementDoor; // Reference for unlocking

        // --- Keypad for Basement Door ---
        this.createPhysicalKeypad(-4.85, 1.4, -19.3, Math.PI / 2);
        
        // Call helper for Bedroom Door
        this.createBedroomDoor();
    }

    createPhysicalKeypad(x, y, z, rotationY) {
        const keypadGroup = new THREE.Group();
        keypadGroup.position.set(x, y, z);
        keypadGroup.rotation.y = rotationY;
        this.root.add(keypadGroup);

        const state = {
            input: '',
            code: '1031',
            isLocked: true
        };

        // 1. Main Housing
        const housingMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.5, roughness: 0.2 });
        const housing = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.25, 0.05), housingMat);
        keypadGroup.add(housing);

        // 2. Screen
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const screenTex = new THREE.CanvasTexture(canvas);

        const updateScreen = (text = null, color = '#0f0') => {
            ctx.fillStyle = '#050505';
            ctx.fillRect(0, 0, 128, 64);
            ctx.fillStyle = color;
            ctx.font = 'bold 32px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const display = text || state.input.padEnd(4, '-');
            ctx.fillText(display, 64, 32);
            // Scanlines effect
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            for(let i=0; i<64; i+=4) ctx.fillRect(0, i, 128, 1);
            screenTex.needsUpdate = true;
        };
        updateScreen();

        const screenMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(0.1, 0.05),
            new THREE.MeshStandardMaterial({ 
                map: screenTex, 
                emissive: 0xffffff, 
                emissiveMap: screenTex,
                emissiveIntensity: 0.5 
            })
        );
        screenMesh.position.set(0, 0.07, 0.026);
        keypadGroup.add(screenMesh);

        // 3. Buttons
        const btnLabels = [
            '1', '2', '3',
            '4', '5', '6',
            '7', '8', '9',
            'CLR', '0', 'ENT'
        ];

        const btnMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.2, roughness: 0.8 });
        const btnGeo = new THREE.BoxGeometry(0.03, 0.03, 0.01);

        btnLabels.forEach((label, i) => {
            const row = Math.floor(i / 3);
            const col = i % 3;
            
            const btnObj = new InteractiveObject(`keypad_btn_${label}`, `Button ${label}`, label, (gameState) => {
                if (!state.isLocked) return null;
                
                // Visual feedback: briefly move button back
                const originalZ = btnObj.position.z;
                btnObj.position.z -= 0.005;
                setTimeout(() => btnObj.position.z = originalZ, 100);

                // Audio feedback
                const tick = new Tone.MembraneSynth({ volume: -25 }).toDestination();
                tick.triggerAttackRelease("C5", "64n");

                if (label === 'CLR') {
                    state.input = '';
                    updateScreen();
                } else if (label === 'ENT') {
                    if (state.input === state.code) {
                        state.isLocked = false;
                        updateScreen('OPEN', '#0f0');
                        // Success sound - use pool
                        if (this.poolAudio && this.poolAudio.success) {
                            this.poolAudio.success.triggerAttackRelease(["C5", "E5", "G5"], "8n");
                        }
                        
                        // Unlock the door
                        if (this.basementDoorObject) {
                            this.basementDoorObject.isLocked = false;
                            gameState.speak("The keypad turned green. The door should be open now.");
                        }
                    } else {
                        state.input = '';
                        updateScreen('ERR', '#f00');
                        // Error sound - use pool
                        if (this.poolAudio && this.poolAudio.error) {
                            this.poolAudio.error.triggerAttackRelease("G2", "8n");
                        }
                        setTimeout(() => updateScreen(), 1000);
                    }
                } else {
                    if (state.input.length < 4) {
                        state.input += label;
                        updateScreen();
                    }
                }
                return null;
            });

            const mesh = new THREE.Mesh(btnGeo, btnMat.clone());
            btnObj.add(mesh);

            // Add text to button mesh
            const canvasBtn = document.createElement('canvas');
            canvasBtn.width = 64;
            canvasBtn.height = 64;
            const ctxBtn = canvasBtn.getContext('2d');
            ctxBtn.fillStyle = '#333';
            ctxBtn.fillRect(0,0,64,64);
            ctxBtn.fillStyle = '#aaa';
            ctxBtn.font = label.length > 1 ? 'bold 20px Arial' : 'bold 32px Arial';
            ctxBtn.textAlign = 'center';
            ctxBtn.textBaseline = 'middle';
            ctxBtn.fillText(label, 32, 32);
            
            const btnTex = new THREE.CanvasTexture(canvasBtn);
            const textMesh = new THREE.Mesh(
                new THREE.PlaneGeometry(0.025, 0.025),
                new THREE.MeshStandardMaterial({ map: btnTex, transparent: true })
            );
            textMesh.position.z = 0.006;
            btnObj.add(textMesh);

            const bx = (col - 1) * 0.04;
            const by = 0.01 - (row * 0.04);
            btnObj.position.set(bx, by, 0.025);
            
            keypadGroup.add(btnObj);
            this.interactiveObjects.push(btnObj);
        });
    }

    createBedroomDoor() {
        // Hallway Z center -7.5. Width 3 (X -1.5 to 1.5).
        // Left wall is X = -1.5.
        // Door at Z = -7.5, facing Right (Rotation Y = PI/2)
        const { wrapper: bedroomDoorVisual, panel: bedroomDoorPanel } = this.createDoorVisuals(1, 2.2, 0.1, this.materials.wood);
        
        const bedroomDoor = new InteractiveObject('bedroom_door', 'Bedroom Door', 'Open Door', (state) => {
             this.toggleDoor(bedroomDoor);
             return null;
        });
        bedroomDoor.add(bedroomDoorVisual);
        bedroomDoor.colliderMesh = bedroomDoorPanel;
        
        bedroomDoor.closedPos = { x: -1.5, y: 1.1, z: -7.5 };
        bedroomDoor.closedRotation = Math.PI / 2;
        
        // Open inwards (into bedroom)
        // Hinge at World Z -7.0. Swings to lie along Z=-7.0 plane.
        bedroomDoor.openTransform = {
            position: new THREE.Vector3(-2.0, 1.1, -7.0),
            rotation: Math.PI // Faces Back
        };

        bedroomDoor.position.copy(bedroomDoor.closedPos);
        bedroomDoor.rotation.y = bedroomDoor.closedRotation;
        
        this.root.add(bedroomDoor);
        this.interactiveObjects.push(bedroomDoor);
        this.colliders.push(bedroomDoorPanel);
        
        // Critical: Assign references for updateHallwayWall to use
        this.bedroomDoorObject = bedroomDoor;
        this.bedroomDoorPanel = bedroomDoorPanel;
    }

    revealKey() {
        if (this.keyItem) {
            this.keyItem.visible = true;
            // Key is not interactive while falling
            this.keyItem.isInteractive = false;
            
            // Animation setup
            let velocityY = 0;
            const gravity = 9.8; 
            const floorY = 0.12; // Raised to sit ON TOP of floor (floor top is at 0.1)
            const keyMesh = this.keyItem.children[0];

            this.addAnimation((dt) => {
                velocityY -= gravity * dt;
                this.keyItem.position.y += velocityY * dt;
                
                // Tumble effect
                keyMesh.rotation.x -= 2 * dt;
                keyMesh.rotation.z += 1 * dt;

                // Hit floor
                if (this.keyItem.position.y <= floorY) {
                    this.keyItem.position.y = floorY;
                    
                    // Final resting position (lying flat)
                    // The new constructed key lies flat when rotation.x is -PI/2
                    keyMesh.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
                    
                    this.keyItem.isInteractive = true;
                    return false; // Stop animation
                }
                return true;
            });
        }
    }

    toggleDoor(doorObj, instant = false) {
        if (doorObj.isAnimating) return;

        // Init state if undefined
        if (doorObj.isOpen === undefined) doorObj.isOpen = false;
        
        const opening = !doorObj.isOpen;
        doorObj.isAnimating = true;
        
        // Define Targets
        const startPos = doorObj.position.clone();
        const startRot = doorObj.rotation.y;
        
        let targetPos, targetRot;
        
        if (opening) {
            // OPENING
            if (doorObj.openTransform) {
                targetPos = doorObj.openTransform.position;
                targetRot = doorObj.openTransform.rotation;
            } else {
                targetPos = new THREE.Vector3(startPos.x - 0.5, startPos.y, startPos.z - 0.5);
                targetRot = startRot + Math.PI / 2;
            }
            
            // Audio: Creak
             if (!instant && this.poolAudio && this.poolAudio.creak) {
                this.poolAudio.creak.triggerAttackRelease("C2", "2n");
                this.poolAudio.creak.frequency.rampTo("F1", 2);
            }

            // Remove Collider immediately to allow passing
            if (doorObj.colliderMesh) {
                this.colliders = this.colliders.filter(c => c !== doorObj.colliderMesh);
            }

        } else {
            // CLOSING
            if (doorObj.closedPos) {
                 targetPos = new THREE.Vector3(doorObj.closedPos.x, doorObj.closedPos.y, doorObj.closedPos.z);
            } else {
                 targetPos = new THREE.Vector3(0,0,0);
            }
            
            // Fix: Use stored closedRotation if available, otherwise default to 0
            if (doorObj.closedRotation !== undefined) {
                targetRot = doorObj.closedRotation;
            } else {
                targetRot = 0;
            }

            // Audio: Slam/Click
            if (!instant) {
                const clickSynth = new Tone.MembraneSynth({
                    pitchDecay: 0.008,
                    octaves: 2,
                    envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 },
                    volume: -5
                }).toDestination();
                clickSynth.triggerAttackRelease("C2", "8n");
            }

            // Re-add Collider immediately (to block)
            if (doorObj.colliderMesh && !this.colliders.includes(doorObj.colliderMesh)) {
                this.colliders.push(doorObj.colliderMesh);
            }
        }

        if (instant) {
            doorObj.position.copy(targetPos);
            doorObj.rotation.y = targetRot;
            doorObj.isOpen = opening;
            doorObj.isAnimating = false;
            doorObj.promptText = opening ? "Close Door" : "Open Door";
            return;
        }

        // Animation
        const duration = 1.5;
        let time = 0;

        this.addAnimation((dt) => {
            time += dt;
            const t = Math.min(time / duration, 1);
            // Smooth step
            const ease = t * t * (3 - 2 * t);

            doorObj.rotation.y = THREE.MathUtils.lerp(startRot, targetRot, ease);
            doorObj.position.lerpVectors(startPos, targetPos, ease);

            if (t >= 1) {
                doorObj.isOpen = opening;
                doorObj.isAnimating = false;
                doorObj.promptText = opening ? "Close Door" : "Open Door";
                return false;
            }
            return true;
        });
    }

    // State Management
    getWorldState() {
        return {
            websBurned: !this.interactiveObjects.find(o => o.objectId === 'webs')?.visible,
            doorUnlocked: this.doorObject?.isOpen || false,
            exitDoorUnlocked: this.exitDoorObject?.isOpen || false,
            basementDoorUnlocked: !this.basementDoorObject?.isLocked,
            // Items are tracked by inventory in Game class, but we need to know if key is revealed
            keyRevealed: this.keyItem?.visible || false,
            houseKeyRevealed: this.houseKeyItem?.visible || false,
            bedroomDoorRevealed: this.bedroomDoorRevealed,
            portraitTriggered: this.portraitTriggered,
            scareTriggered: this.scareTriggered,
            isFanOn: this.isFanOn,
            ratTriggered: this.rat?.triggered || false
        };
    }

    restoreWorldState(state, inventory) {
        // Restore Rat State
        if (state.ratTriggered && this.rat) {
            this.rat.triggered = true;
            this.rat.active = false;
            this.rat.despawned = true;
            this.rat.group.visible = false;
        }

        // Restore Fan State
        if (state.isFanOn === false) {
            this.isFanOn = false;
            if (this.switchNub) this.switchNub.rotation.x = 0.3;
        }

        // Restore Scare State
        if (state.scareTriggered) {
            this.scareTriggered = true;
        }

        // Restore Portrait Fall State
        if (state.portraitTriggered && this.portraitObject) {
            this.portraitTriggered = true;
            this.portraitObject.position.y = 0.5; // On floor
            this.portraitObject.rotation.x = Math.PI / 2.5; // Tilted
            this.createGlassShards(this.portraitObject.position);
        }

        // Restore Bedroom Door Revealed State
        if (state.bedroomDoorRevealed !== undefined) {
            this.bedroomDoorRevealed = state.bedroomDoorRevealed;
            this.updateHallwayWall();
        }

        // Restore Webs
        const webs = this.interactiveObjects.find(o => o.objectId === 'webs');
        if (state.websBurned && webs) {
            webs.visible = false;
            webs.isInteractive = false;
        } else if (webs) {
            webs.visible = true;
            webs.isInteractive = true;
        }

        // Restore Basement Door Lock
        if (this.basementDoorObject) {
            this.basementDoorObject.isLocked = state.basementDoorUnlocked === false;
        }

        // Restore Bathroom Key Visibility (if not picked up yet)
        if (state.keyRevealed && !inventory.has('key')) {
            this.keyItem.visible = true;
            this.keyItem.isInteractive = true;
            
            // Ensure it is on the floor, lying flat
            this.keyItem.position.set(-2.2, 0.12, -2.2);
            const keyMesh = this.keyItem.children[0];
            keyMesh.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
        } else {
            this.keyItem.visible = false;
            this.keyItem.isInteractive = false;
        }

        // Restore Pantry/Island Key Visibility
        if (this.houseKeyItem) {
            if (inventory.has('house_key')) {
                this.houseKeyItem.visible = false;
                this.houseKeyItem.isInteractive = false;
            } else {
                this.houseKeyItem.visible = true;
                this.houseKeyItem.isInteractive = true;
            }
        }

        // Restore other items (picked up = hidden)
        const itemsToTrack = [
            { id: 'lighter', obj: this.interactiveObjects.find(o => o.objectId === 'lighter') },
            { id: 'flashlight', obj: this.interactiveObjects.find(o => o.objectId === 'flashlight') },
            { id: 'car_keys', obj: this.interactiveObjects.find(o => o.objectId === 'car_keys') }
        ];

        itemsToTrack.forEach(item => {
            if (item.obj) {
                if (inventory.has(item.id)) {
                    item.obj.visible = false;
                    item.obj.isInteractive = false;
                } else {
                    item.obj.visible = true;
                    item.obj.isInteractive = true;
                }
            }
        });

        // Restore Bathroom Door
        if (state.doorUnlocked && this.doorObject) {
            // Ensure default state first
            this.doorObject.position.copy(this.doorObject.closedPos);
            this.doorObject.rotation.set(0,0,0);
            this.doorObject.isOpen = false;
            this.doorObject.isAnimating = false;
            if (this.doorMesh && !this.colliders.includes(this.doorMesh)) {
                this.colliders.push(this.doorMesh);
            }
            
            // Toggle Open Instantly
            this.toggleDoor(this.doorObject, true);

        } else if (this.doorObject) {
             // Ensure Closed
             this.doorObject.position.copy(this.doorObject.closedPos);
             this.doorObject.rotation.set(0,0,0);
             this.doorObject.isOpen = false;
             this.doorObject.isAnimating = false;
             this.doorObject.promptText = "Open Door";
             if (this.doorMesh && !this.colliders.includes(this.doorMesh)) {
                 this.colliders.push(this.doorMesh);
             }
        }

        // Restore Front Door
        if (state.exitDoorUnlocked && this.exitDoorObject) {
            this.exitDoorObject.position.copy(this.exitDoorObject.closedPos);
            this.exitDoorObject.rotation.set(0,0,0);
            this.exitDoorObject.isOpen = false;
            this.exitDoorObject.isAnimating = false;
            if (this.exitDoorMesh && !this.colliders.includes(this.exitDoorMesh)) {
                this.colliders.push(this.exitDoorMesh);
            }
            this.toggleDoor(this.exitDoorObject, true);
        } else if (this.exitDoorObject) {
            this.exitDoorObject.position.copy(this.exitDoorObject.closedPos);
            this.exitDoorObject.rotation.set(0,0,0);
            this.exitDoorObject.isOpen = false;
            this.exitDoorObject.isAnimating = false;
            this.exitDoorObject.promptText = "Open Door";
            if (this.exitDoorMesh && !this.colliders.includes(this.exitDoorMesh)) {
                this.colliders.push(this.exitDoorMesh);
            }
        }
    }
}

