import * as THREE from 'three';

// Factory for creating procedural weapon meshes
export class WeaponFactory {

    // Create a sword for the Warrior
    static createSword() {
        const group = new THREE.Group();

        // Blade
        const bladeGeo = new THREE.BoxGeometry(0.08, 0.8, 0.02);
        const bladeMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.position.y = 0.4;
        blade.castShadow = true;
        group.add(blade);

        // Blade edge highlight
        const edgeGeo = new THREE.BoxGeometry(0.02, 0.75, 0.025);
        const edgeMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
        const edge = new THREE.Mesh(edgeGeo, edgeMat);
        edge.position.set(0.04, 0.4, 0);
        group.add(edge);

        // Guard (crossguard)
        const guardGeo = new THREE.BoxGeometry(0.25, 0.05, 0.05);
        const guardMat = new THREE.MeshLambertMaterial({ color: 0x8b7355 });
        const guard = new THREE.Mesh(guardGeo, guardMat);
        guard.position.y = 0;
        guard.castShadow = true;
        group.add(guard);

        // Handle
        const handleGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.2, 8);
        const handleMat = new THREE.MeshLambertMaterial({ color: 0x4a3728 });
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.position.y = -0.12;
        handle.castShadow = true;
        group.add(handle);

        // Pommel
        const pommelGeo = new THREE.SphereGeometry(0.04, 8, 8);
        const pommelMat = new THREE.MeshLambertMaterial({ color: 0x8b7355 });
        const pommel = new THREE.Mesh(pommelGeo, pommelMat);
        pommel.position.y = -0.24;
        pommel.castShadow = true;
        group.add(pommel);

        return {
            mesh: group,
            // KayKit hand bones: grip weapon so blade points forward from character
            offset: new THREE.Vector3(0, 0, 0.1),
            rotation: new THREE.Euler(0, 0, 0)
        };
    }

    // Create a crossbow for the Hunter
    static createCrossbow() {
        const group = new THREE.Group();

        // Main body (stock)
        const stockGeo = new THREE.BoxGeometry(0.08, 0.5, 0.06);
        const stockMat = new THREE.MeshLambertMaterial({ color: 0x5c4033 });
        const stock = new THREE.Mesh(stockGeo, stockMat);
        stock.position.y = 0;
        stock.castShadow = true;
        group.add(stock);

        // Bow arms (horizontal)
        const armGeo = new THREE.BoxGeometry(0.5, 0.04, 0.03);
        const armMat = new THREE.MeshLambertMaterial({ color: 0x3d2817 });
        const arms = new THREE.Mesh(armGeo, armMat);
        arms.position.set(0, 0.2, 0);
        arms.castShadow = true;
        group.add(arms);

        // Bow arm curve (left)
        const curveGeoL = new THREE.BoxGeometry(0.08, 0.04, 0.03);
        const curveL = new THREE.Mesh(curveGeoL, armMat);
        curveL.position.set(-0.27, 0.18, 0);
        curveL.rotation.z = -0.3;
        group.add(curveL);

        // Bow arm curve (right)
        const curveR = new THREE.Mesh(curveGeoL.clone(), armMat);
        curveR.position.set(0.27, 0.18, 0);
        curveR.rotation.z = 0.3;
        group.add(curveR);

        // String
        const stringMat = new THREE.LineBasicMaterial({ color: 0xdddddd });
        const stringPoints = [
            new THREE.Vector3(-0.3, 0.15, 0),
            new THREE.Vector3(0, 0.05, 0),
            new THREE.Vector3(0.3, 0.15, 0)
        ];
        const stringGeo = new THREE.BufferGeometry().setFromPoints(stringPoints);
        const string = new THREE.Line(stringGeo, stringMat);
        group.add(string);

        // Bolt groove
        const grooveGeo = new THREE.BoxGeometry(0.02, 0.35, 0.02);
        const grooveMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
        const groove = new THREE.Mesh(grooveGeo, grooveMat);
        groove.position.set(0, 0.05, 0.04);
        group.add(groove);

        // Loaded bolt
        const boltGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.3, 6);
        const boltMat = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
        const bolt = new THREE.Mesh(boltGeo, boltMat);
        bolt.position.set(0, 0.1, 0.04);
        bolt.rotation.x = Math.PI / 2;
        bolt.castShadow = true;
        group.add(bolt);

        // Bolt tip
        const tipGeo = new THREE.ConeGeometry(0.02, 0.05, 6);
        const tipMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
        const tip = new THREE.Mesh(tipGeo, tipMat);
        tip.position.set(0, 0.28, 0.04);
        tip.rotation.x = Math.PI / 2;
        group.add(tip);

        return {
            mesh: group,
            // KayKit hand bones: crossbow held horizontally, aiming forward
            offset: new THREE.Vector3(0, 0, 0.15),
            rotation: new THREE.Euler(0, Math.PI, Math.PI / 2)
        };
    }

    // Create a staff for the Mage
    static createStaff() {
        const group = new THREE.Group();

        // Staff shaft
        const shaftGeo = new THREE.CylinderGeometry(0.025, 0.03, 1.4, 8);
        const shaftMat = new THREE.MeshLambertMaterial({ color: 0x4a3728 });
        const shaft = new THREE.Mesh(shaftGeo, shaftMat);
        shaft.position.y = 0;
        shaft.castShadow = true;
        group.add(shaft);

        // Staff head mount
        const mountGeo = new THREE.CylinderGeometry(0.05, 0.03, 0.1, 8);
        const mountMat = new THREE.MeshLambertMaterial({ color: 0x8b7355 });
        const mount = new THREE.Mesh(mountGeo, mountMat);
        mount.position.y = 0.7;
        mount.castShadow = true;
        group.add(mount);

        // Crystal orb
        const orbGeo = new THREE.SphereGeometry(0.08, 16, 16);
        const orbMat = new THREE.MeshBasicMaterial({
            color: 0x4488ff,
            transparent: true,
            opacity: 0.8
        });
        const orb = new THREE.Mesh(orbGeo, orbMat);
        orb.position.y = 0.85;
        group.add(orb);

        // Inner glow
        const glowGeo = new THREE.SphereGeometry(0.05, 12, 12);
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0xaaddff,
            transparent: true,
            opacity: 0.9
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.y = 0.85;
        group.add(glow);

        // Crystal prongs
        const prongGeo = new THREE.ConeGeometry(0.015, 0.12, 4);
        const prongMat = new THREE.MeshLambertMaterial({ color: 0x8b7355 });

        for (let i = 0; i < 4; i++) {
            const prong = new THREE.Mesh(prongGeo, prongMat);
            const angle = (i / 4) * Math.PI * 2;
            prong.position.set(
                Math.cos(angle) * 0.06,
                0.78,
                Math.sin(angle) * 0.06
            );
            prong.rotation.x = Math.PI;
            prong.rotation.z = Math.cos(angle) * 0.3;
            prong.rotation.x += Math.sin(angle) * 0.3;
            group.add(prong);
        }

        // Shaft wrapping (decorative)
        const wrapGeo = new THREE.TorusGeometry(0.035, 0.008, 8, 16);
        const wrapMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
        for (let i = 0; i < 3; i++) {
            const wrap = new THREE.Mesh(wrapGeo, wrapMat);
            wrap.position.y = -0.4 + i * 0.15;
            wrap.rotation.x = Math.PI / 2;
            group.add(wrap);
        }

        // Bottom cap
        const capGeo = new THREE.SphereGeometry(0.035, 8, 8);
        const cap = new THREE.Mesh(capGeo, mountMat);
        cap.position.y = -0.72;
        cap.castShadow = true;
        group.add(cap);

        return {
            mesh: group,
            // KayKit hand bones: staff held vertically, crystal at top
            offset: new THREE.Vector3(0, 0.1, 0),
            rotation: new THREE.Euler(Math.PI / 2, 0, 0)
        };
    }

    // Get weapon for a specific class
    static createWeaponForClass(className) {
        switch (className.toLowerCase()) {
            case 'warrior':
                return WeaponFactory.createSword();
            case 'hunter':
                return WeaponFactory.createCrossbow();
            case 'mage':
                return WeaponFactory.createStaff();
            default:
                return WeaponFactory.createSword();
        }
    }
}
