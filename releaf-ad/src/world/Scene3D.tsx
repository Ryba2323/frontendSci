import { ThreeCanvas } from '@remotion/three';
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { loadAssets } from '../lib/fonts';
import { useT } from '../lib/time';
import { World } from './World';

const Rig = ({ world, t }: { world: World; t: number }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  // aktualizacja w fazie renderu — przed klatką, którą @remotion/three wyrysowuje
  world.update(t, camera);
  return <primitive object={world.scene} />;
};

export const Scene3D = () => {
  const t = useT();
  const [assets, setAssets] = useState<Awaited<ReturnType<typeof loadAssets>> | null>(null);
  useEffect(() => {
    loadAssets().then(setAssets);
  }, []);
  const world = useMemo(() => (assets ? new World(assets.outline, assets.logo) : null), [assets]);
  if (!world) return null;
  return (
    <ThreeCanvas
      width={1080}
      height={1920}
      linear
      flat
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ fov: 40, near: 0.05, far: 400, position: [0, 0, 0] }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Rig world={world} t={t} />
    </ThreeCanvas>
  );
};
