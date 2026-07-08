import 'dart:convert';

import 'generated_avatar.dart';

const String hoopRankAvatarModelViewerId = 'hooprank-avatar-model';

String? buildAvatarModelViewerCustomizationJs({
  required Map<String, dynamic>? avatarConfig,
  String? modelScale,
}) {
  if (!isGeneratedAvatarConfig(avatarConfig)) return null;
  final payload = generatedAvatarModelCustomizationPayload(avatarConfig);
  if (payload == null) return null;
  final payloadJson = jsonEncode(payload);
  final scaleJson = jsonEncode(modelScale);
  final modelViewerSelector =
      jsonEncode('model-viewer#$hoopRankAvatarModelViewerId');

  return '''
const hoopRankAvatarCustomization = $payloadJson;
const hoopRankModelScale = $scaleJson;
const hoopRankModelViewerSelector = $modelViewerSelector;
let hoopRankMaterialRetryCount = 0;

function hoopRankRigStatus() {
  if (!window.__hoopRankAvatarRigStatus) {
    window.__hoopRankAvatarRigStatus = {
      applied: false,
      attempts: 0,
      baseRigAssetId: hoopRankAvatarCustomization.baseRigAssetId || null,
      runtimeBinding: hoopRankAvatarCustomization.runtimeBinding || null,
      animationName: hoopRankAvatarCustomization.animationName || null,
      missingMaterials: [],
      missingNodes: [],
      missingMorphTargets: [],
      appliedMaterialCount: 0,
      appliedNodeCount: 0,
      appliedMorphCount: 0,
    };
  }
  return window.__hoopRankAvatarRigStatus;
}

function hoopRankHexToRgba(hex, alpha) {
  if (Array.isArray(hex)) return hex;
  const normalized = String(hex || '#111827').replace('#', '');
  const value = normalized.length === 6 ? normalized : '111827';
  const r = parseInt(value.substring(0, 2), 16) / 255;
  const g = parseInt(value.substring(2, 4), 16) / 255;
  const b = parseInt(value.substring(4, 6), 16) / 255;
  return [r, g, b, alpha];
}

function hoopRankSceneRoot(modelViewer) {
  const model = modelViewer && modelViewer.model;
  if (!model) return null;
  return model.scene || model.sourceObject || model.threeScene || null;
}

function hoopRankNormalizeRigName(name) {
  return String(name || '').replace(/\\.\\d{3}\$/, '');
}

function hoopRankRigNamesMatch(actualName, expectedName) {
  return hoopRankNormalizeRigName(actualName) === hoopRankNormalizeRigName(expectedName);
}

function hoopRankTraverseScene(root, visitor) {
  if (!root || typeof visitor !== 'function') return;
  if (typeof root.traverse === 'function') {
    root.traverse(visitor);
    return;
  }
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    visitor(node);
    const children = Array.isArray(node.children) ? node.children : [];
    for (const child of children) stack.push(child);
  }
}

function hoopRankFindNode(root, nodeName) {
  if (!root || !nodeName) return null;
  if (typeof root.getObjectByName === 'function') {
    const found = root.getObjectByName(nodeName);
    if (found) return found;
  }
  let match = null;
  hoopRankTraverseScene(root, (node) => {
    if (!match && node && hoopRankRigNamesMatch(node.name, nodeName)) match = node;
  });
  return match;
}

function hoopRankMaterialByName(modelViewer, materialName) {
  const materials = modelViewer && modelViewer.model
    ? modelViewer.model.materials || []
    : [];
  for (const material of materials) {
    if (material && hoopRankRigNamesMatch(material.name, materialName)) return material;
  }
  return null;
}

function hoopRankSetMaterialColor(material, hex, alpha) {
  if (!material || !material.pbrMetallicRoughness) return false;
  material.pbrMetallicRoughness.setBaseColorFactor(
    hoopRankHexToRgba(hex, alpha)
  );
  return true;
}

function hoopRankApplyMaterialVisibility(material, visible) {
  if (!material || !material.pbrMetallicRoughness) return false;
  if (material.setAlphaMode) material.setAlphaMode('BLEND');
  const current = material.pbrMetallicRoughness.baseColorFactor || [1, 1, 1, 1];
  const color = Array.isArray(current) ? current : [1, 1, 1, 1];
  material.pbrMetallicRoughness.setBaseColorFactor([
    color[0] ?? 1,
    color[1] ?? 1,
    color[2] ?? 1,
    visible ? 1 : 0,
  ]);
  return true;
}

function hoopRankSetNodeVisible(root, nodeName, visible) {
  const node = hoopRankFindNode(root, nodeName);
  if (!node) return false;
  node.visible = visible;
  return true;
}

function hoopRankApplyMorphInfluence(targetCarrier, targetName, rawWeight) {
  if (!targetCarrier || !targetName) return false;
  const dictionary = targetCarrier.morphTargetDictionary;
  const influences = targetCarrier.morphTargetInfluences;
  if (!dictionary || !influences) return false;

  let targetIndex = dictionary[targetName];
  if (targetIndex === undefined) {
    for (const [candidateName, candidateIndex] of Object.entries(dictionary)) {
      if (hoopRankRigNamesMatch(candidateName, targetName)) {
        targetIndex = candidateIndex;
        break;
      }
    }
  }
  if (targetIndex === undefined) return false;

  const weight = Number(rawWeight);
  influences[targetIndex] = Number.isFinite(weight) ? weight : 0;
  return true;
}

function hoopRankMorphCarriersForNode(node) {
  const carriers = [];
  const addCarrier = (carrier) => {
    if (carrier && !carriers.includes(carrier)) carriers.push(carrier);
  };
  addCarrier(node);
  if (node && node.mesh) addCarrier(node.mesh);
  const primitives = node && node.mesh && Array.isArray(node.mesh.primitives)
    ? node.mesh.primitives
    : [];
  for (const primitive of primitives) addCarrier(primitive);
  return carriers;
}

function hoopRankApplyMorphTargets(root, morphTargets, status) {
  if (!root || !morphTargets) return;
  const matched = new Set();
  hoopRankTraverseScene(root, (node) => {
    for (const [targetName, rawWeight] of Object.entries(morphTargets)) {
      for (const carrier of hoopRankMorphCarriersForNode(node)) {
        if (!hoopRankApplyMorphInfluence(carrier, targetName, rawWeight)) {
          continue;
        }
        matched.add(targetName);
        status.appliedMorphCount += 1;
      }
    }
  });
  for (const targetName of Object.keys(morphTargets)) {
    if (!matched.has(targetName)) status.missingMorphTargets.push(targetName);
  }
}

function hoopRankApplyAnimation(modelViewer, animationName) {
  if (!animationName) return;
  modelViewer.setAttribute('animation-name', animationName);
  modelViewer.setAttribute('autoplay', '');
  if (typeof modelViewer.play === 'function') {
    modelViewer.play({repetitions: Infinity});
  }
}

function applyHoopRankAvatarCustomization() {
  const status = hoopRankRigStatus();
  status.attempts += 1;
  const hoopRankAvatarModel = document.querySelector(hoopRankModelViewerSelector);
  if (!hoopRankAvatarModel || !hoopRankAvatarModel.model) {
    if (hoopRankMaterialRetryCount < 360) {
      hoopRankMaterialRetryCount += 1;
      requestAnimationFrame(applyHoopRankAvatarCustomization);
    }
    return;
  }

  status.missingMaterials = [];
  status.missingNodes = [];
  status.missingMorphTargets = [];
  status.appliedMaterialCount = 0;
  status.appliedNodeCount = 0;
  status.appliedMorphCount = 0;

  const customization = hoopRankAvatarCustomization || {};
  const materialColors = customization.materials || {};
  for (const [materialName, color] of Object.entries(materialColors)) {
    const material = hoopRankMaterialByName(hoopRankAvatarModel, materialName);
    if (!material) {
      status.missingMaterials.push(materialName);
      continue;
    }
    if (hoopRankSetMaterialColor(material, color, 1)) {
      status.appliedMaterialCount += 1;
    }
  }

  const materialVisibility = customization.materialVisibility || {};
  for (const group of Object.values(materialVisibility)) {
    const slots = group && Array.isArray(group.slots) ? group.slots : [];
    const selected = group ? group.selected : null;
    for (const materialName of slots) {
      const material = hoopRankMaterialByName(hoopRankAvatarModel, materialName);
      const selectedMaterial = selected &&
        hoopRankRigNamesMatch(materialName, selected);
      if (!material) {
        status.missingMaterials.push(materialName);
        continue;
      }
      if (materialColors.avatar_hair && selectedMaterial) {
        hoopRankSetMaterialColor(material, materialColors.avatar_hair, 1);
      }
      if (hoopRankApplyMaterialVisibility(material, Boolean(selectedMaterial))) {
        status.appliedMaterialCount += 1;
      }
    }
  }

  const sceneRoot = hoopRankSceneRoot(hoopRankAvatarModel);
  const nodeVisibility = customization.nodeVisibility || {};
  for (const group of Object.values(nodeVisibility)) {
    const nodes = group && Array.isArray(group.nodes) ? group.nodes : [];
    const selected = group ? group.selected : null;
    for (const nodeName of nodes) {
      const selectedNode = selected && hoopRankRigNamesMatch(nodeName, selected);
      if (hoopRankSetNodeVisible(sceneRoot, nodeName, Boolean(selectedNode))) {
        status.appliedNodeCount += 1;
      } else {
        status.missingNodes.push(nodeName);
      }
    }
  }

  hoopRankApplyMorphTargets(sceneRoot, customization.morphTargets || {}, status);
  hoopRankApplyAnimation(hoopRankAvatarModel, customization.animationName);
  if (hoopRankModelScale) {
    hoopRankAvatarModel.setAttribute('scale', hoopRankModelScale);
  }
  status.applied = true;
}

window.addEventListener('load', applyHoopRankAvatarCustomization);
const hoopRankAvatarModelElement = document.querySelector(hoopRankModelViewerSelector);
if (hoopRankAvatarModelElement) {
  hoopRankAvatarModelElement.addEventListener('load', applyHoopRankAvatarCustomization);
  hoopRankAvatarModelElement.addEventListener(
    'model-visibility',
    applyHoopRankAvatarCustomization
  );
}
requestAnimationFrame(applyHoopRankAvatarCustomization);
''';
}
