import * as THREE from 'three';

export class NoteUI {
    constructor(onClose) {
        this.onClose = onClose;
        this.isVisible = false;
        this.setupUI();
    }

    setupUI() {
        this.container = document.createElement('div');
        this.container.id = 'note-ui';
        this.container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 2000;
            font-family: 'Crimson Text', serif;
        `;

        this.paper = document.createElement('div');
        this.paper.style.cssText = `
            width: 90%;
            max-width: 500px;
            background: #f4f1ea;
            padding: 40px;
            box-shadow: 0 0 50px rgba(0,0,0,1);
            position: relative;
            transform: rotate(-1deg);
            border: 1px solid #dcd7c9;
            color: #2c2c2c;
            line-height: 1.6;
        `;

        // Decorative torn edge effect (simplified with CSS)
        this.paper.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5), inset 0 0 100px rgba(0,0,0,0.05)';

        this.content = document.createElement('div');
        this.content.style.cssText = `
            font-size: 1.2rem;
            white-space: pre-wrap;
            min-height: 200px;
        `;

        this.closeBtn = document.createElement('div');
        this.closeBtn.innerHTML = `
            <button style="
                background: #1a1a1a;
                color: #f4f1ea;
                border: none;
                padding: 10px 20px;
                font-family: 'Courier New', Courier, monospace;
                font-weight: bold;
                text-transform: uppercase;
                letter-spacing: 2px;
                cursor: pointer;
                box-shadow: 3px 3px 0px #888;
                transition: all 0.1s;
                touch-action: manipulation;
                width: 100%;
            ">Put Down Note</button>
        `;
        this.closeBtn.style.cssText = `
            margin-top: 30px;
            text-align: center;
        `;
        
        const btn = this.closeBtn.querySelector('button');
        
        const handleClose = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            this.hide();
        };

        // Standard listeners
        btn.addEventListener('click', handleClose);

        // Tactile feedback
        const pressDown = () => {
            btn.style.transform = 'translate(2px, 2px)';
            btn.style.boxShadow = '1px 1px 0px #888';
        };
        const pressUp = () => {
            btn.style.transform = 'translate(0px, 0px)';
            btn.style.boxShadow = '3px 3px 0px #888';
        };
        
        btn.addEventListener('mousedown', pressDown);
        btn.addEventListener('mouseup', pressUp);
        btn.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            pressDown();
        });
        btn.addEventListener('touchend', (e) => {
            pressUp();
            handleClose(e);
        });

        this.paper.appendChild(this.content);
        this.paper.appendChild(this.closeBtn);
        this.container.appendChild(this.paper);
        document.body.appendChild(this.container);
    }

    show(text) {
        this.content.textContent = text;
        this.container.style.display = 'flex';
        this.isVisible = true;
        
        // Add a slight randomized rotation for that "handheld paper" feel
        this.paper.style.transform = `rotate(${(Math.random() - 0.5) * 4}deg) scale(0.95)`;
        setTimeout(() => {
            this.paper.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            this.paper.style.transform = `rotate(${(Math.random() - 0.5) * 2}deg) scale(1)`;
        }, 10);
    }

    hide() {
        this.container.style.display = 'none';
        this.isVisible = false;
        if (this.onClose) this.onClose();
    }
}
