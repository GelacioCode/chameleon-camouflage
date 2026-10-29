import * as THREE from 'three';
import { mapDefinition } from '@chameleon/shared';
import { createOfficeMap, loadOfficeAssets, type OfficeMap } from './officeMap.js';

export interface World {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  map: OfficeMap;
  resize(): void;
  dispose(): void;
}

// Lighting and tone mapping follow the v6 map viewer.
export async function createWorld(container: HTMLElement): Promise<World> {
  const assets = await loadOfficeAssets(THREE, { baseUrl: new URL('/maps/office/', location.origin) });
  const map = createOfficeMap(THREE, mapDefinition, { layout: 'plan', assets });
  // The map is static; bake transforms once instead of every frame.
  map.group.traverse((o) => {
    o.updateMatrix();
    o.matrixAutoUpdate = false;
  });
  map.group.updateMatrixWorld(true);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#dcded8');
  scene.fog = new THREE.Fog('#e6e7df', 35, 85);
  scene.add(map.group);
  scene.add(new THREE.HemisphereLight(0xf9f4e4, 0x827d70, 2.15));
  const sun = new THREE.DirectionalLight(0xfff0d2, 2.4);
  sun.position.set(-15, 10, 4);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(10, 5, -10);
  scene.add(fill);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  container.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(66, 1, 0.08, 100);
  camera.rotation.order = 'YXZ';

  const resize = () => {
    const w = container.clientWidth || innerWidth;
    const h = container.clientHeight || innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  resize();

  return {
    renderer,
    scene,
    camera,
    map,
    resize,
    dispose() {
      scene.remove(map.group);
      map.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
