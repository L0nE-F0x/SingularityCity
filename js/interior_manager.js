/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   INTERIOR MANAGER (v15.2.0 - Estate Router Update)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const Interior = {
    isDragging: false,
    layer: null,
    activeModule: null,

    build(bld, layer) {
        this.layer = layer;
        
        // Route to the appropriate interior module
        if (bld.id.startsWith('res_') || bld.id.startsWith('house_')) {
            this.activeModule = InteriorRes;
        } else if (bld.type && ['launchpad', 'mission_control', 'assembly', 'tracking'].includes(bld.type) && typeof SpaceInterior !== 'undefined') {
            this.activeModule = SpaceInterior;
        } else {
            this.activeModule = InteriorCity;
        }

        if (this.activeModule && this.activeModule.build) {
            this.activeModule.build(bld, layer);
            this.isDragging = this.activeModule.isDragging;
        }
    },

    update() {
        if (this.activeModule && this.activeModule.update) {
            this.activeModule.update();
        }
    }
};
