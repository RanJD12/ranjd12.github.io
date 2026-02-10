import * as THREE from 'three';

export class InteractiveObject extends THREE.Group {
    constructor(id, name, prompt, onInteract) {
        super();
        this.objectId = id; // Renamed from 'id' to avoid conflict with THREE.Object3D.id
        this.name = name;
        this.promptText = prompt;
        this.onInteract = onInteract;
        this.isInteractive = true;
    }

    interact(gameState) {
        if (this.onInteract) {
            return this.onInteract(gameState);
        }
    }
}

export class Item extends InteractiveObject {
    constructor(id, name, prompt, mesh) {
        super(id, name, prompt, (state) => {
            state.inventory.add(id, name);
            this.visible = false;
            this.isInteractive = false;
            // Recursively hide all children just in case
            this.traverse(child => child.visible = false);
            return `Picked up ${name}`;
        });
        this.itemId = id;
        this.add(mesh);
        
        // Add an invisible interaction proxy for easier selection on small items
        const proxy = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.5, 0.5),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        this.add(proxy);
    }
}
