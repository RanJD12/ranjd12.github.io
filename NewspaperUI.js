export class NewspaperUI {
    constructor(onClose) {
        this.onClose = onClose;
        this.isVisible = false;
        this.createUI();
    }

    createUI() {
        this.container = document.createElement('div');
        this.container.id = 'newspaper-ui';
        this.container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 2000;
            font-family: 'Times New Roman', serif;
            color: #1a1a1a;
            user-select: none;
        `;

        this.paper = document.createElement('div');
        this.paper.style.cssText = `
            width: 80%;
            max-width: 800px;
            height: 90%;
            background: #e4e0d5;
            padding: 40px;
            box-shadow: 0 0 50px rgba(0,0,0,0.5);
            position: relative;
            overflow-y: auto;
            border: 1px solid #c4c0b5;
            background-image: radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.05) 100%);
        `;

        // Aging effects
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            background: rgba(0,0,0,0.02);
            opacity: 0.3;
        `;
        this.paper.appendChild(overlay);

        this.content = document.createElement('div');
        this.content.innerHTML = `
            <div style="text-align: center; border-bottom: 3px double #333; margin-bottom: 20px; padding-bottom: 10px;">
                <h1 style="font-size: 48px; margin: 0; letter-spacing: 2px; text-transform: uppercase;">The County Sentinel</h1>
                <div style="display: flex; justify-content: space-between; font-weight: bold; border-top: 1px solid #333; margin-top: 5px; padding: 5px 0;">
                    <span>Vol. LXIV — No. 112</span>
                    <span>Friday, October 14, 1994</span>
                    <span>Price: 50 Cents</span>
                </div>
            </div>

            <h2 style="font-size: 32px; line-height: 1.1; margin-top: 0; margin-bottom: 20px; column-span: all; -webkit-column-span: all;">VANISHING ON BLACKWOOD DRIVE: POLICE BAFFLED BY GROWING NUMBER OF DISAPPEARANCES</h2>
            <div style="column-count: 2; column-gap: 30px;">
                <p style="font-style: italic; margin-bottom: 20px; font-weight: bold;">By Elias Thorne, Sentinel Staff Writer</p>
                
                <p>Local authorities remain tight-lipped following the latest report of a missing person on the outskirts of town. Blackwood Drive, a stretch of road known for its quiet, industrial-adjacent properties, has become the center of a federal investigation after a third resident in as many months failed to report for work.</p>

                <p>The individual, identified as Sarah Miller, 34, was last seen by neighbors on Tuesday afternoon. Her husband, Arthur Miller, a local machinist at the Oakhaven Foundry, has reportedly been cooperative with investigators but appears "visibly distraught," according to Sheriff H. Vance.</p>

                <p>“We are exploring all avenues,” Vance stated during a brief press conference yesterday. “There is no evidence of a struggle at the residence, nor any indication of forced entry. It is as if she simply walked out the door and into the air.”</p>

                <p>However, neighbors tell a more disturbing story. Mrs. Gable, who lives two properties down, claims to have heard "unnatural humming" emanating from the Miller estate in the late hours of the night. “It’s that vibration,” Gable said, clutching her shawl. “It gets in your teeth. And the house... sometimes the lights, they don’t look right. They flicker in a way that makes your head spin.”</p>

                <p>More eccentric reports suggest that the very geometry of the area may be to blame. Unverified claims of "shifting walls" and "rooms that weren't there yesterday" have circulated among the local workforce, though police dismiss these as stress-induced hallucinations caused by the recent spate of industrial accidents at the nearby processing plant.</p>

                <p>“The house feels heavy,” said one anonymous source close to the family. “Arthur kept talking about a hallway that felt like it was growing. He said the bathroom light was a trigger. We thought he was losing his mind after Sarah left, but now that he's gone too... I don't know what to believe.”</p>

                <p>The Miller residence remains cordoned off. Search parties have scoured the surrounding woods and the basement levels of the old foundry, but no trace of the couple has been found. Meanwhile, the power company reports massive, unexplained surges in the Blackwood grid—surges that the plant manager claims are "physically impossible" given the current infrastructure.</p>

                <p>The Sentinel reminds readers to keep their doors locked and to report any unusual sounds or sightings to the Sheriff's office immediately. As the fog thickens over the valley this weekend, the mystery of Blackwood Drive only seems to deepen.</p>
            </div>

            <div style="margin-top: 40px; border-top: 1px solid #333; padding-top: 20px; text-align: center;">
                <button id="close-newspaper" style="
                    background: #1a1a1a;
                    color: #e4e0d5;
                    border: none;
                    padding: 12px 24px;
                    font-family: 'Courier New', Courier, monospace;
                    font-weight: bold;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    cursor: pointer;
                    box-shadow: 4px 4px 0px #888;
                    transition: all 0.1s;
                    touch-action: manipulation;
                ">Exit Newspaper</button>
            </div>
        `;
        this.paper.appendChild(this.content);
        this.container.appendChild(this.paper);
        document.body.appendChild(this.container);

        const closeBtn = this.container.querySelector('#close-newspaper');
        
        const close = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            this.hide();
        };

        // Use both click and touchend for maximum compatibility
        closeBtn.addEventListener('click', close);
        closeBtn.addEventListener('touchend', close);

        // Tactile feedback
        const pressDown = () => {
            closeBtn.style.transform = 'translate(2px, 2px)';
            closeBtn.style.boxShadow = '2px 2px 0px #888';
        };
        const pressUp = () => {
            closeBtn.style.transform = 'translate(0px, 0px)';
            closeBtn.style.boxShadow = '4px 4px 0px #888';
        };

        closeBtn.addEventListener('mousedown', pressDown);
        closeBtn.addEventListener('mouseup', pressUp);
        closeBtn.addEventListener('touchstart', (e) => {
            e.stopPropagation(); // Prevent container from firing
            pressDown();
        });
        closeBtn.addEventListener('touchend', (e) => {
            pressUp();
            close(e);
        });

        window.addEventListener('keydown', (e) => {
            if (this.isVisible) this.hide();
        });
    }

    show() {
        this.isVisible = true;
        this.container.style.display = 'flex';
    }

    hide() {
        this.isVisible = false;
        this.container.style.display = 'none';
        if (this.onClose) this.onClose();
    }
}