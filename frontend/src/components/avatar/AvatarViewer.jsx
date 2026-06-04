import { Component, Suspense, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Html, useGLTF } from "@react-three/drei";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import * as THREE from "three";

const AVATAR_CONFIGS = {
  male: {
    modelPath: "/models/harry.glb",
    position: [0, -2, 0],
    scale: 1.18,
    camera: { position: [0, 0, 1.2], fov: 25 },
    headGazeOffset: { pitchUp: -0.07, turnRight: -0.1 },
    headMotion: 1,
    lipSyncAvailable: true,
  },
  female: {
    loader: "fbx",
    modelPath: "/models/female-rpm-vrchat/source/Wolf3D_readyplayerme_male_01.fbx",
    position: [0, -1.55, -0.08],
    scale: 0.0092,
    camera: { position: [0, 0, 1.2], fov: 25 },
    headGazeOffset: { pitchUp: -0.015, turnRight: 0.01 },
    headMotion: 0.42,
    prepareMaterials: true,
    boneWorldRotationOffsets: [
      { name: "LeftArm", axis: [0, 0, 1], angle: -0.95 },
      { name: "RightArm", axis: [0, 0, 1], angle: 0.95 },
    ],
    lipSyncAvailable: true,
  },
};

const VISUALIZER_CAMERA = { position: [0, 0, 3.05], fov: 34 };

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

const MOUTH_TARGETS = [
  "mouthOpen",
  "mouthClose",
  "jawOpen",
  "mouthFunnel",
  "mouthPucker",
  "mouthPressLeft",
  "mouthPressRight",
];
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
const REQUIRED_FACIAL_TARGETS = [...VISEME_TARGETS, ...MOUTH_TARGETS, "eyeBlinkLeft", "eyeBlinkRight"];

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

  const lambda = target > current ? 22 : 16;
  setMorph(mesh, morphIndex, THREE.MathUtils.damp(current, target, lambda, delta));
}

function resetMorphs(mesh) {
  if (!mesh.morphTargetInfluences) return;
  mesh.morphTargetInfluences.fill(0);
}

function prepareAvatarMaterial(material) {
  if (!material) return;

  const materials = Array.isArray(material) ? material : [material];
  materials.forEach((item) => {
    if (item.map) {
      item.map.colorSpace = THREE.SRGBColorSpace;
      item.map.needsUpdate = true;
    }
    if (item.normalMap) item.normalScale?.set?.(0.62, 0.62);
    if (item.color) item.color.lerp(new THREE.Color(0xffffff), 0.18);
    if ("roughness" in item) item.roughness = 0.34;
    if ("metalness" in item) item.metalness = 0.02;
    if ("shininess" in item) item.shininess = 38;
    if (item.specular) item.specular.set("#242424");
    item.toneMapped = true;
    item.needsUpdate = true;
  });
}

function applyWorldBoneRotationOffset(bone, axis, angle) {
  if (!bone?.parent) return;

  bone.parent.updateMatrixWorld(true);
  bone.updateMatrixWorld(true);

  const parentWorldQuaternion = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  const boneWorldQuaternion = bone.getWorldQuaternion(new THREE.Quaternion());
  const worldRotationOffset = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(...axis),
    angle,
  );
  const nextWorldQuaternion = worldRotationOffset.multiply(boneWorldQuaternion);

  bone.quaternion.copy(parentWorldQuaternion.invert().multiply(nextWorldQuaternion));
  bone.updateMatrixWorld(true);
}

function RiggedAvatarScene({ config, lipSyncFrameRef, sourceScene }) {
  const scene = useMemo(() => SkeletonUtils.clone(sourceScene), [sourceScene]);
  const morphMeshes = useRef([]);
  const headBone = useRef(null);
  const baseHeadRotation = useRef(null);
  const initialHeadRotation = useRef(null);
  const speechActivity = useRef(0);
  const consonantActivity = useRef(0);
  const consonantPulse = useRef(0);
  const previousConsonant = useRef(0);

  useLayoutEffect(() => {
    const discoveredMorphMeshes = [];
    const discoveredTargets = new Set();
    let discoveredHeadBone = null;
    const posedBones = [];

    scene.traverse((object) => {
      if ((object.isMesh || object.isSkinnedMesh) && config.prepareMaterials) {
        prepareAvatarMaterial(object.material);
      }

      if ((object.isMesh || object.isSkinnedMesh) && object.morphTargetDictionary) {
        const targets = FACIAL_TARGETS.reduce((found, targetName) => {
          const index = findMorphIndex(object.morphTargetDictionary, targetName);
          if (index !== undefined) {
            found[targetName] = index;
            discoveredTargets.add(targetName);
          }
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

    const missingTargets = REQUIRED_FACIAL_TARGETS.filter(
      (targetName) => !discoveredTargets.has(targetName),
    );
    if (missingTargets.length > 0) {
      console.warn(
        `[Avatar] ${config.modelPath} is missing facial morph targets; unavailable lip-sync/facial channels will be skipped: ${missingTargets.join(", ")}`,
      );
    }

    config.boneWorldRotationOffsets?.forEach(({ name, axis, angle }) => {
      const bone = scene.getObjectByName(name);
      if (!bone) return;
      posedBones.push({ bone, initialQuaternion: bone.quaternion.clone() });
      applyWorldBoneRotationOffset(bone, axis, angle);
    });

    morphMeshes.current = discoveredMorphMeshes;
    headBone.current = discoveredHeadBone;
    baseHeadRotation.current = discoveredHeadBone?.rotation.clone() ?? null;
    initialHeadRotation.current = discoveredHeadBone?.rotation.clone() ?? null;

    return () => {
      morphMeshes.current.forEach(({ mesh }) => resetMorphs(mesh));
      posedBones.forEach(({ bone, initialQuaternion }) => {
        bone.quaternion.copy(initialQuaternion);
      });
      if (headBone.current && initialHeadRotation.current) {
        headBone.current.rotation.copy(initialHeadRotation.current);
      }
      morphMeshes.current = [];
      headBone.current = null;
      baseHeadRotation.current = null;
      initialHeadRotation.current = null;
    };
  }, [config.boneWorldRotationOffsets, config.modelPath, config.prepareMaterials, scene]);

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

    if (config.lipSyncAvailable) {
      Object.entries(lipSyncFrame?.visemes ?? {}).forEach(([targetName, value]) => {
        mouthInfluences[targetName] = value;
      });
      mouthInfluences.jawOpen = lipSyncFrame?.jawOpen ?? 0;
    }

    morphMeshes.current.forEach(({ mesh, targets }) => {
      Object.entries(mouthInfluences).forEach(([targetName, value]) => {
        setMorphDamped(mesh, targets[targetName], value, delta);
      });
      setMorph(mesh, targets.eyeBlinkLeft, blink);
      setMorph(mesh, targets.eyeBlinkRight, blink);
    });

    if (headBone.current && baseHeadRotation.current) {
      const headGazeOffset = config.headGazeOffset ?? { pitchUp: 0, turnRight: 0 };
      const motionScale = config.headMotion ?? 1;
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
        baseHeadRotation.current.x +
        headGazeOffset.pitchUp +
        (Math.sin(time * 0.8) * 0.012 + speechBob) * motionScale;
      headBone.current.rotation.y =
        baseHeadRotation.current.y +
        headGazeOffset.turnRight +
        (Math.sin(time * 0.55) * 0.02 + speechTurn) * motionScale;
      headBone.current.rotation.z =
        baseHeadRotation.current.z +
        (Math.sin(time * 0.7) * 0.01 + speechTurn * 0.35) * motionScale;
    }
  });

  return <primitive object={scene} position={config.position} scale={config.scale} />;
}

function GltfAvatarModel({ avatarMode, lipSyncFrameRef }) {
  const config = AVATAR_CONFIGS[avatarMode] ?? AVATAR_CONFIGS.male;
  const { scene } = useGLTF(config.modelPath);

  return (
    <RiggedAvatarScene config={config} lipSyncFrameRef={lipSyncFrameRef} sourceScene={scene} />
  );
}

function FbxAvatarModel({ avatarMode, lipSyncFrameRef }) {
  const config = AVATAR_CONFIGS[avatarMode] ?? AVATAR_CONFIGS.female;
  const scene = useLoader(FBXLoader, config.modelPath);

  return (
    <RiggedAvatarScene config={config} lipSyncFrameRef={lipSyncFrameRef} sourceScene={scene} />
  );
}

function PulseShell({ color, emissive, opacity, radius, rotationOffset, speed, energyRef }) {
  const mesh = useRef(null);
  const material = useRef(null);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const energy = energyRef.current;
    if (mesh.current) {
      const pulse = radius + energy * 0.14 + Math.sin(time * speed + rotationOffset) * 0.018;
      mesh.current.scale.set(pulse * 1.05, pulse * 0.92, pulse);
      mesh.current.rotation.x = Math.sin(time * speed * 0.28 + rotationOffset) * 0.22;
      mesh.current.rotation.y = time * speed * 0.16 + rotationOffset;
      mesh.current.rotation.z = Math.cos(time * speed * 0.22 + rotationOffset) * 0.18;
    }
    if (material.current) {
      material.opacity = opacity + energy * 0.14;
      material.emissiveIntensity = 0.5 + energy * 1.1;
    }
  });

  return (
    <mesh ref={mesh}>
      <sphereGeometry args={[0.55, 48, 48]} />
      <meshStandardMaterial
        ref={material}
        blending={THREE.AdditiveBlending}
        color={color}
        depthWrite={false}
        emissive={emissive}
        emissiveIntensity={0.65}
        opacity={opacity}
        roughness={0.1}
        transparent
      />
    </mesh>
  );
}

function AudioPulseVisual({ lipSyncFrameRef }) {
  const group = useRef(null);
  const coreMaterial = useRef(null);
  const energy = useRef(0);

  useFrame(({ clock }, delta) => {
    const time = clock.getElapsedTime();
    const targetEnergy = THREE.MathUtils.clamp(
      lipSyncFrameRef?.current?.speechEnergy ?? 0,
      0,
      1,
    );

    energy.current = THREE.MathUtils.damp(energy.current, targetEnergy, 10, delta);

    if (group.current) {
      const pulse = 0.88 + energy.current * 0.18 + Math.sin(time * 2.8) * 0.012;
      group.current.scale.setScalar(pulse);
      group.current.rotation.y = time * 0.12;
    }

    if (coreMaterial.current) {
      coreMaterial.current.emissiveIntensity = 0.9 + energy.current * 1.9;
      coreMaterial.current.opacity = 0.54 + energy.current * 0.2;
    }
  });

  return (
    <group ref={group} position={[0, 0, 0]}>
      <PulseShell
        color="#65D8FF"
        emissive="#54C7FF"
        energyRef={energy}
        opacity={0.18}
        radius={1.02}
        rotationOffset={0.2}
        speed={1.5}
      />
      <PulseShell
        color="#B87CFF"
        emissive="#9A6DFF"
        energyRef={energy}
        opacity={0.16}
        radius={0.9}
        rotationOffset={1.7}
        speed={1.9}
      />
      <PulseShell
        color="#FF78A9"
        emissive="#FF6B9E"
        energyRef={energy}
        opacity={0.14}
        radius={0.78}
        rotationOffset={2.5}
        speed={1.7}
      />
      <mesh>
        <sphereGeometry args={[0.36, 48, 48]} />
        <meshStandardMaterial
          ref={coreMaterial}
          color="#F8FBFF"
          emissive="#B9EFFF"
          emissiveIntensity={1}
          opacity={0.64}
          roughness={0.12}
          transparent
        />
      </mesh>
    </group>
  );
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

function AvatarLights({ avatarMode }) {
  if (avatarMode === "female") {
    return (
      <>
        <ambientLight intensity={0.2} />
        <hemisphereLight args={["#FFF4E8", "#2F3840", 0.22]} />
        <spotLight
          angle={0.38}
          castShadow
          color="#FFF3E2"
          intensity={4.2}
          penumbra={0.58}
          position={[0.85, 1.15, 2.55]}
        />
        <directionalLight color="#FFE5CC" position={[1.8, 1.4, 2.2]} intensity={1.25} />
        <directionalLight color="#C9D8FF" position={[-2.3, 1.2, 1.4]} intensity={0.32} />
      </>
    );
  }

  if (avatarMode === "visualizer") {
    return (
      <>
        <ambientLight intensity={0.55} />
        <pointLight color="#65D8FF" intensity={2.3} position={[1.8, 1.6, 1.8]} />
        <pointLight color="#FF78A9" intensity={1.5} position={[-1.8, -0.8, 1.2]} />
      </>
    );
  }

  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight position={[3, 4, 5]} intensity={2.1} />
      <directionalLight position={[-4, 2, -3]} intensity={0.7} />
    </>
  );
}

export default function AvatarViewer({ avatarMode = "male", lipSyncFrameRef }) {
  const isVisualizer = avatarMode === "visualizer";
  const camera = isVisualizer
    ? VISUALIZER_CAMERA
    : (AVATAR_CONFIGS[avatarMode] ?? AVATAR_CONFIGS.male).camera;

  return (
    <AvatarErrorBoundary key={avatarMode}>
      <Canvas
        key={avatarMode}
        camera={camera}
        gl={{ antialias: true, alpha: true }}
        shadows
      >
        <AvatarLights avatarMode={avatarMode} />
        <Suspense
          fallback={
            <Html center>
              <Loading />
            </Html>
          }
        >
          {isVisualizer ? (
            <AudioPulseVisual lipSyncFrameRef={lipSyncFrameRef} />
          ) : AVATAR_CONFIGS[avatarMode]?.loader === "fbx" ? (
            <FbxAvatarModel avatarMode={avatarMode} lipSyncFrameRef={lipSyncFrameRef} />
          ) : (
            <GltfAvatarModel avatarMode={avatarMode} lipSyncFrameRef={lipSyncFrameRef} />
          )}
        </Suspense>
      </Canvas>
    </AvatarErrorBoundary>
  );
}

useGLTF.preload(AVATAR_CONFIGS.male.modelPath);
