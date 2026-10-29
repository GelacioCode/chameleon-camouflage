import type * as THREE from 'three';

export interface OfficeAsset {
  id: string;
  kind: 'art' | 'memes';
  title: string;
  path: string;
  width: number;
  height: number;
  family?: string;
  texture: THREE.Texture;
}

export interface OfficeAssets {
  art: OfficeAsset[];
  memes: OfficeAsset[];
}

export interface OfficeMap {
  group: THREE.Group;
  spawn: [number, number, number];
  monitors: { group: THREE.Group; screen: THREE.Mesh; x: number; z: number; rotation: number; on: boolean }[];
  props: Record<string, unknown>[];
  stats: { monitors: number; on: number; off: number; props: number };
  dispose(): void;
}

export function createOfficeMap(
  three: typeof THREE,
  definition: unknown,
  options?: { layout?: 'plan' | 'photo'; assets?: OfficeAssets | null },
): OfficeMap;

export function loadOfficeAssets(three: typeof THREE, options?: { baseUrl?: URL }): Promise<OfficeAssets>;
