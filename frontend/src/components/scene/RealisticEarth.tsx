import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  EARTH_POSITION,
  EARTH_RADIUS,
  SUN_SKY_POSITION
} from '../../utils/celestialConstants';
import { createProceduralEarthFallback } from '../../utils/lunarTextures';

// Vector from Earth towards the visible Sun disc in space
const getEarthToSunDirection = () => {
  const earthPos = new THREE.Vector3(...EARTH_POSITION);
  const sunPos = new THREE.Vector3(...SUN_SKY_POSITION);
  return sunPos.sub(earthPos).normalize();
};

// High-fidelity GLSL Shader for Photorealistic Earth
const RealisticEarthShader = {
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vWorldNormal;
    varying vec3 vWorldPosition;

    void main() {
      vUv = uv;
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      vWorldNormal = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: `
    uniform sampler2D uDayMap;
    uniform sampler2D uNightMap;
    uniform sampler2D uSpecularMap;
    uniform sampler2D uCloudsMap;
    uniform vec3 uSunDirection;
    uniform float uCloudOffset;

    varying vec2 vUv;
    varying vec3 vWorldNormal;
    varying vec3 vWorldPosition;

    void main() {
      vec3 N = normalize(vWorldNormal);
      vec3 V = normalize(cameraPosition - vWorldPosition);

      // Raw NASA texture samples
      vec3 rawDay = texture2D(uDayMap, vUv).rgb;
      float specMask = texture2D(uSpecularMap, vUv).r;

      // 1. Vibrant Natural Planetary Surface Colors
      // Oceans: rich deep blue and shallow coastal turquoise
      float isWater = smoothstep(0.08, 0.28, specMask);
      vec3 deepOcean = vec3(0.03, 0.18, 0.48);
      vec3 shelfOcean = vec3(0.08, 0.46, 0.76);
      vec3 vibrantOcean = mix(deepOcean, shelfOcean, rawDay.b * 1.6) + rawDay * 0.45;

      // Continents: rich natural vegetation greens and warm desert ochre
      vec3 vibrantLand = rawDay * vec3(1.4, 1.45, 1.15) + vec3(0.04, 0.06, 0.02);

      // Polar ice caps: pure brilliant white
      float isIce = smoothstep(0.55, 0.85, (rawDay.r + rawDay.g + rawDay.b) / 3.0) * (1.0 - isWater);
      vec3 planetSurface = mix(vibrantLand, vibrantOcean, isWater);
      planetSurface = mix(planetSurface, vec3(0.97, 0.98, 1.0), isIce * 0.9);

      // 2. Swirling Weather Clouds
      vec2 cloudUv1 = vec2(fract(vUv.x + uCloudOffset), vUv.y);
      vec2 cloudUv2 = vec2(fract(vUv.x * 1.4 + uCloudOffset * 1.35), vUv.y * 1.4);
      float c1 = texture2D(uCloudsMap, cloudUv1).r;
      float c2 = texture2D(uCloudsMap, cloudUv2).r * 0.35;
      float clouds = clamp(c1 + c2 * (1.0 - c1), 0.0, 1.0);

      // Cloud shadow cast onto ground
      vec2 shadowUv = vec2(fract(vUv.x + uCloudOffset - 0.005), vUv.y - 0.003);
      float cloudShadow = texture2D(uCloudsMap, shadowUv).r * 0.35;
      planetSurface *= (1.0 - cloudShadow * (1.0 - isWater));

      // Composite sunlit surface with brilliant white clouds
      vec3 litEarth = mix(planetSurface, vec3(1.0, 1.0, 1.0), clouds * 0.96);

      // 3. Direct Solar Illumination
      float NdotL = dot(N, uSunDirection);
      float dayFactor = smoothstep(-0.04, 0.12, NdotL);
      float nightFactor = 1.0 - dayFactor;

      // Daylight diffuse factor
      float sunDiffuse = clamp(NdotL * 1.15 + 0.05, 0.0, 1.0);
      vec3 dayColor = litEarth * (sunDiffuse * 1.45 + 0.05);

      // Ocean specular glint (Sun reflection on water)
      vec3 H = normalize(uSunDirection + V);
      float NdotH = max(0.0, dot(N, H));
      float oceanSpecular = pow(NdotH, 50.0) * isWater * (1.0 - clouds) * 2.8;
      dayColor += vec3(1.0, 0.98, 0.9) * oceanSpecular * max(0.0, NdotL);

      // 4. Night Side: NASA Black Marble City Lights
      vec3 nightSample = texture2D(uNightMap, vUv).rgb;
      // Warm golden metropolitan cluster boost
      vec3 cityLights = pow(nightSample, vec3(1.08)) * vec3(2.4, 2.0, 1.2);
      cityLights *= (1.0 - clouds * 0.75); // Clouds obscure city lights
      vec3 nightColor = cityLights * nightFactor * 0.95;

      // 5. Atmospheric Twilight Sunset/Sunrise Rim along Terminator
      float terminatorGlow = smoothstep(0.12, 0.0, abs(NdotL)) * 0.35;
      vec3 twilightColor = vec3(0.95, 0.45, 0.12) * terminatorGlow;

      // 6. Rayleigh Atmospheric Scattering Limb (Fresnel fringe)
      float fresnel = pow(1.0 - max(0.0, dot(N, V)), 3.0);
      float limbSunFactor = smoothstep(-0.15, 0.45, NdotL);
      vec3 atmosLimb = vec3(0.2, 0.65, 1.0) * fresnel * (limbSunFactor * 1.5 + 0.12);

      // Final composite color
      vec3 finalColor = dayColor * dayFactor + twilightColor + nightColor + atmosLimb;

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
};

export const RealisticEarth: React.FC = () => {
  const earthGroupRef = useRef<THREE.Group>(null);
  const shaderMatRef = useRef<THREE.ShaderMaterial>(null);
  const [texturesLoaded, setTexturesLoaded] = useState(false);

  // Direction from Earth to Sun
  const earthToSun = useMemo(() => getEarthToSunDirection(), []);

  // Load NASA Visible Earth textures with robust procedural fallback
  const textures = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const fallback = createProceduralEarthFallback();

    const loadWithFallback = (url: string, fb: THREE.Texture, isColor = false) => {
      const tex = loader.load(
        url,
        (loadedTex) => {
          if (isColor) {
            loadedTex.colorSpace = THREE.SRGBColorSpace;
          }
          setTexturesLoaded(true);
        },
        undefined,
        () => {
          console.warn(`[HabitatOS] Failed loading ${url}, using procedural fallback.`);
        }
      );
      if (isColor) {
        tex.colorSpace = THREE.SRGBColorSpace;
      }
      return tex;
    };

    const day = loadWithFallback('/textures/planets/earth_atmos_2048.jpg', fallback.dayMap, true);
    const night = loadWithFallback('/textures/planets/earth_lights_2048.png', fallback.nightMap, true);
    const spec = loadWithFallback('/textures/planets/earth_specular_2048.jpg', fallback.specularMap);
    const clouds = loadWithFallback('/textures/planets/earth_clouds_1024.png', fallback.cloudsMap);

    return { day, night, spec, clouds, fallback };
  }, []);

  const uniforms = useMemo(
    () => ({
      uDayMap: { value: textures.day || textures.fallback.dayMap },
      uNightMap: { value: textures.night || textures.fallback.nightMap },
      uSpecularMap: { value: textures.spec || textures.fallback.specularMap },
      uCloudsMap: { value: textures.clouds || textures.fallback.cloudsMap },
      uSunDirection: { value: earthToSun },
      uCloudOffset: { value: 0.0 }
    }),
    [textures, earthToSun]
  );

  useEffect(() => {
    if (shaderMatRef.current) {
      shaderMatRef.current.uniforms.uDayMap.value = textures.day || textures.fallback.dayMap;
      shaderMatRef.current.uniforms.uNightMap.value = textures.night || textures.fallback.nightMap;
      shaderMatRef.current.uniforms.uSpecularMap.value = textures.spec || textures.fallback.specularMap;
      shaderMatRef.current.uniforms.uCloudsMap.value = textures.clouds || textures.fallback.cloudsMap;
      shaderMatRef.current.uniforms.uSunDirection.value = earthToSun;
      shaderMatRef.current.needsUpdate = true;
    }
  }, [textures, texturesLoaded, earthToSun]);

  // Animate planetary rotation (23.44° axial tilt) and independent cloud circulation
  useFrame((_, delta) => {
    if (earthGroupRef.current) {
      earthGroupRef.current.rotation.y += delta * 0.012;
    }
    if (shaderMatRef.current) {
      shaderMatRef.current.uniforms.uCloudOffset.value += delta * 0.003;
    }
  });

  return (
    <group position={EARTH_POSITION}>
      {/* Astronomical Axial Tilt: 23.44° (0.409 rad around Z) */}
      <group rotation={[0, 0, 0.409]}>
        {/* 1. Photorealistic Earth Sphere with Day/Night Terminator */}
        <group ref={earthGroupRef}>
          <mesh>
            <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
            <shaderMaterial
              ref={shaderMatRef}
              vertexShader={RealisticEarthShader.vertexShader}
              fragmentShader={RealisticEarthShader.fragmentShader}
              uniforms={uniforms}
            />
          </mesh>
        </group>

        {/* 2. Delicate Outer Rayleigh Atmospheric Halo */}
        <mesh>
          <sphereGeometry args={[EARTH_RADIUS * 1.025, 48, 48]} />
          <meshBasicMaterial
            color="#38bdf8"
            transparent
            opacity={0.16}
            side={THREE.BackSide}
          />
        </mesh>
      </group>
    </group>
  );
};
