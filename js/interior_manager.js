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
        } else if (bld.id.startsWith('npc_apt_') && typeof InteriorNPC !== 'undefined') {
            this.activeModule = InteriorNPC;
        } else if (bld.type === 'university' && typeof UniversityInterior !== 'undefined') {
            this.activeModule = UniversityInterior;
        } else if (bld.type === 'court' && typeof CourtInterior !== 'undefined') {
            this.activeModule = CourtInterior;
        } else if (bld.id === 'convention_center' && typeof ConferenceInterior !== 'undefined') {
            this.activeModule = ConferenceInterior;
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
