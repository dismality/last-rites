// Shared materials for the hut and the chapel (one per surface, so meshes batch their state).

import * as THREE from 'three'

export const PART_MATERIALS = {
  wood: new THREE.MeshStandardMaterial({ color: '#4b3827', roughness: 1 }),
  darkWood: new THREE.MeshStandardMaterial({ color: '#2d2118', roughness: 1 }),
  floor: new THREE.MeshStandardMaterial({ color: '#3a2c20', roughness: 1 }),
  slate: new THREE.MeshStandardMaterial({ color: '#2b2e35', roughness: 0.9 }),
  stone: new THREE.MeshStandardMaterial({ color: '#6a655e', roughness: 0.95 }),
  trim: new THREE.MeshStandardMaterial({ color: '#4a463f', roughness: 0.95 }),
  bronze: new THREE.MeshStandardMaterial({ color: '#6b4a1e', roughness: 0.6, metalness: 0.4 }),
  // Lit windows: emissive so they read as candlelight from outside, and they bloom a little.
  glass: new THREE.MeshStandardMaterial({
    color: '#2a1d10',
    emissive: '#e8913a',
    emissiveIntensity: 0.55,
    roughness: 0.4,
  }),
}
export type PartMaterial = keyof typeof PART_MATERIALS
