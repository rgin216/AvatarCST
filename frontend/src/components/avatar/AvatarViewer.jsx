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
    bodyBob: { idle: 0.012, speech: 0.026, speed: 1.7 },
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
  const root = useRef(null);
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

    if (root.current && config.bodyBob) {
      const bob = Math.sin(time * config.bodyBob.speed) * config.bodyBob.idle;
      const speechBob = Math.sin(time * config.bodyBob.speed * 2.2 + 0.4)
        * config.bodyBob.speech
        * speechActivity.current;
      root.current.position.y = config.position[1] + bob + speechBob;
    }

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

  return (
    <group ref={root} position={config.position} scale={config.scale}>
      <primitive object={scene} />
    </group>
  );
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

const ORB_VERTEX_SHADER = `
  uniform float uTime;
  uniform float uEnergy;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying float vRipple;

  void main() {
    vNormal = normalize(normalMatrix * normal);

    float slowWave = sin(position.y * 6.8 + uTime * 1.25);
    float crossWave = sin((position.x - position.z) * 8.0 - uTime * 1.7);
    float fineWave = sin((position.x + position.y + position.z) * 13.0 + uTime * 2.4);
    float ripple = slowWave * 0.045 + crossWave * 0.035 + fineWave * 0.018;
    float speechPush = uEnergy * (0.08 + 0.04 * sin(position.y * 11.0 - uTime * 3.8));

    vec3 displaced = position + normal * (ripple + speechPush);
    vRipple = ripple + speechPush;
    vWorldPosition = (modelMatrix * vec4(displaced, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const ORB_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uEnergy;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying float vRipple;

  void main() {
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float rim = pow(1.0 - max(dot(normalize(vNormal), viewDirection), 0.0), 2.8);
    float flow = sin(vWorldPosition.y * 3.4 + uTime * 0.9) * 0.5 + 0.5;
    float ridge = smoothstep(0.015, 0.12, abs(vRipple));

    vec3 aqua = vec3(0.19, 0.84, 0.95);
    vec3 petal = vec3(1.0, 0.42, 0.58);
    vec3 amber = vec3(1.0, 0.74, 0.36);
    vec3 violet = vec3(0.42, 0.38, 0.98);

    vec3 base = mix(aqua, petal, flow * 0.55);
    base = mix(base, amber, ridge * 0.24);
    vec3 glow = mix(violet, aqua, flow) * rim * (0.75 + uEnergy * 0.8);
    vec3 color = base * (0.45 + uEnergy * 0.18) + glow + ridge * amber * 0.22;
    float alpha = 0.54 + rim * 0.28 + uEnergy * 0.12;

    gl_FragColor = vec4(color, alpha);
  }
`;

function seededUnit(index, salt = 0) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function VoiceCore({ energyRef }) {
  const mesh = useRef(null);
  const material = useRef(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uEnergy: { value: 0 },
    }),
    [],
  );

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const energy = energyRef.current;

    if (material.current) {
      material.current.uniforms.uTime.value = time;
      material.current.uniforms.uEnergy.value = energy;
    }

    if (mesh.current) {
      const breath = 0.94 + Math.sin(time * 1.05) * 0.018 + energy * 0.16;
      mesh.current.scale.set(breath * 1.05, breath * 0.96, breath);
      mesh.current.rotation.y = time * 0.2;
      mesh.current.rotation.x = Math.sin(time * 0.34) * 0.16;
    }
  });

  return (
    <mesh ref={mesh}>
      <icosahedronGeometry args={[0.48, 8]} />
      <shaderMaterial
        ref={material}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        fragmentShader={ORB_FRAGMENT_SHADER}
        transparent
        uniforms={uniforms}
        vertexShader={ORB_VERTEX_SHADER}
      />
    </mesh>
  );
}

function AtmosphereShell({ energyRef }) {
  const mesh = useRef(null);
  const material = useRef(null);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const energy = energyRef.current;

    if (mesh.current) {
      const pulse = 1.02 + energy * 0.16 + Math.sin(time * 1.8) * 0.018;
      mesh.current.scale.set(pulse * 1.12, pulse * 0.88, pulse);
      mesh.current.rotation.x = Math.sin(time * 0.42) * 0.26;
      mesh.current.rotation.y = time * 0.08;
    }

    if (material.current) {
      material.current.opacity = 0.14 + energy * 0.16;
    }
  });

  return (
    <mesh ref={mesh}>
      <sphereGeometry args={[0.68, 64, 64]} />
      <meshBasicMaterial
        ref={material}
        blending={THREE.AdditiveBlending}
        color="#3ED9ED"
        depthWrite={false}
        opacity={0.16}
        transparent
      />
    </mesh>
  );
}

function OrbitArc({ color, energyRef, phase, radius, speed, tilt }) {
  const mesh = useRef(null);
  const material = useRef(null);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const energy = energyRef.current;

    if (mesh.current) {
      const scale = 1 + energy * 0.1 + Math.sin(time * 1.6 + phase) * 0.012;
      mesh.current.scale.setScalar(scale);
      mesh.current.rotation.x = tilt[0] + Math.sin(time * 0.4 + phase) * 0.05;
      mesh.current.rotation.y = tilt[1] + time * speed;
      mesh.current.rotation.z = tilt[2] + Math.cos(time * 0.33 + phase) * 0.06;
    }

    if (material.current) {
      material.current.opacity = 0.34 + energy * 0.28;
    }
  });

  return (
    <mesh ref={mesh}>
      <torusGeometry args={[radius, 0.008, 8, 128, Math.PI * 1.48]} />
      <meshBasicMaterial
        ref={material}
        blending={THREE.AdditiveBlending}
        color={color}
        depthWrite={false}
        opacity={0.38}
        transparent
      />
    </mesh>
  );
}

function SignalRibbon({ color, energyRef, phase, radius, speed, tilt }) {
  const line = useRef(null);
  const material = useRef(null);
  const ribbonAttribute = useMemo(
    () => new THREE.BufferAttribute(new Float32Array(193 * 3), 3),
    [],
  );

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const energy = energyRef.current;
    const position = line.current?.geometry.attributes.position;
    if (!position) return;

    const positions = position.array;
    for (let index = 0; index <= 192; index += 1) {
      const angle = (index / 192) * Math.PI * 2;
      const ripple =
        Math.sin(angle * 5 + time * speed + phase) * (0.035 + energy * 0.13)
        + Math.sin(angle * 9 - time * 0.78 + phase) * (0.014 + energy * 0.04);
      const currentRadius = radius + ripple;
      const offset = index * 3;

      positions[offset] = Math.cos(angle) * currentRadius;
      positions[offset + 1] = Math.sin(angle * 3 + time * 1.1 + phase) * (0.055 + energy * 0.11);
      positions[offset + 2] = Math.sin(angle) * currentRadius;
    }

    position.needsUpdate = true;
    line.current.rotation.x = tilt[0];
    line.current.rotation.y = tilt[1] + time * 0.045;
    line.current.rotation.z = tilt[2];

    if (material.current) {
      material.current.opacity = 0.32 + energy * 0.38;
    }
  });

  return (
    <line ref={line}>
      <bufferGeometry>
        <primitive attach="attributes-position" object={ribbonAttribute} />
      </bufferGeometry>
      <lineBasicMaterial
        ref={material}
        blending={THREE.AdditiveBlending}
        color={color}
        depthWrite={false}
        opacity={0.36}
        transparent
      />
    </line>
  );
}

function ParticleHalo({ energyRef }) {
  const pointsRef = useRef(null);
  const material = useRef(null);
  const particles = useMemo(() => {
    const count = 140;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const seeds = [];
    const accentColors = [
      new THREE.Color("#2EE8F2"),
      new THREE.Color("#FF6E8F"),
      new THREE.Color("#FFD36A"),
      new THREE.Color("#7F7CFF"),
    ];

    for (let index = 0; index < count; index += 1) {
      const color = accentColors[index % accentColors.length];
      const offset = index * 3;
      seeds.push({
        angle: seededUnit(index, 1) * Math.PI * 2,
        band: seededUnit(index, 2) * Math.PI * 2,
        drift: 0.7 + seededUnit(index, 3) * 0.7,
        radius: 0.78 + seededUnit(index, 4) * 0.44,
      });
      colors[offset] = color.r;
      colors[offset + 1] = color.g;
      colors[offset + 2] = color.b;
    }

    return { colors, positions, seeds };
  }, []);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const energy = energyRef.current;
    const position = pointsRef.current?.geometry.attributes.position;
    if (!position) return;

    particles.seeds.forEach((seed, index) => {
      const angle = seed.angle + time * 0.13 * seed.drift + energy * 0.35;
      const radius = seed.radius + Math.sin(time * seed.drift + seed.band) * 0.045 + energy * 0.16;
      const offset = index * 3;

      particles.positions[offset] = Math.cos(angle) * radius;
      particles.positions[offset + 1] =
        Math.sin(seed.band + time * 0.8) * 0.32 + Math.sin(angle * 2) * 0.08;
      particles.positions[offset + 2] = Math.sin(angle) * radius * 0.72;
    });

    position.needsUpdate = true;
    pointsRef.current.rotation.y = time * 0.08;

    if (material.current) {
      material.current.opacity = 0.48 + energy * 0.34;
      material.current.size = 0.025 + energy * 0.018;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[particles.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[particles.colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={material}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        opacity={0.58}
        size={0.028}
        sizeAttenuation
        transparent
        vertexColors
      />
    </points>
  );
}

function AudioPulseVisual({ lipSyncFrameRef }) {
  const group = useRef(null);
  const energy = useRef(0);

  useFrame(({ clock }, delta) => {
    const time = clock.getElapsedTime();
    const targetEnergy = THREE.MathUtils.clamp(
      lipSyncFrameRef?.current?.speechEnergy ?? 0,
      0,
      1,
    );

    energy.current = THREE.MathUtils.damp(energy.current, targetEnergy, 11, delta);

    if (group.current) {
      const pulse = 0.92 + energy.current * 0.14 + Math.sin(time * 2.1) * 0.01;
      group.current.scale.setScalar(pulse);
      group.current.rotation.y = time * 0.08;
    }
  });

  return (
    <group ref={group} position={[0, 0, 0]}>
      <AtmosphereShell energyRef={energy} />
      <VoiceCore energyRef={energy} />
      <SignalRibbon
        color="#2EE8F2"
        energyRef={energy}
        phase={0.3}
        radius={0.82}
        speed={1.8}
        tilt={[0.85, 0.1, 0.28]}
      />
      <SignalRibbon
        color="#FFD36A"
        energyRef={energy}
        phase={1.9}
        radius={0.94}
        speed={1.35}
        tilt={[1.24, 0.35, -0.48]}
      />
      <SignalRibbon
        color="#FF6E8F"
        energyRef={energy}
        phase={3.1}
        radius={1.04}
        speed={1.55}
        tilt={[0.48, -0.22, 0.92]}
      />
      <OrbitArc
        color="#FDF8E7"
        energyRef={energy}
        phase={0.6}
        radius={0.72}
        speed={0.22}
        tilt={[1.1, 0.2, -0.34]}
      />
      <OrbitArc
        color="#7F7CFF"
        energyRef={energy}
        phase={2.2}
        radius={0.98}
        speed={-0.16}
        tilt={[0.34, 0.88, 0.56]}
      />
      <ParticleHalo energyRef={energy} />
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
