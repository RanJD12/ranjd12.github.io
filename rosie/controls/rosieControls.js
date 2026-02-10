import * as THREE from 'three';
import { MobileControls } from './rosieMobileControls.js';

/**
 * PlayerController - Handles player movement and physics
 */
class PlayerController {
  constructor(player, options = {}) {
    this.player = player;

    // Configuration
    this.moveSpeed = options.moveSpeed || 10;
    this.jumpForce = options.jumpForce || 15;
    this.gravity = options.gravity || 30;
    this.groundLevel = options.groundLevel || 1; 

    // State
    this.velocity = new THREE.Vector3();
    this.isOnGround = true;
    this.canJump = true;
    this.keys = {};
    this.joystickInput = { x: 0, y: 0 };
    this.cameraMode = 'third-person';

    // Reusable temporaries to reduce GC
    this.tempVec = new THREE.Vector3();
    this.tempForward = new THREE.Vector3();
    this.tempRight = new THREE.Vector3();
    this.tempYAxis = new THREE.Vector3(0, 1, 0);

    // Setup input handlers
    this.setupInput();

    // Initialize mobile controls
    this.mobileControls = new MobileControls(this);
  }

  setupInput() {
    this.keydownHandler = (e) => { this.keys[e.code] = true; };
    this.keyupHandler = (e) => { this.keys[e.code] = false; };
    document.addEventListener('keydown', this.keydownHandler);
    document.addEventListener('keyup', this.keyupHandler);
  }

  setCameraMode(mode) {
    this.cameraMode = mode;
  }

  showControls() {
    if (this.mobileControls) this.mobileControls.show();
  }

  hideControls() {
    if (this.mobileControls) this.mobileControls.hide();
  }

  update(deltaTime, cameraRotation) {
    // Apply gravity
    if (this.player.position.y > this.groundLevel) {
      this.velocity.y -= this.gravity * deltaTime;
      this.isOnGround = false;
    } else {
      this.velocity.y = Math.max(0, this.velocity.y);
      this.player.position.y = this.groundLevel;
      this.isOnGround = true;
      this.canJump = true;
    }

    // Handle jumping
    if (this.keys['Space'] && this.isOnGround && this.canJump) {
      this.velocity.y = this.jumpForce;
      this.isOnGround = false;
      this.canJump = false;
    }

    // --- Horizontal Movement ---
    this.tempForward.set(0, 0, -1).applyAxisAngle(this.tempYAxis, cameraRotation);
    this.tempRight.set(1, 0, 0).applyAxisAngle(this.tempYAxis, cameraRotation);

    let inputForward = 0;
    let inputRight = 0;

    if (Math.abs(this.joystickInput.y) > 0.001 || Math.abs(this.joystickInput.x) > 0.001) {
        inputForward = this.joystickInput.y;
        inputRight = this.joystickInput.x;
    } else {
        if (this.keys['KeyW']) inputForward += 1;
        if (this.keys['KeyS']) inputForward -= 1;
        if (this.keys['KeyD']) inputRight += 1;
        if (this.keys['KeyA']) inputRight -= 1;
    }

    this.tempVec.set(0, 0, 0);
    this.tempVec.addScaledVector(this.tempForward, inputForward);
    this.tempVec.addScaledVector(this.tempRight, inputRight);

    if (this.tempVec.lengthSq() > 1.0) {
        this.tempVec.normalize();
    }

    this.velocity.x = this.tempVec.x * this.moveSpeed;
    this.velocity.z = this.tempVec.z * this.moveSpeed;

    // --- Update Player Position ---
    this.player.position.x += this.velocity.x * deltaTime;
    this.player.position.y += this.velocity.y * deltaTime;
    this.player.position.z += this.velocity.z * deltaTime;

    // --- Update Player Rotation ---
    if (this.cameraMode === 'third-person' && (this.velocity.x !== 0 || this.velocity.z !== 0)) {
      const angle = Math.atan2(this.velocity.x, this.velocity.z);
      this.player.rotation.y = angle;
    }
  }

  destroy() {
    document.removeEventListener('keydown', this.keydownHandler);
    document.removeEventListener('keyup', this.keyupHandler);
    this.mobileControls.destroy();
  }
}

/**
 * FirstPersonCameraController - Handles first-person camera controls
 * Sanitized for robustness and performance.
 */
class FirstPersonCameraController {
  constructor(camera, player, domElement, options = {}) {
    this.camera = camera;
    this.player = player;
    this.domElement = domElement;

    // Configuration
    this.eyeHeight = options.eyeHeight || 1.6;
    this.mouseSensitivity = options.mouseSensitivity || 0.002;
    this.invertY = options.invertY || false;

    // State
    this.enabled = false;
    this.rotationY = 0;
    this.rotationX = 0;
    this.currentY = undefined;
    this.lockTimestamp = 0;
    
    // Mobile touch state
    this.lookTouchId = null;
    this.lastTouchX = 0;
    this.lastTouchY = 0;
    
    // Smoothing buffer for mouse movement to prevent snaps/jerks
    this.movementXBuffer = [0, 0, 0];
    this.movementYBuffer = [0, 0, 0];

    this.setupControls();
  }

  setSensitivity(value) {
    this.mouseSensitivity = value;
  }

  setInvertY(value) {
    this.invertY = value;
  }

  setupControls() {
    // 1. Mouse Lock Click
    this.clickHandler = () => {
      if (this.enabled && document.pointerLockElement !== this.domElement) {
        this.domElement.requestPointerLock();
      }
    };

    // 2. Pointer Lock Change
    this.lockChangeHandler = () => {
        if (document.pointerLockElement === this.domElement) {
            this.lockTimestamp = performance.now();
            this.movementXBuffer.fill(0);
            this.movementYBuffer.fill(0);
        }
    };

    // 3. Mouse Move (Keep as fallback, but add touch-active check)
    this.mouseMoveHandler = (e) => {
      if (!this.enabled || this.lookTouchId !== null) return; // Ignore mouse if touch is active
      if (document.pointerLockElement !== this.domElement) return;

      if (performance.now() - this.lockTimestamp < 150) return;

      const movementX = e.movementX || 0;
      const movementY = e.movementY || 0;

      if (Math.abs(movementX) > 300 || Math.abs(movementY) > 300) return;

      this.movementXBuffer.shift();
      this.movementXBuffer.push(movementX);
      this.movementYBuffer.shift();
      this.movementYBuffer.push(movementY);

      const smoothX = this.movementXBuffer.reduce((a, b) => a + b) / this.movementXBuffer.length;
      const smoothY = this.movementYBuffer.reduce((a, b) => a + b) / this.movementYBuffer.length;

      const yMultiplier = this.invertY ? -1 : 1;

      this.rotationY -= smoothX * this.mouseSensitivity;
      this.rotationX -= (smoothY * this.mouseSensitivity) * yMultiplier;
      this.rotationX = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.rotationX));
    };

    // 4. Mobile Touch Look
    const isTouchOverMobileUI = (touch) => {
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      return element && (
        element.id === 'mobile-game-controls' ||
        element.id === 'virtual-joystick' ||
        element.id === 'virtual-joystick-knob' ||
        element.id === 'jump-button' ||
        element.id === 'settings-panel' ||
        element.closest('#settings-panel') ||
        element.closest('#mobile-game-controls')
      );
    };

    this.touchstartHandler = (e) => {
      if (!this.enabled) return;
      if (this.lookTouchId === null) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (!isTouchOverMobileUI(touch)) {
            this.lookTouchId = touch.identifier;
            this.lastTouchX = touch.clientX;
            this.lastTouchY = touch.clientY;
            e.preventDefault(); // Stop browser gestures
            break;
          }
        }
      }
    };

    this.touchmoveHandler = (e) => {
      if (!this.enabled || this.lookTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.lookTouchId) {
          let deltaX = touch.clientX - this.lastTouchX;
          let deltaY = touch.clientY - this.lastTouchY;
          
          // Robust Spike filter for mobile touch: Ignore massive sudden jumps (> 150px)
          // This prevents the "jerk" when the browser misreports touch coordinates
          if (Math.abs(deltaX) > 150 || Math.abs(deltaY) > 150) {
              this.lastTouchX = touch.clientX;
              this.lastTouchY = touch.clientY;
              return;
          }

          const yMultiplier = this.invertY ? -1 : 1;

          this.rotationY -= deltaX * this.mouseSensitivity * 1.5;
          this.rotationX -= (deltaY * this.mouseSensitivity * 1.5) * yMultiplier;
          this.rotationX = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.rotationX));
          
          this.lastTouchX = touch.clientX;
          this.lastTouchY = touch.clientY;
          e.preventDefault();
          break;
        }
      }
    };

    this.touchendHandler = (e) => {
      if (this.lookTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.lookTouchId) {
          this.lookTouchId = null;
          e.preventDefault();
          break;
        }
      }
    };

    this.domElement.addEventListener('click', this.clickHandler);
    document.addEventListener('mousemove', this.mouseMoveHandler);
    document.addEventListener('pointerlockchange', this.lockChangeHandler);
    this.domElement.addEventListener('touchstart', this.touchstartHandler);
    this.domElement.addEventListener('touchmove', this.touchmoveHandler);
    this.domElement.addEventListener('touchend', this.touchendHandler);
  }

  enable() {
    this.enabled = true;
    this.rotationX = 0;
    this.hidePlayer();
  }

  disable() {
    this.enabled = false;
    this.showPlayer();
    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock();
    }
  }

  hidePlayer() {
    this.originalVisibility = [];
    this.player.traverse(child => {
      if (child.isMesh) {
        this.originalVisibility.push({ object: child, visible: child.visible });
        child.visible = false;
      }
    });
  }

  showPlayer() {
    if (this.originalVisibility) {
      this.originalVisibility.forEach(item => { item.object.visible = item.visible; });
      this.originalVisibility = null;
    }
  }

  update() {
    if (!this.enabled) return 0;
    this.updateRotationOnly();
    this.updatePosition();
    return this.rotationY;
  }

  updateRotationOnly() {
    if (!this.enabled) return 0;
    
    // Final sanitization
    if (isNaN(this.rotationX)) this.rotationX = 0;
    if (isNaN(this.rotationY)) this.rotationY = 0;

    // Apply rotations
    this.player.rotation.y = this.rotationY;
    
    // Set camera rotation order and values
    // We use YXZ to ensure natural FPS look-around behavior
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.x = this.rotationX;
    this.camera.rotation.y = this.rotationY;
    
    return this.rotationY;
  }

  updatePosition() {
    if (!this.enabled) return;
    this.camera.position.x = this.player.position.x;
    const targetY = this.player.position.y + this.eyeHeight;
    if (this.currentY === undefined) this.currentY = targetY;
    this.currentY += (targetY - this.currentY) * 0.1;
    this.camera.position.y = this.currentY;
    this.camera.position.z = this.player.position.z;
  }

  destroy() {
    this.domElement.removeEventListener('click', this.clickHandler);
    document.removeEventListener('mousemove', this.mouseMoveHandler);
    document.removeEventListener('pointerlockchange', this.lockChangeHandler);
    this.domElement.removeEventListener('touchstart', this.touchstartHandler);
    this.domElement.removeEventListener('touchmove', this.touchmoveHandler);
    this.domElement.removeEventListener('touchend', this.touchendHandler);
  }
}

/**
 * ThirdPersonCameraController - Handles third-person camera positioning and rotation
 */
class ThirdPersonCameraController {
  constructor(camera, target, domElement, options = {}) {
    this.camera = camera;
    this.target = target;
    this.domElement = domElement;
    this.distance = options.distance || 7;
    this.height = options.height || 3;
    this.rotationSpeed = options.rotationSpeed || 0.003;
    this.rotation = 0;
    this.isDragging = false;
    this.mousePosition = { x: 0, y: 0 };
    this.enabled = true;
    this.setupMouseControls();
  }

  setupMouseControls() {
    this.mousedownHandler = (e) => {
      if (!this.enabled) return;
      this.isDragging = true;
      this.mousePosition = { x: e.clientX, y: e.clientY };
    };
    this.mouseupHandler = () => { this.isDragging = false; };
    this.mousemoveHandler = (e) => {
      if (!this.enabled || !this.isDragging) return;
      const deltaX = e.clientX - this.mousePosition.x;
      this.rotation -= deltaX * this.rotationSpeed;
      this.mousePosition = { x: e.clientX, y: e.clientY };
    };

    this.domElement.addEventListener('mousedown', this.mousedownHandler);
    document.addEventListener('mouseup', this.mouseupHandler);
    document.addEventListener('mousemove', this.mousemoveHandler);
  }

  enable() { this.enabled = true; }
  disable() { this.enabled = false; this.isDragging = false; }

  update() {
    if (!this.enabled) return 0;
    const offset = new THREE.Vector3(
      Math.sin(this.rotation) * this.distance,
      this.height,
      Math.cos(this.rotation) * this.distance
    );
    this.camera.position.copy(this.target.position).add(offset);
    this.camera.lookAt(this.target.position.x, this.target.position.y + 1, this.target.position.z);
    return this.rotation;
  }

  destroy() {
    this.domElement.removeEventListener('mousedown', this.mousedownHandler);
    document.removeEventListener('mouseup', this.mouseupHandler);
    document.removeEventListener('mousemove', this.mousemoveHandler);
  }
}

export { PlayerController, ThirdPersonCameraController, FirstPersonCameraController };
