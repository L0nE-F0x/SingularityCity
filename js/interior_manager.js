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
        } else if ((bld.id.startsWith('dc_') || bld.id.startsWith('fab_')) && typeof InteriorDC !== 'undefined') {
            this.activeModule = InteriorDC;
        } else if (bld.id === 'neon_bar' && typeof InteriorBar !== 'undefined') {
            this.activeModule = InteriorBar;
        } else if (bld.id.startsWith('power_') && typeof InteriorPower !== 'undefined') {
            this.activeModule = InteriorPower;
        } else if (bld.id === 'bld_1' && typeof InteriorLegacy !== 'undefined') {
            this.activeModule = InteriorLegacy;
        } else if (bld.id.startsWith('npc_apt_') && typeof InteriorNPC !== 'undefined') {
            this.activeModule = InteriorNPC;
        } else if (bld.id.startsWith('suburb_') && typeof InteriorNPC !== 'undefined') {
            this.activeModule = InteriorNPC;
        } else if (bld.type === 'university' && typeof UniversityInterior !== 'undefined') {
            this.activeModule = UniversityInterior;
        } else if (bld.type === 'court' && typeof CourtInterior !== 'undefined') {
            this.activeModule = CourtInterior;
        } else if (bld.id === 'convention_center' && typeof ConferenceInterior !== 'undefined') {
            this.activeModule = ConferenceInterior;
        } else if (bld.type === 'vcrow' && typeof InteriorVCRow !== 'undefined') {
            this.activeModule = InteriorVCRow;
        } else if (bld.type === 'backbone' && typeof InteriorBackbone !== 'undefined') {
            this.activeModule = InteriorBackbone;
        } else if (bld.type === 'robotics' && typeof InteriorRobotics !== 'undefined') {
            this.activeModule = InteriorRobotics;
        } else if (bld.type === 'longevity' && typeof InteriorLongevity !== 'undefined') {
            this.activeModule = InteriorLongevity;
        } else {
            this.activeModule = InteriorCity;
        }

        if (this.activeModule && this.activeModule.build) {
            this.activeModule.build(bld, layer);
            this.isDragging = this.activeModule.isDragging;
        }
    },

    cleanup() {
        // Remove stale window event listeners when exiting any interior
        if (this.activeModule) {
            // Modules use either onMove/_onMove and onUp/_onUp patterns
            const moveFn = this.activeModule.onMove || this.activeModule._onMove;
            const upFn = this.activeModule.onUp || this.activeModule._onUp;
            if (moveFn) window.removeEventListener('pointermove', moveFn);
            if (upFn) window.removeEventListener('pointerup', upFn);
            this.activeModule.isDragging = false;
            this.activeModule.scene = null;
            if (this.activeModule.layer) {
                this.activeModule.layer.removeAllListeners();
                this.activeModule.layer = null;
            }
        }
        this.activeModule = null;
        this.isDragging = false;
    },

    update() {
        if (this.activeModule && this.activeModule.update) {
            this.activeModule.update();
        }
    }
};
