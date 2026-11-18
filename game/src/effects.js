// Short-lived visual effects: sparks, smoke, muzzle flashes, skid marks and
// explosions. All of them are plain three.js meshes pooled per frame.

import * as THREE from 'three';

export function createEffects(scene) {
  const particles = [];
  const pool = [];
  const skidGroup = new THREE.Group();
  scene.add(skidGroup);

  function spawnParticle(pos, vel, life, size, color) {
    let p = pool.pop();
    if (!p) {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
      p = { mesh: new THREE.Mesh(geo, mat), vel: new THREE.Vector3(), life: 0, maxLife: 1 };
      scene.add(p.mesh);
    }
    p.mesh.visible = true;
    p.mesh.position.copy(pos);
    p.mesh.scale.setScalar(size);
    p.mesh.material.color.setHex(color);
    p.mesh.material.opacity = 1;
    p.vel.copy(vel);
    p.life = life; p.maxLife = life;
    particles.push(p);
  }

  return {
    // A burst of sparks (gun hit, crash, explosion).
    sparks(pos, n = 12, color = 0xffcc33) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = new THREE.Vector3(Math.cos(a) * (3 + Math.random() * 7), 2 + Math.random() * 6, Math.sin(a) * (3 + Math.random() * 7));
        spawnParticle(pos, v, 0.3 + Math.random() * 0.4, 0.12 + Math.random() * 0.14, color);
      }
    },
    // Grey smoke puff.
    smoke(pos, n = 6) {
      for (let i = 0; i < n; i++) {
        const v = new THREE.Vector3((Math.random() - 0.5) * 2, 1 + Math.random() * 2, (Math.random() - 0.5) * 2);
        spawnParticle(pos, v, 0.8 + Math.random() * 0.6, 0.35 + Math.random() * 0.3, 0x888888);
      }
    },
    // A quick muzzle flash at the barrel.
    muzzle(pos, dir) {
      const v = dir.clone().multiplyScalar(6);
      spawnParticle(pos, v, 0.08, 0.5, 0xffee88);
      spawnParticle(pos, new THREE.Vector3(), 0.05, 0.7, 0xffcc44);
    },
    // A dark skid mark quad on the road.
    skid(pos, heading) {
      const geo = new THREE.PlaneGeometry(0.35, 2.2);
      const mat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.55, depthWrite: false });
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = -heading;
      m.position.set(pos.x, 0.06, pos.z);
      skidGroup.add(m);
      if (skidGroup.children.length > 120) {
        const old = skidGroup.children.shift();
        old.geometry.dispose(); old.material.dispose();
        skidGroup.remove(old);
      }
    },
    // A big explosion: sparks, smoke and a flash.
    explosion(pos) {
      this.sparks(pos, 30, 0xff7722);
      this.smoke(pos, 12);
      spawnParticle(pos, new THREE.Vector3(), 0.25, 3.5, 0xffdd66);
    },
    update(dt) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          p.mesh.visible = false;
          pool.push(p);
          particles.splice(i, 1);
          continue;
        }
        p.vel.y -= 12 * dt;
        p.mesh.position.addScaledVector(p.vel, dt);
        p.mesh.material.opacity = p.life / p.maxLife;
        p.mesh.scale.multiplyScalar(1 - dt * 0.5);
      }
    },
  };
}
