import './styles.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { anatomySystems } from './model-config.js';
import { getBilingualStructureName } from './structure-names.js';

const ui = {
  canvas: document.querySelector('#anatomyCanvas'),
  canvasShell: document.querySelector('#canvasShell'),
  systemList: document.querySelector('#systemList'),
  systemSearch: document.querySelector('#systemSearch'),
  breadcrumbName: document.querySelector('#breadcrumbName'),
  viewerTitle: document.querySelector('#viewerTitle'),
  infoIndex: document.querySelector('#infoIndex'),
  infoTitle: document.querySelector('#infoTitle'),
  infoLatin: document.querySelector('#infoLatin'),
  infoDescription: document.querySelector('#infoDescription'),
  infoFacts: document.querySelector('#infoFacts'),
  meshCount: document.querySelector('#meshCount'),
  materialCount: document.querySelector('#materialCount'),
  modelStatus: document.querySelector('#modelStatus'),
  loadingOverlay: document.querySelector('#loadingOverlay'),
  loadingTitle: document.querySelector('#loadingTitle'),
  loadingText: document.querySelector('#loadingText'),
  progressBar: document.querySelector('#progressBar'),
  progressLabel: document.querySelector('#progressLabel'),
  errorOverlay: document.querySelector('#errorOverlay'),
  errorMessage: document.querySelector('#errorMessage'),
  retryButton: document.querySelector('#retryButton'),
  resetViewButton: document.querySelector('#resetViewButton'),
  autoRotateButton: document.querySelector('#autoRotateButton'),
  focusButton: document.querySelector('#focusButton'),
  panModeButton: document.querySelector('#panModeButton'),
  boxSelectButton: document.querySelector('#boxSelectButton'),
  selectionBox: document.querySelector('#selectionBox'),
  fullscreenButton: document.querySelector('#fullscreenButton'),
  helpButton: document.querySelector('#helpButton'),
  helpDialog: document.querySelector('#helpDialog'),
  closeHelpButton: document.querySelector('#closeHelpButton'),
  viewerHint: document.querySelector('#viewerHint'),
  selectedPartSection: document.querySelector('#selectedPartSection'),
  selectedPartName: document.querySelector('#selectedPartName'),
  selectedPartList: document.querySelector('#selectedPartList'),
};

const renderer = new THREE.WebGLRenderer({
  canvas: ui.canvas,
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(ui.canvasShell.clientWidth, ui.canvasShell.clientHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07101d);
scene.fog = new THREE.FogExp2(0x07101d, 0.035);

const camera = new THREE.PerspectiveCamera(
  36,
  ui.canvasShell.clientWidth / ui.canvasShell.clientHeight,
  0.01,
  1000,
);
camera.position.set(0, 0.25, 9);

const composer = new EffectComposer(renderer);
composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
composer.setSize(ui.canvasShell.clientWidth, ui.canvasShell.clientHeight);
composer.addPass(new RenderPass(scene, camera));

const outlinePass = new OutlinePass(
  new THREE.Vector2(ui.canvasShell.clientWidth, ui.canvasShell.clientHeight),
  scene,
  camera,
);
outlinePass.edgeStrength = 5;
outlinePass.edgeGlow = 0.7;
outlinePass.edgeThickness = 2;
outlinePass.pulsePeriod = 1.7;
outlinePass.visibleEdgeColor.set('#35f2df');
outlinePass.hiddenEdgeColor.set('#157a75');
composer.addPass(outlinePass);
composer.addPass(new OutputPass());

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.screenSpacePanning = true;
controls.minDistance = 1.2;
controls.maxDistance = 28;
controls.autoRotateSpeed = 0.9;
controls.target.set(0, 0, 0);

scene.add(new THREE.HemisphereLight(0xcce5ff, 0x172033, 1.15));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.25);
keyLight.position.set(4, 6, 7);
keyLight.castShadow = true;
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0x79bfff, 0.85);
fillLight.position.set(-5, 2, 4);
scene.add(fillLight);
const rimLight = new THREE.DirectionalLight(0xff9b75, 0.65);
rimLight.position.set(2, 3, -6);
scene.add(rimLight);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(3.6, 96),
  new THREE.MeshStandardMaterial({
    color: 0x0a1728,
    roughness: 0.82,
    metalness: 0.08,
    transparent: true,
    opacity: 0.72,
  }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -2.61;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(8, 20, 0x193852, 0x10263b);
grid.position.y = -2.6;
grid.material.opacity = 0.24;
grid.material.transparent = true;
scene.add(grid);

const loader = new GLTFLoader();
const modelBaseUrl = `${import.meta.env.BASE_URL}models/`;
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const modelRoot = new THREE.Group();
scene.add(modelRoot);

let activeSystem = anatomySystems[0];
const modelLayers = new Map();
const pendingLoads = new Map();
let loadSequence = 0;
let defaultView = { position: new THREE.Vector3(0, 0.25, 9), target: new THREE.Vector3() };
let pointerDown = null;
let interactionMode = 'rotate';
let boxSelectionStart = null;
let selectedObjects = [];
const selectedMaterialStates = new Map();
const maxBoxSelections = 120;

function createSystemButtons(filter = '') {
  const query = filter.trim().toLowerCase();
  const systems = anatomySystems.filter(
    (item) =>
      item.name.toLowerCase().includes(query) ||
      item.english.toLowerCase().includes(query) ||
      item.short.toLowerCase().includes(query),
  );

  ui.systemList.replaceChildren();
  systems.forEach((system) => {
    const index = anatomySystems.indexOf(system);
    const layer = modelLayers.get(system.id);
    const item = document.createElement('div');
    item.className = `system-item${system.id === activeSystem.id ? ' selected' : ''}${
      layer ? ' enabled' : ''
    }`;
    item.dataset.systemId = system.id;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'system-toggle';
    button.setAttribute('aria-pressed', String(Boolean(layer)));
    button.innerHTML = `
      <span class="layer-check">${layer ? '✓' : ''}</span>
      <span class="system-index">${String(index + 1).padStart(2, '0')}</span>
      <span class="system-label">
        <strong>${system.name}</strong>
        <small>${system.english}</small>
      </span>
    `;
    button.addEventListener('click', () => toggleSystemLayer(system));
    item.append(button);

    const opacityControl = document.createElement('label');
    opacityControl.className = 'layer-opacity';
    opacityControl.innerHTML = `
      <span>透明度</span>
      <input type="range" min="5" max="100" step="5" value="${Math.round(
        (layer?.opacity ?? 1) * 100,
      )}" aria-label="${system.name}透明度">
      <output>${Math.round((layer?.opacity ?? 1) * 100)}%</output>
    `;
    const range = opacityControl.querySelector('input');
    const output = opacityControl.querySelector('output');
    range.addEventListener('input', (event) => {
      const opacity = Number(event.target.value) / 100;
      output.value = `${event.target.value}%`;
      setLayerOpacity(system.id, opacity);
    });
    opacityControl.addEventListener('click', (event) => event.stopPropagation());
    item.append(opacityControl);
    ui.systemList.append(item);
  });

  if (!systems.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-search';
    empty.textContent = '未找到匹配的解剖系统';
    ui.systemList.append(empty);
  }
}

function updateSystemInfo(system) {
  const index = anatomySystems.indexOf(system) + 1;
  ui.breadcrumbName.textContent = system.name;
  ui.viewerTitle.textContent = system.name;
  ui.infoIndex.textContent = String(index).padStart(2, '0');
  ui.infoTitle.textContent = system.name;
  ui.infoLatin.textContent = system.latin;
  ui.infoDescription.textContent = system.description;
  ui.infoFacts.replaceChildren(
    ...system.facts.map((fact) => {
      const li = document.createElement('li');
      li.textContent = fact;
      return li;
    }),
  );
  document.title = `${system.name} · Anatomy Atlas`;
}

function setLoading(progress = 0, detail = '正在读取真实解剖数据…') {
  ui.errorOverlay.hidden = true;
  ui.loadingOverlay.classList.remove('is-hidden');
  ui.loadingTitle.textContent = `正在载入${activeSystem.name}`;
  ui.loadingText.textContent = detail;
  ui.progressBar.style.width = `${progress}%`;
  ui.progressLabel.textContent = `${Math.round(progress)}%`;
  ui.modelStatus.textContent = '载入中';
  ui.modelStatus.className = '';
  ui.meshCount.textContent = '—';
  ui.materialCount.textContent = '—';
}

function showError(error) {
  ui.loadingOverlay.classList.add('is-hidden');
  ui.errorOverlay.hidden = false;
  ui.modelStatus.textContent = '加载失败';
  ui.modelStatus.className = 'error-status';
  const reason = error?.message ? `（${error.message}）` : '';
  ui.errorMessage.textContent = `无法加载 “${activeSystem.file}” ${reason}`;
}

function disposeMaterial(material) {
  for (const value of Object.values(material)) {
    if (value?.isTexture) value.dispose();
  }
  material.dispose();
}

export function disposeModel(model) {
  if (!model) return;
  model.traverse((object) => {
    if (!object.isMesh) return;
    object.geometry?.dispose();
    if (Array.isArray(object.material)) object.material.forEach(disposeMaterial);
    else if (object.material) disposeMaterial(object.material);
  });
  model.removeFromParent();
  renderer.renderLists.dispose();
}

function disposeLayer(systemId) {
  const layer = modelLayers.get(systemId);
  if (!layer) return;
  if (selectedObjects.some((object) => layer.model.getObjectById(object.id))) {
    clearSelection();
  }
  disposeModel(layer.model);
  modelLayers.delete(systemId);
}

function clearSelection() {
  selectedMaterialStates.forEach(({ originalMaterial, highlightMaterials }, object) => {
    object.material = originalMaterial;
    highlightMaterials.forEach((material) => material.dispose());
  });
  selectedMaterialStates.clear();
  selectedObjects = [];
  outlinePass.selectedObjects = [];
  ui.selectedPartSection.hidden = true;
  ui.selectedPartName.textContent = '—';
  ui.selectedPartList.replaceChildren();
}

function getStructureName(object) {
  const rawName = object.name || object.parent?.name || 'Unnamed anatomical structure';
  return getBilingualStructureName(rawName);
}

function updateSelectionInfo(objects) {
  const names = [
    ...new Map(
      objects.map((object) => {
        const name = getStructureName(object);
        return [name.english, name];
      }),
    ).values(),
  ];
  ui.selectedPartName.replaceChildren();
  if (names.length === 1) {
    const chinese = document.createElement('span');
    chinese.className = 'structure-name-chinese';
    chinese.textContent = names[0].chinese;
    const english = document.createElement('small');
    english.className = 'structure-name-english';
    english.textContent = names[0].english;
    ui.selectedPartName.append(chinese, english);
  } else {
    ui.selectedPartName.textContent = `已选择 ${names.length} 个结构`;
  }
  ui.selectedPartList.replaceChildren(
    ...names.slice(0, 8).map((name) => {
      const item = document.createElement('span');
      const chinese = document.createElement('b');
      chinese.textContent = name.chinese;
      const english = document.createElement('small');
      english.textContent = name.english;
      item.append(chinese, english);
      return item;
    }),
  );
  if (names.length > 8) {
    const remainder = document.createElement('span');
    remainder.textContent = `另有 ${names.length - 8} 个`;
    remainder.className = 'selection-remainder';
    ui.selectedPartList.append(remainder);
  }
  ui.selectedPartSection.querySelector('p').textContent =
    names.length > 1 ? '框选结果已同时高亮，可切换模式后继续观察。' : '单击模型可切换查看其他结构。';
  ui.selectedPartSection.hidden = false;
}

function highlightSelections(objects) {
  clearSelection();
  selectedObjects = objects.filter((object) => object?.isMesh);
  selectedObjects.forEach((object) => {
    const originalMaterial = object.material;
    const sourceMaterials = Array.isArray(originalMaterial) ? originalMaterial : [originalMaterial];
    const highlightMaterials = sourceMaterials.map((source) => {
      const material = source.clone();
      if (material.emissive) {
        material.emissive.set('#18d9c7');
        material.emissiveIntensity = 0.75;
      } else if (material.color) {
        material.color.lerp(new THREE.Color('#35f2df'), 0.42);
      }
      material.needsUpdate = true;
      return material;
    });
    selectedMaterialStates.set(object, { originalMaterial, highlightMaterials });
    object.material = Array.isArray(originalMaterial) ? highlightMaterials : highlightMaterials[0];
  });
  outlinePass.selectedObjects = selectedObjects;
  updateSelectionInfo(selectedObjects);
}

function isHierarchyVisible(object) {
  let current = object;
  while (current) {
    if (!current.visible) return false;
    current = current.parent;
  }
  return true;
}

function getObjectSystemId(object) {
  let current = object;
  while (current) {
    if (current.userData.systemId) return current.userData.systemId;
    current = current.parent;
  }
  return null;
}

function isMuscleCoveringStructure(object) {
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  const materialNames = materials.filter(Boolean).map((material) => material.name);
  const objectName = object.name.toLowerCase();
  return (
    (materialNames.length > 0 &&
      materialNames.every((name) => /\b(fascia|bursa|tendon|ligament)\b/i.test(name))) ||
    /\b(fascia|aponeurosis|bursa|bursae|ligament|raphe|intermuscular septum)\b/i.test(
      objectName,
    ) ||
    /\blinea alba\b/i.test(objectName)
  );
}

function getPreferredIntersection(intersections) {
  const visibleHits = intersections.filter((intersection) =>
    isHierarchyVisible(intersection.object),
  );
  if (activeSystem.id !== 'muscular') return visibleHits[0];

  const muscularHits = visibleHits.filter(
    (intersection) => getObjectSystemId(intersection.object) === 'muscular',
  );
  return (
    muscularHits.find((intersection) => !isMuscleCoveringStructure(intersection.object)) ||
    muscularHits[0] ||
    visibleHits[0]
  );
}

function setReferenceAppearance(group) {
  group.traverse((object) => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    object.material = materials.map((source) => {
      const material = source.clone();
      material.transparent = true;
      material.opacity = Math.min(source.opacity, 0.2);
      material.depthWrite = false;
      material.needsUpdate = true;
      return material;
    });
    if (object.material.length === 1) [object.material] = object.material;
  });
}

function applySystemHierarchy(model, system) {
  const groups = new Set(system.groups ?? []);
  const references = new Set(system.referenceGroups ?? []);
  let matchedGroups = 0;

  model.children.forEach((child) => {
    const isSelected = groups.has(child.name);
    child.visible = isSelected;
    if (!isSelected) return;
    matchedGroups += 1;
    if (references.has(child.name)) setReferenceAppearance(child);
  });

  if (!matchedGroups) {
    model.children.forEach((child) => {
      child.visible = true;
    });
    const isStandaloneExport = model.children.some((child) => child.isMesh);
    if (!isStandaloneExport) {
      console.warn(`未在模型中匹配到 ${system.name} 对应的节点层级`);
    }
  }
}

const anatomyColors = {
  skin: new THREE.Color('#c98f78'),
  bone: new THREE.Color('#e1d2b5'),
  cartilage: new THREE.Color('#9fc8c0'),
  bursa: new THREE.Color('#4eb9c7'),
  fascia: new THREE.Color('#b7d8dc'),
  fat: new THREE.Color('#d6ad58'),
  suture: new THREE.Color('#8f796d'),
  teeth: new THREE.Color('#f3ead2'),
  muscle: new THREE.Color('#a93f3b'),
  tendon: new THREE.Color('#d8c9aa'),
  ligament: new THREE.Color('#c4b58e'),
  joint: new THREE.Color('#47b7aa'),
  artery: new THREE.Color('#d94b4b'),
  vein: new THREE.Color('#3979c9'),
  nerve: new THREE.Color('#e3b83f'),
  brain: new THREE.Color('#d98f82'),
  whiteMatter: new THREE.Color('#ded6c9'),
  greyMatter: new THREE.Color('#a87876'),
  nucleus: new THREE.Color('#a65c4f'),
  lymph: new THREE.Color('#62b98d'),
  organ: new THREE.Color('#b85c70'),
  lung: new THREE.Color('#d58d9e'),
  liver: new THREE.Color('#8c493f'),
  kidney: new THREE.Color('#a85a52'),
  heart: new THREE.Color('#b83f45'),
  digestive: new THREE.Color('#c87b69'),
  pancreas: new THREE.Color('#d7a45d'),
  spleen: new THREE.Color('#82506e'),
  origin: new THREE.Color('#e65a54'),
  insertion: new THREE.Color('#4f93d2'),
};

function isNeutralMaterial(material) {
  if (!material?.color || material.map) return false;
  const { h, s, l } = material.color.getHSL({ h: 0, s: 0, l: 0 });
  return s < 0.08 || l > 0.9 || Number.isNaN(h);
}

function getAnatomyColor(object, material, system) {
  const label = `${object.name} ${material.name}`.toLowerCase();
  const groupName = object.parent?.name?.toLowerCase() ?? '';

  if (system.id === 'insertions' && /origin/i.test(material.name)) {
    return anatomyColors.origin;
  }
  if (system.id === 'insertions' && /^(end|insertion)/i.test(material.name)) {
    return anatomyColors.insertion;
  }
  if (/tooth|teeth|dentine/.test(label)) return anatomyColors.teeth;
  if (/bursa/.test(label)) return anatomyColors.bursa;
  if (/fascia/.test(label)) return anatomyColors.fascia;
  if (/(^|[\s_-])fat([\s_-]|$)/.test(label)) return anatomyColors.fat;
  if (/cartilage|meniscus|disc/.test(label)) return anatomyColors.cartilage;
  if (/suture/.test(label)) return anatomyColors.suture;
  if (/tendon|aponeuros/.test(label)) return anatomyColors.tendon;
  if (/ligament/.test(label)) return anatomyColors.ligament;
  if (/pulmonary artery/.test(label)) return anatomyColors.vein;
  if (/pulmonary vein/.test(label)) return anatomyColors.artery;
  if (/arter|aorta/.test(label) || groupName.includes('arterial')) return anatomyColors.artery;
  if (/vein|vena/.test(label) || groupName.includes('venous')) return anatomyColors.vein;
  if (/nerve|ganglion|plexus|spinal cord/.test(label)) return anatomyColors.nerve;
  if (/white matter/.test(label)) return anatomyColors.whiteMatter;
  if (/grey matter|gray matter/.test(label)) return anatomyColors.greyMatter;
  if (/nucleus/.test(label)) return anatomyColors.nucleus;
  if (/brain|cerebr|cerebell|medulla|pons|thalam|hypothalam/.test(label)) {
    return anatomyColors.brain;
  }
  if (/lung|bronch|trachea/.test(label)) return anatomyColors.lung;
  if (/liver|gallbladder/.test(label)) return anatomyColors.liver;
  if (/kidney|ureter|bladder/.test(label)) return anatomyColors.kidney;
  if (
    (system.id === 'visceral' || system.id === 'cardiovascular') &&
    /heart|myocard|atrium|ventricle/.test(label)
  ) {
    return anatomyColors.heart;
  }
  if (/pancrea/.test(label)) return anatomyColors.pancreas;
  if (/spleen/.test(label)) return anatomyColors.spleen;
  if (/stomach|intestin|colon|rectum|esophag/.test(label)) return anatomyColors.digestive;

  switch (system.id) {
    case 'regions':
      return anatomyColors.skin;
    case 'skeletal':
      return anatomyColors.bone;
    case 'joints':
      return anatomyColors.joint;
    case 'muscular':
    case 'insertions':
      return anatomyColors.muscle;
    case 'cardiovascular':
      return anatomyColors.artery;
    case 'nervous':
      return anatomyColors.nerve;
    case 'visceral':
      return anatomyColors.organ;
    case 'lymphoid':
      return anatomyColors.lymph;
    default:
      return null;
  }
}

function shouldApplyAnatomyColor(material, system, color) {
  if (!color || material.map) return false;
  if (system.id === 'skeletal') return false;
  if (system.id === 'insertions') return true;
  if (system.id === 'muscular') {
    return (
      isNeutralMaterial(material) ||
      /bursa|fascia|tendon|aponeuros|ligament/i.test(material.name)
    );
  }
  if (system.id === 'cardiovascular') {
    return /arter|vein|vena|aorta/i.test(material.name) || isNeutralMaterial(material);
  }
  return isNeutralMaterial(material);
}

function repairAnatomyMaterials(model, system) {
  const repairedMaterials = new Set();
  let colorized = 0;

  model.traverse((object) => {
    if (!object.isMesh || !isHierarchyVisible(object)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];

    materials.filter(Boolean).forEach((material) => {
      if (material.emissive && !material.emissiveMap) {
        const emission = material.emissive;
        const isWhiteEmission =
          emission.r > 0.85 && emission.g > 0.85 && emission.b > 0.85;
        if (isWhiteEmission) {
          emission.set(0x000000);
          material.emissiveIntensity = 0;
        }
      }

      const color = getAnatomyColor(object, material, system);
      if (shouldApplyAnatomyColor(material, system, color)) {
        material.color.copy(color);
        material.metalness = 0;
        material.roughness = Math.max(material.roughness ?? 0, 0.62);
        colorized += 1;
      }

      if (/fascia|pleura|dura/i.test(material.name)) {
        material.transparent = true;
        material.opacity = 0.2;
        material.depthWrite = false;
      } else if (/peritoneum|omentum|mesocolon/i.test(material.name)) {
        material.transparent = true;
        material.opacity = 0.3;
        material.depthWrite = false;
      } else if (/bursa/i.test(material.name)) {
        material.transparent = true;
        material.opacity = 0.48;
        material.depthWrite = false;
      }

      material.needsUpdate = true;
      repairedMaterials.add(material.uuid);
    });
  });

  return { colorized, materials: repairedMaterials.size };
}

function applyLayerOpacity(layer, opacity) {
  layer.opacity = opacity;
  layer.model.traverse((object) => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach((material) => {
      if (material.userData.anatomyBaseOpacity === undefined) {
        material.userData.anatomyBaseOpacity = material.opacity;
        material.userData.anatomyBaseTransparent = material.transparent;
        material.userData.anatomyBaseDepthWrite = material.depthWrite;
      }
      material.opacity = material.userData.anatomyBaseOpacity * opacity;
      material.transparent = material.userData.anatomyBaseTransparent || opacity < 0.999;
      material.depthWrite = opacity >= 0.95 && material.userData.anatomyBaseDepthWrite;
      material.needsUpdate = true;
    });
  });
}

function setLayerOpacity(systemId, opacity) {
  const layer = modelLayers.get(systemId);
  if (!layer) return;
  applyLayerOpacity(layer, opacity);
}

function inspectModel(model) {
  let meshes = 0;
  const materials = new Set();
  model.traverse((object) => {
    if (!object.isMesh || !isHierarchyVisible(object)) return;
    object.geometry?.computeBoundingBox();
    const localSize = object.geometry?.boundingBox?.getSize(new THREE.Vector3());
    const longestSide = localSize ? Math.max(localSize.x, localSize.y, localSize.z) : 0;
    const shortestSide = localSize ? Math.min(localSize.x, localSize.y, localSize.z) : 0;
    const isExportDecoration =
      /^Navigation/i.test(object.name) ||
      (longestSide > 2.5 && shortestSide < longestSide * 0.001);
    if (isExportDecoration) {
      object.visible = false;
      object.userData.excludedFromAnatomyView = true;
      return;
    }
    meshes += 1;
    object.castShadow = true;
    object.receiveShadow = true;
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    objectMaterials.filter(Boolean).forEach((material) => {
      materials.add(material.uuid);
      if ('envMapIntensity' in material) material.envMapIntensity = 0.8;
      material.needsUpdate = true;
    });
  });
  return { meshes, materials: materials.size };
}

function getVisibleModelBox(model) {
  const box = new THREE.Box3();
  const meshBox = new THREE.Box3();
  model.updateMatrixWorld(true);
  model.traverse((object) => {
    if (!object.isMesh || !isHierarchyVisible(object) || object.userData.excludedFromAnatomyView) return;
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    meshBox.copy(object.geometry.boundingBox).applyMatrix4(object.matrixWorld);
    box.union(meshBox);
  });
  return box;
}

function fitVisibleLayers() {
  if (!modelLayers.size) return;
  modelRoot.position.set(0, 0, 0);
  modelRoot.scale.setScalar(1);
  modelRoot.updateMatrixWorld(true);

  const initialBox = getVisibleModelBox(modelRoot);
  if (initialBox.isEmpty()) throw new Error('模型中没有可显示的网格');

  const center = initialBox.getCenter(new THREE.Vector3());
  const size = initialBox.getSize(new THREE.Vector3());
  const longestSide = Math.max(size.x, size.y, size.z);
  const targetSize = 5.15;
  const scale = targetSize / longestSide;

  modelRoot.scale.setScalar(scale);
  modelRoot.position.copy(center).multiplyScalar(-scale);
  modelRoot.updateMatrixWorld(true);

  const fittedBox = getVisibleModelBox(modelRoot);
  const fittedSize = fittedBox.getSize(new THREE.Vector3());
  floor.position.y = -fittedSize.y / 2 - 0.08;
  grid.position.y = floor.position.y + 0.002;

  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const fitHeightDistance = fittedSize.y / (2 * Math.tan(verticalFov / 2));
  const fitWidthDistance = fittedSize.x / (2 * Math.tan(verticalFov / 2) * camera.aspect);
  const distance = Math.max(fitHeightDistance, fitWidthDistance) * 1.28;
  const direction = new THREE.Vector3(0, 0.04, 1).normalize();

  defaultView = {
    position: direction.multiplyScalar(Math.max(distance, 4.5)),
    target: new THREE.Vector3(0, 0, 0),
  };
  resetView();
}

function resetView() {
  camera.position.copy(defaultView.position);
  controls.target.copy(defaultView.target);
  camera.near = Math.max(0.01, camera.position.length() / 100);
  camera.far = Math.max(100, camera.position.length() * 20);
  camera.updateProjectionMatrix();
  controls.update();
}

function loadModel(system) {
  const sequence = ++loadSequence;
  pendingLoads.set(system.id, sequence);
  setLoading();
  clearSelection();

  loader.load(
    `${modelBaseUrl}${encodeURIComponent(system.file)}`,
    (gltf) => {
      if (pendingLoads.get(system.id) !== sequence) {
        disposeModel(gltf.scene);
        return;
      }
      try {
        const isFirstVisibleLayer = modelLayers.size === 0;
        const model = gltf.scene;
        model.name ||= system.name;
        model.userData.systemId = system.id;
        applySystemHierarchy(model, system);
        repairAnatomyMaterials(model, system);
        const stats = inspectModel(model);
        const layer = { system, model, opacity: 1, stats };
        modelLayers.set(system.id, layer);
        modelRoot.add(model);
        applyLayerOpacity(layer, 1);
        pendingLoads.delete(system.id);
        if (isFirstVisibleLayer) fitVisibleLayers();
        activeSystem = system;
        updateSystemInfo(system);
        ui.meshCount.textContent = stats.meshes.toLocaleString('zh-CN');
        ui.materialCount.textContent = stats.materials.toLocaleString('zh-CN');
        ui.modelStatus.textContent = '已就绪';
        ui.modelStatus.className = 'ready-status';
        ui.progressBar.style.width = '100%';
        ui.progressLabel.textContent = '100%';
        ui.loadingOverlay.classList.add('is-hidden');
        createSystemButtons(ui.systemSearch.value);
      } catch (error) {
        pendingLoads.delete(system.id);
        disposeLayer(system.id);
        showError(error);
      }
    },
    (event) => {
      if (pendingLoads.get(system.id) !== sequence) return;
      const hasTotal = event.lengthComputable && event.total > 0;
      const progress = hasTotal ? Math.min((event.loaded / event.total) * 100, 99) : 35;
      const loadedMb = (event.loaded / 1024 / 1024).toFixed(1);
      const detail = hasTotal
        ? `已读取 ${loadedMb} MB / ${(event.total / 1024 / 1024).toFixed(1)} MB`
        : `已读取 ${loadedMb} MB`;
      setLoading(progress, detail);
    },
    (error) => {
      if (pendingLoads.get(system.id) === sequence) {
        pendingLoads.delete(system.id);
        showError(error);
      }
    },
  );
}

function showLayerInfo(system) {
  activeSystem = system;
  updateSystemInfo(system);
  const layer = modelLayers.get(system.id);
  if (layer) {
    ui.meshCount.textContent = layer.stats.meshes.toLocaleString('zh-CN');
    ui.materialCount.textContent = layer.stats.materials.toLocaleString('zh-CN');
    ui.modelStatus.textContent = '已就绪';
    ui.modelStatus.className = 'ready-status';
  }
}

function toggleSystemLayer(system) {
  if (pendingLoads.has(system.id)) return;
  if (modelLayers.has(system.id)) {
    disposeLayer(system.id);
    if (activeSystem.id === system.id) {
      const nextLayer = modelLayers.values().next().value;
      if (nextLayer) showLayerInfo(nextLayer.system);
      else {
        ui.meshCount.textContent = '—';
        ui.materialCount.textContent = '—';
        ui.modelStatus.textContent = '未启用';
        ui.modelStatus.className = '';
      }
    }
    createSystemButtons(ui.systemSearch.value);
    return;
  }
  showLayerInfo(system);
  createSystemButtons(ui.systemSearch.value);
  loadModel(system);
}

function handleResize() {
  const { clientWidth, clientHeight } = ui.canvasShell;
  camera.aspect = clientWidth / clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(clientWidth, clientHeight, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  composer.setSize(clientWidth, clientHeight);
}

function pickModel(event) {
  if (!modelLayers.size || !pointerDown) return;
  const moved = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
  pointerDown = null;
  if (moved > 5) return;

  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = getPreferredIntersection(raycaster.intersectObject(modelRoot, true));
  if (!hit) {
    clearSelection();
    return;
  }

  highlightSelections([hit.object]);
}

function setInteractionMode(mode) {
  interactionMode = interactionMode === mode ? 'rotate' : mode;
  const isPan = interactionMode === 'pan';
  const isBox = interactionMode === 'box';
  controls.enabled = !isBox;
  controls.mouseButtons.LEFT = isPan ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
  ui.panModeButton.classList.toggle('active', isPan);
  ui.panModeButton.setAttribute('aria-pressed', String(isPan));
  ui.boxSelectButton.classList.toggle('active', isBox);
  ui.boxSelectButton.setAttribute('aria-pressed', String(isBox));
  renderer.domElement.classList.toggle('is-pan-mode', isPan);
  renderer.domElement.classList.toggle('is-box-mode', isBox);
  ui.selectionBox.hidden = true;
  boxSelectionStart = null;
}

function updateSelectionBox(event) {
  if (!boxSelectionStart) return;
  const rect = renderer.domElement.getBoundingClientRect();
  const currentX = THREE.MathUtils.clamp(event.clientX - rect.left, 0, rect.width);
  const currentY = THREE.MathUtils.clamp(event.clientY - rect.top, 0, rect.height);
  const left = Math.min(boxSelectionStart.x, currentX);
  const top = Math.min(boxSelectionStart.y, currentY);
  ui.selectionBox.style.left = `${left}px`;
  ui.selectionBox.style.top = `${top}px`;
  ui.selectionBox.style.width = `${Math.abs(currentX - boxSelectionStart.x)}px`;
  ui.selectionBox.style.height = `${Math.abs(currentY - boxSelectionStart.y)}px`;
}

function selectObjectsInBox(event) {
  if (!boxSelectionStart) return;
  const rect = renderer.domElement.getBoundingClientRect();
  const endX = THREE.MathUtils.clamp(event.clientX - rect.left, 0, rect.width);
  const endY = THREE.MathUtils.clamp(event.clientY - rect.top, 0, rect.height);
  const bounds = {
    left: Math.min(boxSelectionStart.x, endX),
    right: Math.max(boxSelectionStart.x, endX),
    top: Math.min(boxSelectionStart.y, endY),
    bottom: Math.max(boxSelectionStart.y, endY),
  };
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  ui.selectionBox.hidden = true;
  boxSelectionStart = null;

  if (width < 5 && height < 5) {
    pointerDown = { x: event.clientX, y: event.clientY };
    pickModel(event);
    return;
  }

  const center = new THREE.Vector3();
  const worldBox = new THREE.Box3();
  const candidates = [];
  modelRoot.updateMatrixWorld(true);
  modelRoot.traverse((object) => {
    if (
      !object.isMesh ||
      !isHierarchyVisible(object) ||
      object.userData.excludedFromAnatomyView ||
      (activeSystem.id === 'muscular' &&
        (getObjectSystemId(object) !== 'muscular' || isMuscleCoveringStructure(object)))
    ) {
      return;
    }
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    worldBox.copy(object.geometry.boundingBox).applyMatrix4(object.matrixWorld);
    worldBox.getCenter(center).project(camera);
    const screenX = ((center.x + 1) / 2) * rect.width;
    const screenY = ((1 - center.y) / 2) * rect.height;
    if (
      center.z >= -1 &&
      center.z <= 1 &&
      screenX >= bounds.left &&
      screenX <= bounds.right &&
      screenY >= bounds.top &&
      screenY <= bounds.bottom
    ) {
      candidates.push(object);
    }
  });

  if (!candidates.length) {
    clearSelection();
    return;
  }
  highlightSelections(candidates.slice(0, maxBoxSelections));
}

ui.systemSearch.addEventListener('input', (event) => createSystemButtons(event.target.value));
ui.retryButton.addEventListener('click', () => loadModel(activeSystem));
ui.resetViewButton.addEventListener('click', resetView);
ui.focusButton.addEventListener('click', fitVisibleLayers);
ui.panModeButton.addEventListener('click', () => setInteractionMode('pan'));
ui.boxSelectButton.addEventListener('click', () => setInteractionMode('box'));
ui.autoRotateButton.addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate;
  ui.autoRotateButton.classList.toggle('active', controls.autoRotate);
  ui.autoRotateButton.setAttribute('aria-pressed', String(controls.autoRotate));
});
ui.fullscreenButton.addEventListener('click', async () => {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch (error) {
    console.warn('无法切换全屏模式', error);
  }
});
ui.helpButton.addEventListener('click', () => {
  ui.helpDialog.hidden = false;
});
ui.closeHelpButton.addEventListener('click', () => {
  ui.helpDialog.hidden = true;
});
ui.helpDialog.addEventListener('click', (event) => {
  if (event.target === ui.helpDialog) ui.helpDialog.hidden = true;
});
renderer.domElement.addEventListener('pointerdown', (event) => {
  pointerDown = { x: event.clientX, y: event.clientY };
  ui.viewerHint.classList.add('is-hidden');
  if (interactionMode === 'box' && event.button === 0) {
    const rect = renderer.domElement.getBoundingClientRect();
    boxSelectionStart = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    ui.selectionBox.hidden = false;
    updateSelectionBox(event);
    renderer.domElement.setPointerCapture(event.pointerId);
  }
});
renderer.domElement.addEventListener('pointermove', (event) => {
  if (interactionMode === 'box') updateSelectionBox(event);
});
renderer.domElement.addEventListener('pointerup', (event) => {
  if (interactionMode === 'box' && event.button === 0) {
    selectObjectsInBox(event);
    if (renderer.domElement.hasPointerCapture(event.pointerId)) {
      renderer.domElement.releasePointerCapture(event.pointerId);
    }
    pointerDown = null;
    return;
  }
  pickModel(event);
});
renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());
window.addEventListener('resize', handleResize);
document.addEventListener('fullscreenchange', handleResize);

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  controls.update(delta);
  composer.render();
}

createSystemButtons();
updateSystemInfo(activeSystem);
loadModel(activeSystem);
animate();
