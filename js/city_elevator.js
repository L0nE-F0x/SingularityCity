/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   LIFT FLOOR INDICATORS — shared by CityElevator and ResElevator (interior_res_props.js)

   Above every lift door is a strip with one dim dot per floor, plus a green dot for the floor the car
   is passing. Every door shows the same strip, so the dots are drawn once and every door shares that
   geometry. After that only the green dot moves, and only when the car reaches another floor.

   It used to be one Graphics per floor on every door (floors² objects), all cleared and redrawn every
   frame. A 102-floor residential tower rebuilt 10,404 of them 60 times a second, for dots a third of a
   pixel apart.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

class LiftIndicators {
    // One strip per floor from minFloor to numFloors - 1, in the lift layer's coordinates.
    constructor(layer, x, floorHeight, minFloor, numFloors) {
        this.minFloor = minFloor;
        this.totalFloors = numFloors - minFloor;
        this.spacing = Math.min(6, 36 / this.totalFloors);
        this.litFloor = null;
        this.panels = [];

        const r = Math.min(1.5, this.spacing / 3);
        let dimGeom = null;
        let litGeom = null;
        for (let i = minFloor; i < numFloors; i++) {
            const panel = new PIXI.Container();
            panel.x = x;
            panel.y = -i * floorHeight - floorHeight + 12;

            const dim = new PIXI.Graphics(dimGeom);
            if (!dimGeom) {
                dim.beginFill(0x222222);
                for (let j = 0; j < this.totalFloors; j++) dim.drawCircle(this._dotX(j), 0, r);
                dim.endFill();
                dimGeom = dim.geometry;
            }
            const lit = new PIXI.Graphics(litGeom);
            if (!litGeom) {
                lit.beginFill(0x4ade80);
                lit.drawCircle(0, 0, r);
                lit.endFill();
                litGeom = lit.geometry;
            }
            lit.visible = false;

            panel.addChild(dim, lit);
            panel._lit = lit;
            layer.addChild(panel);
            this.panels.push(panel);
        }
    }

    _dotX(idx) {
        return (idx - this.totalFloors / 2) * this.spacing + this.spacing / 2;
    }

    // Light `floor` on every strip. Does nothing until the car reaches a different floor.
    setFloor(floor) {
        if (floor === this.litFloor) return;
        this.litFloor = floor;
        const idx = floor - this.minFloor;
        const on = idx >= 0 && idx < this.totalFloors;
        const x = this._dotX(idx);
        for (const p of this.panels) {
            if (p.destroyed) continue;
            p._lit.visible = on;
            p._lit.x = x;
        }
    }

    destroy() {
        for (const p of this.panels) if (!p.destroyed) p.destroy({ children: true });
        this.panels = [];
    }
}

/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   CITY ELEVATOR (v16.5.0 - Extracted from interior_city_props.js)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

class CityElevator {
    constructor(layer, numFloors, floorHeight, shaftX) {
        this.layer = layer;
        this.numFloors = numFloors;
        this.floorHeight = floorHeight;
        this.x = shaftX;
        this.destroyed = false;

        this.state = 'idle';
        this.currentFloor = 0;
        this.targetFloor = 0;
        this.timer = 0;
        this.doorWidth = 24;
        this.speed = 2.5;

        this.callQueue = [];
        this.doors = [];

        this.shaft = new PIXI.Graphics();
        this.shaft.beginFill(0x1a1a24);
        this.shaft.drawRect(
            this.x - this.doorWidth,
            -((this.numFloors - 1) * this.floorHeight),
            this.doorWidth * 2,
            (this.numFloors + 1) * this.floorHeight
        );
        this.shaft.endFill();
        this.layer.addChild(this.shaft);

        this.car = new PIXI.Graphics();
        this.car.beginFill(0x3a3a4c);
        this.car.drawRect(-this.doorWidth, -this.floorHeight + 5, this.doorWidth * 2, this.floorHeight - 5);
        this.car.endFill();
        this.car.x = this.x;
        this.car.y = 0;
        this.layer.addChild(this.car);

        for (let i = -1; i < numFloors; i++) {
            let fy = -i * this.floorHeight;

            let leftDoor = new PIXI.Graphics();
            let rightDoor = new PIXI.Graphics();
            this.drawDoor(leftDoor, true);
            this.drawDoor(rightDoor, false);
            leftDoor.x = this.x;
            leftDoor.y = fy;
            rightDoor.x = this.x;
            rightDoor.y = fy;

            this.layer.addChild(leftDoor, rightDoor);

            this.doors.push({
                left: leftDoor,
                right: rightDoor,
                openAmt: 0,
                floorNum: i,
            });
        }

        this.indicators = new LiftIndicators(this.layer, this.x, this.floorHeight, -1, numFloors);
    }

    drawDoor(gfx, isLeft) {
        gfx.clear();
        gfx.beginFill(0x4a4a5a);
        gfx.lineStyle(1, 0x2a2a3a);
        if (isLeft) {
            gfx.drawRect(-this.doorWidth, -this.floorHeight + 5, this.doorWidth, this.floorHeight - 5);
        } else {
            gfx.drawRect(0, -this.floorHeight + 5, this.doorWidth, this.floorHeight - 5);
        }
        gfx.endFill();
    }

    call(floor) {
        if (!this.callQueue.includes(floor) && (this.currentFloor !== floor || this.state !== 'open')) {
            this.callQueue.push(floor);
        }
    }

    update() {
        if (this.destroyed || !this.car || this.car.destroyed) {
            this.destroyed = true;
            return;
        }
        this.indicators.setFloor(-Math.round(this.car.y / this.floorHeight));

        if (this.state === 'idle') {
            if (this.callQueue.length > 0) {
                this.targetFloor = this.callQueue.shift();
                if (this.targetFloor === this.currentFloor) {
                    this.state = 'opening';
                } else {
                    this.state = 'moving';
                }
            }
        } else if (this.state === 'moving') {
            let targetY = -this.targetFloor * this.floorHeight;
            let dir = Math.sign(targetY - this.car.y);
            this.car.y += dir * this.speed;

            if (Math.abs(this.car.y - targetY) <= this.speed) {
                this.car.y = targetY;
                this.currentFloor = this.targetFloor;
                this.state = 'opening';
            }
        } else if (this.state === 'opening') {
            let door = this.doors[this.currentFloor + 1];
            door.openAmt += 0.05;
            if (door.openAmt >= 1) {
                door.openAmt = 1;
                this.state = 'open';
                this.timer = 90;
            }
            this.updateDoorVisuals(door);
        } else if (this.state === 'open') {
            this.timer--;
            if (this.timer <= 0) {
                this.state = 'closing';
            }
        } else if (this.state === 'closing') {
            let door = this.doors[this.currentFloor + 1];
            door.openAmt -= 0.05;
            if (door.openAmt <= 0) {
                door.openAmt = 0;
                this.state = 'idle';
            }
            this.updateDoorVisuals(door);
        }
    }

    updateDoorVisuals(door) {
        door.left.x = this.x - door.openAmt * this.doorWidth * 0.9;
        door.right.x = this.x + door.openAmt * this.doorWidth * 0.9;
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        if (this.shaft && !this.shaft.destroyed) this.shaft.destroy();
        this.shaft = null;
        if (this.car && !this.car.destroyed) this.car.destroy();
        this.car = null;
        if (this.doors) {
            this.doors.forEach((d) => {
                if (d.left && !d.left.destroyed) d.left.destroy();
                if (d.right && !d.right.destroyed) d.right.destroy();
            });
            this.doors = [];
        }
        if (this.indicators) this.indicators.destroy();
    }
}
