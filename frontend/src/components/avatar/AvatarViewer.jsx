import { Component, Suspense, useLayoutEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";

const MODEL_PATH = "/models/harry.glb";

const VISEME_TARGETS = [
  "viseme_sil",
  "viseme_PP",
  "viseme_FF",
  "viseme_TH",
  "viseme_DD",
  "viseme_kk",
  "viseme_CH",
  "viseme_SS",
  "viseme_nn",
  "viseme_RR",
  "viseme_aa",
  "viseme_E",
  "viseme_I",
  "viseme_O",
  "viseme_U",
];

const MOUTH_TARGETS = ["mouthOpen", "mouthClose", "jawOpen"];
const CONSONANT_HEAD_TARGETS = [
  "viseme_PP",
  "viseme_FF",
  "viseme_TH",
  "viseme_DD",
  "viseme_kk",
  "viseme_CH",
  "viseme_SS",
  "viseme_nn",
  "viseme_RR",
  "mouthClose",
];
const FACIAL_TARGETS = [
  ...VISEME_TARGETS,
  ...MOUTH_TARGETS,
  "eyeBlinkLeft",
  "eyeBlinkRight",
  "mouthSmileLeft",
  "mouthSmileRight",
];

function findMorphIndex(dictionary, targetName) {
  if (!dictionary) return undefined;
  if (dictionary[targetName] !== undefined) return dictionary[targetName];

  const normalizedTarget = targetName.toLowerCase();
  const match = Object.entries(dictionary).find(
    ([name]) => name.toLowerCase() === normalizedTarget,
  );

  return match?.[1];
}

function setMorph(mesh, morphIndex, value) {
  if (morphIndex === undefined || !mesh.morphTargetInfluences) return;
  mesh.morphTargetInfluences[morphIndex] = THREE.MathUtils.clamp(value, 0, 1);
}

function setMorphDamped(mesh, morphIndex, value, delta) {
  if (morphIndex === undefined || !mesh.morphTargetInfluences) return;
  const current = mesh.morphTargetInfluences[morphIndex] ?? 0;
  const target = Math.abs(value) < 0.006 ? 0 : value;
  const diff = Math.abs(target - current);

  if (diff < 0.003) {
    setMorph(mesh, morphIndex, target);
    return;
  }

  const lambda = target > current ? 6.5 : 9.5;
  setMorph(mesh, morphIndex, THREE.MathUtils.damp(current, target, lambda, delta));
}

function AvatarModel({ lipSyncFrameRef }) {
  const { scene } = useGLTF(MODEL_PATH);
  const morphMeshes = useRef([]);
  const headBone = useRef(null);
  const baseHeadRotation = useRef(null);
  const speechActivity = useRef(0);
  const consonantActivity = useRef(0);
  const consonantPulse = useRef(0);
  const previousConsonant = useRef(0);

  useLayoutEffect(() => {
    const discoveredMorphMeshes = [];
    let discoveredHeadBone = null;

    scene.traverse((object) => {
      if ((object.isMesh || object.isSkinnedMesh) && object.morphTargetDictionary) {
        const targets = FACIAL_TARGETS.reduce((found, targetName) => {
          const index = findMorphIndex(object.morphTargetDictionary, targetName);
          if (index !== undefined) found[targetName] = index;
          return found;
        }, {});

        if (Object.keys(targets).length > 0) {
          discoveredMorphMeshes.push({ mesh: object, targets });
        }
      }

      if ((object.isBone || object.type === "Bone") && !discoveredHeadBone) {
        const boneName = object.name.toLowerCase();
        if (boneName.includes("head") || boneName.includes("neck")) {
          discoveredHeadBone = object;
        }
      }
    });

    morphMeshes.current = discoveredMorphMeshes;
    headBone.current = discoveredHeadBone;
    baseHeadRotation.current = discoveredHeadBone?.rotation.clone() ?? null;
  }, [scene]);

  useFrame(({ clock }, delta) => {
    const time = clock.getElapsedTime();
    const blinkCycle = time % 3.6;
    const blink = blinkCycle < 0.18 ? Math.sin((blinkCycle / 0.18) * Math.PI) : 0;
    const mouthInfluences = {};
    const lipSyncFrame = lipSyncFrameRef?.current;
    const strongestViseme = Math.max(
      0,
      ...Object.values(lipSyncFrame?.visemes ?? {}).map((value) => Number(value) || 0),
    );
    const mouthActivity = lipSyncFrame?.active
      ? THREE.MathUtils.clamp((lipSyncFrame.jawOpen ?? 0) + strongestViseme * 0.45, 0, 1)
      : 0;
    const speechEnergy = lipSyncFrame?.active
      ? THREE.MathUtils.clamp(lipSyncFrame.speechEnergy ?? mouthActivity, 0, 1)
      : 0;
    const consonantStrength = lipSyncFrame?.active
      ? Math.max(
          0,
          ...CONSONANT_HEAD_TARGETS.map(
            (targetName) => Number(lipSyncFrame.visemes?.[targetName]) || 0,
          ),
        )
      : 0;
    const consonantAttack = Math.max(0, consonantStrength - previousConsonant.current);
    const activityLambda = speechEnergy > speechActivity.current ? 11 : 4;
    const consonantLambda = consonantStrength > consonantActivity.current ? 18 : 8;

    if (consonantAttack > 0.12 && speechEnergy > 0.08) {
      consonantPulse.current = Math.min(1, consonantPulse.current + consonantAttack * 0.55);
    }

    speechActivity.current = THREE.MathUtils.damp(
      speechActivity.current,
      speechEnergy,
      activityLambda,
      delta,
    );
    consonantActivity.current = THREE.MathUtils.damp(
      consonantActivity.current,
      consonantStrength,
      consonantLambda,
      delta,
    );
    consonantPulse.current = THREE.MathUtils.damp(consonantPulse.current, 0, 7.5, delta);
    previousConsonant.current = consonantStrength;

    [...VISEME_TARGETS, ...MOUTH_TARGETS].forEach((targetName) => {
      mouthInfluences[targetName] = 0;
    });

    Object.entries(lipSyncFrame?.visemes ?? {}).forEach(([targetName, value]) => {
      mouthInfluences[targetName] = value;
    });
    mouthInfluences.jawOpen = lipSyncFrame?.jawOpen ?? 0;

    morphMeshes.current.forEach(({ mesh, targets }) => {
      Object.entries(mouthInfluences).forEach(([targetName, value]) => {
        setMorphDamped(mesh, targets[targetName], value, delta);
      });
      setMorph(mesh, targets.eyeBlinkLeft, blink);
      setMorph(mesh, targets.eyeBlinkRight, blink);
    });

    if (headBone.current && baseHeadRotation.current) {
      const speech = speechActivity.current;
      const consonants = consonantActivity.current;
      const pulse = consonantPulse.current;
      const naturalBob =
        Math.sin(time * 3.1 + 0.4) +
        Math.sin(time * 5.7 + 1.9) * 0.42 +
        Math.sin(time * 8.3 + 0.2) * 0.18;
      const naturalTurn =
        Math.sin(time * 2.6 + 2.1) +
        Math.sin(time * 4.9 + 0.3) * 0.35;
      const speechBob = naturalBob * 0.014 * speech + pulse * 0.022;
      const speechTurn = naturalTurn * 0.011 * speech + consonants * 0.006;

      headBone.current.rotation.x =
        baseHeadRotation.current.x + Math.sin(time * 0.8) * 0.012 + speechBob;
      headBone.current.rotation.y =
        baseHeadRotation.current.y + Math.sin(time * 0.55) * 0.02 + speechTurn;
      headBone.current.rotation.z =
        baseHeadRotation.current.z + Math.sin(time * 0.7) * 0.01 + speechTurn * 0.35;
    }
  });

  return <primitive object={scene} position={[0, -1.38, 0]} scale={1.18} />;
}

class AvatarErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error("[Avatar load error]", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="avatar-error">
          <strong>Avatar unavailable</strong>
          <span>Check /models/harry.glb.</span>
        </div>
      );
    }

    return this.props.children;
  }
}

function Loading() {
  return <div className="avatar-loading">Loading avatar...</div>;
}

export default function AvatarViewer({ lipSyncFrameRef }) {
  return (
    <AvatarErrorBoundary>
      <Canvas
        camera={{ position: [0, 0.18, 1.02], fov: 25 }}
        gl={{ antialias: true, alpha: true }}
        shadows
      >
        <ambientLight intensity={0.75} />
        <directionalLight position={[3, 4, 5]} intensity={2.1} />
        <directionalLight position={[-4, 2, -3]} intensity={0.7} />
        <Suspense
          fallback={
            <Html center>
              <Loading />
            </Html>
          }
        >
          <AvatarModel lipSyncFrameRef={lipSyncFrameRef} />
        </Suspense>
      </Canvas>
    </AvatarErrorBoundary>
  );
}

useGLTF.preload(MODEL_PATH);
