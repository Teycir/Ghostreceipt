'use client';

import { useEffect } from 'react';

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform float u_speed;
  uniform float u_scale;
  uniform float u_complexity;

  uniform float u_expansion;
  uniform float u_twist;
  uniform float u_grain;
  uniform float u_smoothing;
  uniform int u_octaves;

  uniform vec3 u_color1;
  uniform vec3 u_color2;
  uniform vec3 u_color3;
  uniform vec3 u_color4;
  uniform vec3 u_color5;

  varying vec2 vUv;

  mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
  }

  vec3 srgb_to_oklab(vec3 c) {
    float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
    float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
    float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
    float l_ = pow(max(0.0, l), 1.0 / 3.0);
    float m_ = pow(max(0.0, m), 1.0 / 3.0);
    float s_ = pow(max(0.0, s), 1.0 / 3.0);
    return vec3(
      0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
      1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
      0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    );
  }

  vec3 oklab_to_srgb(vec3 c) {
    float l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
    float m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
    float s_ = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
    float l = l_ * l_ * l_;
    float m = m_ * m_ * m_;
    float s = s_ * s_ * s_;
    return vec3(
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    );
  }

  vec3 oklab_mix(vec3 col1, vec3 col2, float t) {
    return oklab_to_srgb(mix(srgb_to_oklab(col1), srgb_to_oklab(col2), t));
  }

  vec2 random2(vec2 st) {
    st = vec2(dot(st, vec2(127.1, 311.7)), dot(st, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(st) * 43758.5453123);
  }

  float perlinNoise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    return mix(
      mix(dot(random2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
          dot(random2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
      mix(dot(random2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
          dot(random2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm_tex(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 r = rot(0.5);
    for (int i = 0; i < 5; ++i) {
      if (i >= u_octaves) break;
      float octave_weight = mix(1.0, pow(0.4, float(i)), u_smoothing);
      v += a * perlinNoise(p) * octave_weight;
      p = r * p * 2.0;
      a *= 0.5;
    }
    return v;
  }

  vec3 getPalette(float t) {
    t = fract(t);
    float local_t = smoothstep(0.0, 1.0, fract(t * 4.0));
    if (t < 0.25) return oklab_mix(u_color1, u_color2, local_t);
    if (t < 0.50) return oklab_mix(u_color2, u_color3, local_t);
    if (t < 0.75) return oklab_mix(u_color3, u_color4, local_t);
    return oklab_mix(u_color4, u_color1, local_t);
  }

  vec3 applyGlassLighting(vec3 baseColor, vec2 normal, vec2 lightDir, float shininess, float intensity) {
    float light = dot(normal, normalize(lightDir));
    float diffuse = light * mix(0.35, 0.15, u_smoothing) + mix(0.65, 0.85, u_smoothing);
    vec3 highlightTint = mix(u_color5, baseColor, 0.45);
    vec3 specular = highlightTint * pow(max(0.0, light), shininess) * intensity;
    return clamp(baseColor * diffuse + specular, 0.0, 1.0);
  }

  float map(vec2 p, float t) {
    vec2 q = vec2(
      fbm_tex(p * u_complexity + t * 0.2),
      fbm_tex(p * u_complexity + vec2(5.2, 1.3) - t * 0.2)
    );
    q *= rot(u_twist);
    vec2 r = vec2(
      fbm_tex(p + q * 2.0 + t * 0.1),
      fbm_tex(p + q * 2.0 - t * 0.15)
    );
    float f = fbm_tex(p + r * u_expansion * 3.0);
    float folds = 0.5 - 0.5 * cos(f * mix(3.0, 8.0, u_smoothing) + t * 0.5);
    return mix(f, folds, u_smoothing);
  }

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    p.x *= u_resolution.x / u_resolution.y;

    float t = u_time * u_speed;
    vec2 st = p * u_scale;

    float val = map(st, t);

    vec2 eps = vec2(mix(0.01, 0.15, u_smoothing), 0.0);
    float dx = map(st + eps.xy, t) - map(st - eps.xy, t);
    float dy = map(st + eps.yx, t) - map(st - eps.yx, t);

    vec2 normal = vec2(dx, dy);
    if (length(normal) > 0.0001) normal = normalize(normal);
    else normal = vec2(0.0, 1.0);

    vec3 baseColor = getPalette(val * 1.5 - t * 0.1);
    vec3 color = applyGlassLighting(baseColor, normal, normalize(vec2(1.0, 1.0)), 8.0, 0.6);

    vec2 seed = gl_FragCoord.xy + fract(u_time) * 1000.0;
    vec3 p3 = fract(vec3(seed.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    float dither = fract((p3.x + p3.y) * p3.z);
    color += (dither - 0.5) * u_grain;

    float dist = length(p);
    float mask = smoothstep(1.8, 0.2, dist);
    color *= mask;

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`;

export function EyeCandy(): null {
  useEffect(() => {
    let disposed = false;
    let animId = 0;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduceMotion.matches) {
      return;
    }

    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:0;';
    document.body.prepend(container);

    const setup = async (): Promise<void> => {
      const THREE = await import('three');
      if (disposed) return;

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
      camera.position.z = 1;

      const isMobile = window.innerWidth < 768;
      const params = {
        resolution: isMobile ? 0.45 : 0.6,
        octaves: isMobile ? 3 : 4,
        speed: 0.18,
        scale: 0.05,
        complexity: 5.0,
        expansion: 1.6,
        twist: 0.0,
        grain: 0.018,
        smoothing: 0.6,
        color1: '#339cff',
        color2: '#384fff',
        color3: '#261985',
        color4: '#3623c7',
        color5: '#cce9ff',
      };

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
      renderer.setClearAlpha(0);
      container.appendChild(renderer.domElement);

      const uniforms = {
        u_time: { value: 0.0 },
        u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        u_speed: { value: params.speed },
        u_scale: { value: params.scale },
        u_complexity: { value: params.complexity },
        u_expansion: { value: params.expansion },
        u_twist: { value: params.twist },
        u_grain: { value: params.grain },
        u_smoothing: { value: params.smoothing },
        u_octaves: { value: params.octaves },
        u_color1: { value: new THREE.Color(params.color1) },
        u_color2: { value: new THREE.Color(params.color2) },
        u_color3: { value: new THREE.Color(params.color3) },
        u_color4: { value: new THREE.Color(params.color4) },
        u_color5: { value: new THREE.Color(params.color5) },
      };

      const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
        depthWrite: false,
        depthTest: false,
      });

      const geometry = new THREE.PlaneGeometry(2, 2);
      scene.add(new THREE.Mesh(geometry, material));

      const resize = () => {
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2) * params.resolution;
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight, false);
        uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);
      };

      const onResize = () => {
        uniforms.u_octaves.value = window.innerWidth < 768 ? 3 : params.octaves;
        resize();
      };

      resize();
      window.addEventListener('resize', onResize);

      const clock = new THREE.Clock();
      const animate = () => {
        if (disposed) return;
        uniforms.u_time.value = clock.getElapsedTime();
        renderer.render(scene, camera);
        animId = window.requestAnimationFrame(animate);
      };
      animate();

      const previousCleanup = cleanup;
      cleanup = () => {
        previousCleanup();
        window.cancelAnimationFrame(animId);
        window.removeEventListener('resize', onResize);
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        container.remove();
      };
    };

    let cleanup = () => {
      container.remove();
    };

    void setup();

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return null;
}
