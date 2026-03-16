// ─── GEEZ MML Studio — Three.js Renderer Engine ──────────────────────────
// Renders the full MML Alpha tag set in a browser Three.js scene.
// Supported tags: m-group, m-cube, m-sphere, m-cylinder, m-plane, m-model,
//   m-character, m-light, m-image, m-video, m-label, m-prompt, m-attr-anim
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import type { MMLNode, ParsedMML } from "@/types/mml";
import { parseMML } from "@/lib/mml/parser";

// ─── Renderer Options (editor-only, do not affect MML export) ─────────────
export interface RendererOptions {
  hdriEnabled: boolean;
  shadowsEnabled: boolean;
  ssaoEnabled: boolean;
  bloomEnabled: boolean;
  toneMapping: THREE.ToneMapping;
  toneMappingExposure: number;
  strictMMLMode: boolean;
  backgroundColor: string;
}

export const DEFAULT_RENDERER_OPTIONS: RendererOptions = {
  hdriEnabled: false,
  shadowsEnabled: true,
  ssaoEnabled: false,
  bloomEnabled: false,
  toneMapping: THREE.ACESFilmicToneMapping,
  toneMappingExposure: 1.6,
  strictMMLMode: true,
  backgroundColor: "#1a2035",
};

// ─── Active animation data for m-attr-anim ────────────────────────────────
interface AttrAnimation {
  target: THREE.Object3D | THREE.Material;
  attr: string;
  start: number;
  end: number;
  duration: number; // ms
  loop: boolean;
  pingPong: boolean;
  easing: string;
  startTime: number;
  forward: boolean;
}

export type SceneObjectMap = Map<string, THREE.Object3D>;

export type SelectionCallback = (objectId: string | null) => void;
export type TransformChangeCallback = (objectId: string, transform: {
  x: number; y: number; z: number;
  rx: number; ry: number; rz: number;
  sx: number; sy: number; sz: number;
}) => void;

// ─── Main Renderer ─────────────────────────────────────────────────────────
export class MMLRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private transformControls: TransformControls;
  private gltfLoader: GLTFLoader;
  private objectMap: SceneObjectMap = new Map();
  private animationFrameId: number | null = null;
  private options: RendererOptions;
  private mixers: THREE.AnimationMixer[] = [];
  private attrAnims: AttrAnimation[] = [];
  private clock: THREE.Clock;
  private raycaster: THREE.Raycaster;
  private pointer: THREE.Vector2;
  private canvas: HTMLCanvasElement;
  // Tracks id→tag from the last successful load for incremental diff
  private lastNodeTags: Map<string, string> = new Map();

  // Selection state
  private selectedObject: THREE.Object3D | null = null;
  private selectedObjectId: string | null = null;
  private selectionOutline: THREE.BoxHelper | null = null;
  private onSelectionChange: SelectionCallback | null = null;
  private onTransformChange: TransformChangeCallback | null = null;

  constructor(canvas: HTMLCanvasElement, options?: Partial<RendererOptions>) {
    this.options = { ...DEFAULT_RENDERER_OPTIONS, ...options };
    this.clock = new THREE.Clock();

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.clientWidth || 800, canvas.clientHeight || 600);
    this.renderer.shadowMap.enabled = this.options.shadowsEnabled;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = this.options.toneMapping;
    this.renderer.toneMappingExposure = this.options.toneMappingExposure;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.options.backgroundColor);
    this.scene.fog = new THREE.FogExp2(0x1a2035, 0.018);

    // ── Editor lights — always on, mark as editor-only ─────────────────────
    // Hemisphere: sky blue-white from above, warm ground bounce from below
    const hemi = new THREE.HemisphereLight(0xc8d8ff, 0x40300a, 1.2);
    hemi.name = "__editor_hemi__";
    this.scene.add(hemi);

    // Ambient fill so nothing is ever completely black
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    ambient.name = "__editor_ambient__";
    this.scene.add(ambient);

    // Key directional from upper-right-front — casts shadows
    const keyLight = new THREE.DirectionalLight(0xfff4e0, 1.4);
    keyLight.position.set(8, 14, 10);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 100;
    keyLight.shadow.camera.left = -20;
    keyLight.shadow.camera.right = 20;
    keyLight.shadow.camera.top = 20;
    keyLight.shadow.camera.bottom = -20;
    keyLight.shadow.bias = -0.0005;
    keyLight.name = "__editor_key__";
    this.scene.add(keyLight);

    // Rim/back light from behind-left for depth separation
    const rimLight = new THREE.DirectionalLight(0x8899ff, 0.5);
    rimLight.position.set(-6, 8, -10);
    rimLight.name = "__editor_rim__";
    this.scene.add(rimLight);

    // Grid — slightly visible lines on dark navy
    const grid = new THREE.GridHelper(40, 40, 0x3a4466, 0x272e44);
    grid.name = "__editor_grid__";
    this.scene.add(grid);

    this.camera = new THREE.PerspectiveCamera(55, (canvas.clientWidth || 800) / (canvas.clientHeight || 600), 0.01, 2000);
    this.camera.position.set(6, 6, 12);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    // ── Transform Controls (gizmo) ──────────────────────────────────────
    this.transformControls = new TransformControls(this.camera, canvas);
    this.transformControls.name = "__editor_gizmo__";
    this.transformControls.setSize(0.75);
    this.scene.add(this.transformControls);

    // Disable orbit while dragging gizmo
    this.transformControls.addEventListener("dragging-changed", (event) => {
      this.controls.enabled = !event.value;
    });

    // Emit transform changes when gizmo interaction ends
    this.transformControls.addEventListener("objectChange", () => {
      if (!this.selectedObject || !this.selectedObjectId) return;
      this.updateSelectionOutline();
      if (this.onTransformChange) {
        const p = this.selectedObject.position;
        const r = this.selectedObject.rotation;
        const s = this.selectedObject.scale;
        this.onTransformChange(this.selectedObjectId, {
          x: Math.round(p.x * 1000) / 1000,
          y: Math.round(p.y * 1000) / 1000,
          z: Math.round(p.z * 1000) / 1000,
          rx: Math.round(THREE.MathUtils.radToDeg(r.x) * 1000) / 1000,
          ry: Math.round(THREE.MathUtils.radToDeg(r.y) * 1000) / 1000,
          rz: Math.round(THREE.MathUtils.radToDeg(r.z) * 1000) / 1000,
          sx: Math.round(s.x * 1000) / 1000,
          sy: Math.round(s.y * 1000) / 1000,
          sz: Math.round(s.z * 1000) / 1000,
        });
      }
    });

    // ── Raycaster ────────────────────────────────────────────────────────
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.canvas = canvas;

    this.gltfLoader = new GLTFLoader();
  }

  // ─── Options ──────────────────────────────────────────────────────────
  updateOptions(options: Partial<RendererOptions>) {
    this.options = { ...this.options, ...options };
    this.renderer.shadowMap.enabled = this.options.shadowsEnabled;
    this.renderer.toneMapping = this.options.toneMapping;
    this.renderer.toneMappingExposure = this.options.toneMappingExposure;
    if (options.backgroundColor) {
      (this.scene.background as THREE.Color).set(options.backgroundColor);
    }
    const grid = this.scene.getObjectByName("__editor_grid__");
    if (grid) grid.visible = !this.options.strictMMLMode;
  }

  // ─── Load MML ──────────────────────────────────────────────────────────
  async loadMML(html: string): Promise<void> {
    let parsed: ParsedMML;
    try {
      parsed = parseMML(html);
    } catch (e) {
      console.error("[MMLRenderer] Parse error:", e);
      return;
    }

    // Build flat id→tag map and parentId map from the new parsed tree
    const newTags = new Map<string, string>();
    const flattenForDiff = (nodes: MMLNode[], _parentId: string | null) => {
      for (const node of nodes) {
        if (node.tag === "m-attr-anim") continue;
        const id = node.attributes["id"];
        if (id) newTags.set(id, node.tag);
        flattenForDiff(node.children, id ?? _parentId);
      }
    };
    flattenForDiff(parsed.nodes, null);

    // Determine if this is append-only vs structural change
    const existingIds = new Set([...this.objectMap.keys()].filter((k) => k !== "__mml_root__"));
    let appendOnly = existingIds.size > 0;
    if (appendOnly) {
      for (const id of existingIds) {
        // Removal or tag change → full rebuild
        if (!newTags.has(id) || newTags.get(id) !== this.lastNodeTags.get(id)) {
          appendOnly = false;
          break;
        }
      }
    }

    if (appendOnly) {
      // Count how many genuinely new ids exist
      const addedIds = [...newTags.keys()].filter((id) => !existingIds.has(id));

      if (addedIds.length > 0) {
        // Incremental: only build nodes whose id didn't previously exist.
        // Attribute changes to existing nodes (color, size, etc.) are NOT handled here —
        // they require a full rebuild via the code-editor path.
        const root = this.objectMap.get("__mml_root__") as THREE.Group;
        if (root) {
          const buildNewNodes = async (nodes: MMLNode[], parent: THREE.Object3D) => {
            for (const node of nodes) {
              if (node.tag === "m-attr-anim") continue;
              const id = node.attributes["id"];
              if (id && existingIds.has(id)) {
                // Existing element — recurse into children to catch any new nested nodes
                const existingObj = this.objectMap.get(id);
                if (existingObj) await buildNewNodes(node.children, existingObj);
              } else {
                // New element — build it (also builds its children via buildObject)
                await this.buildObject(node, parent);
              }
            }
          };
          await buildNewNodes(parsed.nodes, root);
          this.lastNodeTags = newTags;
          return;
        }
      }
      // No new ids (attribute-only change or transform-only patch) — fall through to full rebuild
      // Note: ThreeViewport's isTransformPatch flag skips loadMML entirely for gizmo-only changes,
      // so full rebuild here only triggers for real attribute edits from the code editor.
    }

    // Full rebuild
    this.clearMMLObjects();
    this.mixers = [];
    this.attrAnims = [];

    const root = new THREE.Group();
    root.name = "__mml_root__";
    this.scene.add(root);
    this.objectMap.set("__mml_root__", root);

    for (const node of parsed.nodes) {
      await this.buildObject(node, root);
    }
    this.lastNodeTags = newTags;
  }

  private clearMMLObjects() {
    // Detach gizmo before clearing to avoid dangling references
    this.transformControls.detach();
    this.selectedObject = null;
    this.selectedObjectId = null;
    if (this.selectionOutline) {
      this.scene.remove(this.selectionOutline);
      this.selectionOutline.dispose();
      this.selectionOutline = null;
    }

    const root = this.scene.getObjectByName("__mml_root__");
    if (root) {
      this.disposeObject(root);
      this.scene.remove(root);
    }
    this.objectMap.clear();
  }

  private disposeObject(obj: THREE.Object3D) {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        const mat = child.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else (mat as THREE.Material)?.dispose();
      }
    });
  }

  // ─── Node builder ──────────────────────────────────────────────────────
  private async buildObject(node: MMLNode, parent: THREE.Object3D): Promise<THREE.Object3D | null> {
    // m-attr-anim is handled by its parent — skip as direct element
    if (node.tag === "m-attr-anim") return null;

    let obj: THREE.Object3D | null = null;

    switch (node.tag) {
      case "m-group":     obj = new THREE.Group(); break;
      case "m-cube":      obj = this.buildCube(node); break;
      case "m-sphere":    obj = this.buildSphere(node); break;
      case "m-cylinder":  obj = this.buildCylinder(node); break;
      case "m-plane":     obj = this.buildPlane(node); break;
      case "m-model":     obj = await this.buildModel(node); break;
      case "m-character": obj = await this.buildModel(node); break; // same GLTF loader
      case "m-light":     obj = this.buildLight(node); break;
      case "m-image":     obj = await this.buildImage(node); break;
      case "m-video":     obj = this.buildVideo(node); break;
      case "m-label":     obj = this.buildLabel(node); break;
      case "m-prompt":    obj = this.buildPrompt(node); break;
    }

    if (obj) {
      this.applyTransform(obj, node);
      parent.add(obj);

      if (node.attributes["id"]) {
        this.objectMap.set(node.attributes["id"], obj);
      }

      // Process children, including m-attr-anim
      for (const child of node.children) {
        if (child.tag === "m-attr-anim") {
          this.registerAttrAnim(obj, child);
        } else {
          await this.buildObject(child, obj);
        }
      }
    }

    return obj;
  }

  // ─── Transform ─────────────────────────────────────────────────────────
  private applyTransform(obj: THREE.Object3D, node: MMLNode) {
    const a = node.attributes;
    obj.position.set(
      parseFloat(a["x"] || "0"),
      parseFloat(a["y"] || "0"),
      parseFloat(a["z"] || "0")
    );
    obj.rotation.set(
      THREE.MathUtils.degToRad(parseFloat(a["rx"] || "0")),
      THREE.MathUtils.degToRad(parseFloat(a["ry"] || "0")),
      THREE.MathUtils.degToRad(parseFloat(a["rz"] || "0"))
    );
    obj.scale.set(
      parseFloat(a["sx"] || "1"),
      parseFloat(a["sy"] || "1"),
      parseFloat(a["sz"] || "1")
    );
    obj.visible = a["visible"] !== "false";
  }

  // ─── Material builder ──────────────────────────────────────────────────
  private buildMaterial(node: MMLNode): THREE.MeshStandardMaterial {
    const a = node.attributes;
    const opacity = parseFloat(a["opacity"] || "1");
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(a["color"] || "#888888"),
      transparent: opacity < 1,
      opacity,
      metalness: parseFloat(a["metalness"] || "0"),
      roughness: parseFloat(a["roughness"] || "1"),
    });
    if (a["emissive"]) mat.emissive.set(a["emissive"]);
    if (a["emissive-intensity"]) mat.emissiveIntensity = parseFloat(a["emissive-intensity"]);
    return mat;
  }

  // ─── Primitives ────────────────────────────────────────────────────────
  private buildCube(node: MMLNode): THREE.Mesh {
    const a = node.attributes;
    const geo = new THREE.BoxGeometry(
      parseFloat(a["width"] || "1"),
      parseFloat(a["height"] || "1"),
      parseFloat(a["depth"] || "1")
    );
    const mesh = new THREE.Mesh(geo, this.buildMaterial(node));
    mesh.castShadow = a["cast-shadows"] !== "false";
    mesh.receiveShadow = a["receive-shadows"] !== "false";
    return mesh;
  }

  private buildSphere(node: MMLNode): THREE.Mesh {
    const a = node.attributes;
    const geo = new THREE.SphereGeometry(parseFloat(a["radius"] || "1"), 32, 32);
    const mesh = new THREE.Mesh(geo, this.buildMaterial(node));
    mesh.castShadow = a["cast-shadows"] !== "false";
    mesh.receiveShadow = a["receive-shadows"] !== "false";
    return mesh;
  }

  private buildCylinder(node: MMLNode): THREE.Mesh {
    const a = node.attributes;
    const radius = parseFloat(a["radius"] || "0.5");
    const height = parseFloat(a["height"] || "2");
    const geo = new THREE.CylinderGeometry(radius, radius, height, 32);
    const mesh = new THREE.Mesh(geo, this.buildMaterial(node));
    mesh.castShadow = a["cast-shadows"] !== "false";
    mesh.receiveShadow = a["receive-shadows"] !== "false";
    return mesh;
  }

  private buildPlane(node: MMLNode): THREE.Mesh {
    const a = node.attributes;
    const geo = new THREE.PlaneGeometry(
      parseFloat(a["width"] || "5"),
      parseFloat(a["height"] || "5")
    );
    const mat = this.buildMaterial(node);
    mat.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = a["receive-shadows"] !== "false";
    // Default orientation: horizontal ground plane
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }

  // ─── m-model / m-character ─────────────────────────────────────────────
  private async buildModel(node: MMLNode): Promise<THREE.Group> {
    const src = node.attributes["src"];
    if (!src) return new THREE.Group();

    try {
      const gltf = await this.gltfLoader.loadAsync(src);
      const model = gltf.scene;

      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = node.attributes["cast-shadows"] !== "false";
          child.receiveShadow = node.attributes["receive-shadows"] !== "false";
        }
      });

      if (gltf.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(model);
        const animName = node.attributes["anim"];
        let clip = gltf.animations[0];
        if (animName) {
          const found = THREE.AnimationClip.findByName(gltf.animations, animName);
          if (found) clip = found;
        }
        const action = mixer.clipAction(clip);
        if (node.attributes["anim-loop"] !== "false") {
          action.setLoop(THREE.LoopRepeat, Infinity);
        }
        action.play();
        this.mixers.push(mixer);
      }

      return model;
    } catch (e) {
      console.warn(`[MMLRenderer] Failed to load model: ${src}`, e);
      const fallback = new THREE.Group();
      const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      const mat = new THREE.MeshStandardMaterial({ color: 0xff0000, wireframe: true });
      fallback.add(new THREE.Mesh(geo, mat));
      return fallback;
    }
  }

  // ─── m-light ───────────────────────────────────────────────────────────
  private buildLight(node: MMLNode): THREE.Light {
    const a = node.attributes;
    const color = new THREE.Color(a["color"] || "#ffffff");
    const intensity = parseFloat(a["intensity"] || "1");
    const type = a["type"] || "point";

    let light: THREE.Light;

    switch (type) {
      case "directional": {
        const dl = new THREE.DirectionalLight(color, intensity);
        dl.castShadow = a["cast-shadows"] !== "false";
        if (dl.castShadow) {
          dl.shadow.mapSize.width = 1024;
          dl.shadow.mapSize.height = 1024;
        }
        light = dl;
        break;
      }
      case "spot": {
        const sl = new THREE.SpotLight(color, intensity);
        sl.angle = THREE.MathUtils.degToRad(parseFloat(a["angle"] || "30"));
        sl.penumbra = 0.1;
        sl.distance = parseFloat(a["distance"] || "20");
        sl.castShadow = a["cast-shadows"] !== "false";
        light = sl;
        break;
      }
      case "point":
      default: {
        const pl = new THREE.PointLight(color, intensity);
        pl.distance = parseFloat(a["distance"] || "20");
        pl.castShadow = a["cast-shadows"] !== "false";
        light = pl;
        break;
      }
    }

    return light;
  }

  // ─── m-image ───────────────────────────────────────────────────────────
  private async buildImage(node: MMLNode): Promise<THREE.Mesh> {
    const a = node.attributes;
    const width = parseFloat(a["width"] || "2");
    const height = parseFloat(a["height"] || "2");
    const opacity = parseFloat(a["opacity"] || "1");
    const geo = new THREE.PlaneGeometry(width, height);
    let mat: THREE.MeshBasicMaterial;

    if (a["src"]) {
      try {
        const tex = await new THREE.TextureLoader().loadAsync(a["src"]);
        mat = new THREE.MeshBasicMaterial({ map: tex, transparent: opacity < 1, opacity, side: THREE.DoubleSide });
      } catch {
        mat = new THREE.MeshBasicMaterial({ color: 0xff00ff, side: THREE.DoubleSide });
      }
    } else {
      mat = new THREE.MeshBasicMaterial({ color: 0xff00ff, side: THREE.DoubleSide });
    }

    return new THREE.Mesh(geo, mat);
  }

  // ─── m-video ───────────────────────────────────────────────────────────
  private buildVideo(node: MMLNode): THREE.Mesh {
    const a = node.attributes;
    const width = parseFloat(a["width"] || "4");
    const height = parseFloat(a["height"] || "2.25");
    const geo = new THREE.PlaneGeometry(width, height);
    let mat: THREE.MeshBasicMaterial;

    if (a["src"]) {
      const video = document.createElement("video");
      video.src = a["src"];
      video.loop = a["loop"] !== "false";
      video.muted = true;
      if (a["autoplay"] !== "false") { video.autoplay = true; video.play().catch(() => {}); }
      video.volume = parseFloat(a["volume"] || "1");
      const tex = new THREE.VideoTexture(video);
      mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
    } else {
      mat = new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide });
    }

    return new THREE.Mesh(geo, mat);
  }

  // ─── m-label ───────────────────────────────────────────────────────────
  private buildLabel(node: MMLNode): THREE.Object3D {
    const a = node.attributes;
    const content = a["content"] || "";
    const fontSize = parseInt(a["font-size"] || "24", 10);
    const color = a["color"] || "#ffffff";

    // Render text to canvas → texture → plane
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = Math.max(256, content.length * fontSize * 0.7);
    canvas.height = fontSize * 2.5;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = (a["alignment"] as CanvasTextAlign) || "center";
    ctx.textBaseline = "middle";
    ctx.fillText(content, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const aspect = canvas.width / canvas.height;
    const labelHeight = 0.5;
    const geo = new THREE.PlaneGeometry(labelHeight * aspect, labelHeight);
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    return new THREE.Mesh(geo, mat);
  }

  // ─── m-prompt (visual placeholder in editor) ───────────────────────────
  private buildPrompt(node: MMLNode): THREE.Object3D {
    const a = node.attributes;
    // Render as a label showing the prompt message
    const fakeLabel = { ...node, tag: "m-label" as const, attributes: { ...a, content: `[PROMPT: ${a["message"] || "..."}]`, "font-size": "14" } };
    return this.buildLabel(fakeLabel);
  }

  // ─── m-attr-anim registration ──────────────────────────────────────────
  private registerAttrAnim(target: THREE.Object3D, animNode: MMLNode) {
    const a = animNode.attributes;
    const attr = a["attr"];
    if (!attr) return;

    this.attrAnims.push({
      target,
      attr,
      start: parseFloat(a["start"] || "0"),
      end: parseFloat(a["end"] || "1"),
      duration: parseFloat(a["duration"] || "1000"),
      loop: a["loop"] !== "false",
      pingPong: a["ping-pong"] === "true",
      easing: a["easing"] || "linear",
      startTime: performance.now(),
      forward: true,
    });
  }

  private applyEasing(t: number, easing: string): number {
    switch (easing) {
      case "easeIn":    return t * t;
      case "easeOut":   return t * (2 - t);
      case "easeInOut": return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      case "easeInQuart": return t * t * t * t;
      case "easeOutSine": return Math.sin((t * Math.PI) / 2);
      default:          return t; // linear
    }
  }

  private tickAttrAnims(nowMs: number) {
    for (const anim of this.attrAnims) {
      const elapsed = nowMs - anim.startTime;
      let t = Math.min(1, elapsed / anim.duration);
      const te = this.applyEasing(anim.forward ? t : 1 - t, anim.easing);
      const value = anim.start + (anim.end - anim.start) * te;

      this.applyAttrToObject(anim.target as any, anim.attr, value);

      if (t >= 1) {
        if (anim.loop) {
          if (anim.pingPong) {
            anim.forward = !anim.forward;
          }
          anim.startTime = nowMs;
        }
      }
    }
  }

  private applyAttrToObject(obj: THREE.Object3D, attr: string, value: number) {
    switch (attr) {
      case "x":  obj.position.x = value; break;
      case "y":  obj.position.y = value; break;
      case "z":  obj.position.z = value; break;
      case "rx": obj.rotation.x = THREE.MathUtils.degToRad(value); break;
      case "ry": obj.rotation.y = THREE.MathUtils.degToRad(value); break;
      case "rz": obj.rotation.z = THREE.MathUtils.degToRad(value); break;
      case "sx": obj.scale.x = value; break;
      case "sy": obj.scale.y = value; break;
      case "sz": obj.scale.z = value; break;
      case "opacity":
        if (obj instanceof THREE.Mesh) {
          const mat = obj.material as THREE.MeshStandardMaterial;
          mat.opacity = value;
          mat.transparent = value < 1;
        }
        break;
      case "intensity":
        if (obj instanceof THREE.Light) obj.intensity = value;
        break;
    }
  }

  // ─── Dynamic attribute change (from sandbox) ───────────────────────────
  applyAttributeChange(id: string, attr: string, value: string) {
    const obj = this.objectMap.get(id);
    if (!obj) return;

    if (["x","y","z","rx","ry","rz","sx","sy","sz"].includes(attr)) {
      this.applyAttrToObject(obj, attr, parseFloat(value));
    } else if (attr === "visible") {
      obj.visible = value !== "false";
    } else if (attr === "color" && obj instanceof THREE.Mesh) {
      const mat = obj.material as THREE.MeshStandardMaterial;
      if (mat.color) mat.color.set(value);
    } else if (attr === "opacity" && obj instanceof THREE.Mesh) {
      const mat = obj.material as THREE.MeshStandardMaterial;
      mat.opacity = parseFloat(value);
      mat.transparent = parseFloat(value) < 1;
    } else if (attr === "intensity" && obj instanceof THREE.Light) {
      obj.intensity = parseFloat(value);
    }
  }

  // ─── Render loop ───────────────────────────────────────────────────────
  start() {
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);
      const delta = this.clock.getDelta();
      const now = performance.now();

      this.mixers.forEach((m) => m.update(delta));
      this.tickAttrAnims(now);
      if (this.selectionOutline) this.selectionOutline.update();
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  stop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  dispose() {
    this.stop();
    this.deselectObject();
    this.clearMMLObjects();
    this.transformControls.dispose();
    this.controls.dispose();
    this.renderer.dispose();
  }

  // ─── Selection & Picking ──────────────────────────────────────────────

  /**
   * Set callback for when object selection changes.
   */
  setOnSelectionChange(cb: SelectionCallback | null) {
    this.onSelectionChange = cb;
  }

  /**
   * Set callback for when a selected object's transform changes via gizmo.
   */
  setOnTransformChange(cb: TransformChangeCallback | null) {
    this.onTransformChange = cb;
  }

  /**
   * Handle a click event on the canvas — raycast to pick MML objects.
   */
  handleClick(event: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);

    // Only raycast against MML objects (exclude editor helpers)
    const mmlRoot = this.scene.getObjectByName("__mml_root__");
    if (!mmlRoot) return;

    const intersects = this.raycaster.intersectObjects(mmlRoot.children, true);

    if (intersects.length > 0) {
      // Walk up to find the object that has an MML id in objectMap
      let hit = intersects[0].object;
      let foundId: string | null = null;

      while (hit && hit !== mmlRoot) {
        for (const [id, obj] of this.objectMap) {
          if (id !== "__mml_root__" && obj === hit) {
            foundId = id;
            break;
          }
        }
        if (foundId) break;
        hit = hit.parent!;
      }

      if (foundId) {
        this.selectObjectById(foundId);
      } else {
        this.deselectObject();
      }
    } else {
      this.deselectObject();
    }
  }

  /**
   * Select an object by its MML id.
   */
  selectObjectById(id: string) {
    const obj = this.objectMap.get(id);
    if (!obj) return;

    this.selectedObject = obj;
    this.selectedObjectId = id;

    this.transformControls.attach(obj);
    this.updateSelectionOutline();

    if (this.onSelectionChange) {
      this.onSelectionChange(id);
    }
  }

  /**
   * Clear the current selection.
   */
  deselectObject() {
    if (!this.selectedObject) return;

    this.transformControls.detach();
    this.selectedObject = null;
    this.selectedObjectId = null;

    if (this.selectionOutline) {
      this.scene.remove(this.selectionOutline);
      this.selectionOutline.dispose();
      this.selectionOutline = null;
    }

    if (this.onSelectionChange) {
      this.onSelectionChange(null);
    }
  }

  /**
   * Set the transform gizmo mode.
   */
  setTransformMode(mode: "translate" | "rotate" | "scale") {
    this.transformControls.setMode(mode);
  }

  /**
   * Update or create the selection outline (BoxHelper).
   */
  private updateSelectionOutline() {
    if (this.selectionOutline) {
      this.scene.remove(this.selectionOutline);
      this.selectionOutline.dispose();
      this.selectionOutline = null;
    }

    if (this.selectedObject) {
      this.selectionOutline = new THREE.BoxHelper(this.selectedObject, 0x00aaff);
      this.selectionOutline.name = "__editor_selection__";
      this.scene.add(this.selectionOutline);
    }
  }

  getScene() { return this.scene; }
  getCamera() { return this.camera; }
  getObjectMap() { return this.objectMap; }
}
