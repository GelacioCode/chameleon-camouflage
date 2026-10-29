import * as THREE from 'three';
import { BODY_HEIGHT, PALETTE } from '@chameleon/shared';

const SEEKER_COLOR = '#f08a24';
const RADIUS = 0.26;

const bodyGeometry = new THREE.CapsuleGeometry(RADIUS, BODY_HEIGHT - RADIUS * 2, 6, 14);
const eyeGeometry = new THREE.SphereGeometry(0.055, 10, 8);
const pupilGeometry = new THREE.SphereGeometry(0.028, 8, 6);
const visorGeometry = new THREE.BoxGeometry(0.4, 0.09, 0.2);
const eyeMaterial = new THREE.MeshStandardMaterial({ color: '#f7f7f2', roughness: 0.4 });
const pupilMaterial = new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.3 });
const visorMaterial = new THREE.MeshStandardMaterial({ color: '#1d2a33', roughness: 0.25, metalness: 0.3 });

export class Avatar {
  readonly group = new THREE.Group();
  private readonly body: THREE.Mesh<THREE.CapsuleGeometry, THREE.MeshStandardMaterial>;
  private readonly visor: THREE.Mesh;

  constructor() {
    this.body = new THREE.Mesh(bodyGeometry, new THREE.MeshStandardMaterial({ roughness: 0.85 }));
    this.body.position.y = BODY_HEIGHT / 2;
    this.group.add(this.body);

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
      eye.position.set(side * 0.09, BODY_HEIGHT - 0.24, -RADIUS + 0.03);
      const pupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
      pupil.position.set(0, 0, -0.04);
      eye.add(pupil);
      this.group.add(eye);
    }

    this.visor = new THREE.Mesh(visorGeometry, visorMaterial);
    this.visor.position.set(0, BODY_HEIGHT - 0.24, -RADIUS + 0.06);
    this.group.add(this.visor);
  }

  setLook(role: 'hider' | 'seeker' | 'spectator', color: number): void {
    const seeker = role === 'seeker';
    this.body.material.color.set(seeker ? SEEKER_COLOR : (PALETTE[color] ?? PALETTE[0]));
    this.visor.visible = seeker;
  }

  place(x: number, z: number, yaw: number): void {
    this.group.position.set(x, 0, z);
    this.group.rotation.y = yaw;
  }

  dispose(): void {
    this.group.removeFromParent();
    this.body.material.dispose();
  }
}
