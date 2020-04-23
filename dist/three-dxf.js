import * as THREE from 'three'
import { OrbitControls } from 'three-dxf/dist/orbit-controls';
import { findCrossPoint } from 'three-dxf/dist/create-intersect-points-worker';
import { drawEntity } from 'three-dxf/dist/create-object';

/**
 * DEFAULT OPTION for Viewer fucntion
 */
const DEFAULT_OPT = { width: null, height: null, font: null, pan: true, rotate: true, zoom: true }

/**
 * Viewer class for a dxf object.
 * @param {Object} data - the dxf object
 * @param {Object} parent - the parent element to which we attach the rendering canvas
 * @param {Object} opt - options for three.js
 * @param {Object} cEvents - additional events for three.js viewer
 * @constructor
 */
export async function Viewer(data, parent, opt = DEFAULT_OPT, cEvents = {}) {
  data = createLineTypeShaders(data)
  const scene = new THREE.Scene()
  const width = opt['width'] || parent.clientWidth
  const height = opt['height'] || parent.clientHeight
  const font = opt['font']
  const aspectRatio = width / height

  // Create scene from dxf object (data)
  const result = await createObjects(data, font)
  const objs = result.objs

  // Create Intersct Point
  const intersects = await createIntersectPoints(result.lineVecs)

  // Add Object to scene
  for(const obj of objs) {
    scene.add(obj)
  }
  // get drawing scope
  const dims = createViewScope(objs)
  const upperRightCorner = { x: dims.max.x, y: dims.max.y }
  const lowerLeftCorner = { x: dims.min.x, y: dims.min.y }

  // Figure out the current viewport extents
  let vp_width = upperRightCorner.x - lowerLeftCorner.x
  let vp_height = upperRightCorner.y - lowerLeftCorner.y
  const center = {
    x: vp_width / 2 + lowerLeftCorner.x,
    y: vp_height / 2 + lowerLeftCorner.y
  }

  // Fit all objects into current ThreeDXF viewer
  const extentsAspectRatio = Math.abs(vp_width / vp_height)
  if (aspectRatio > extentsAspectRatio) {
    vp_width = vp_height * aspectRatio
  } else {
    vp_height = vp_width / aspectRatio
  }

  const viewPort = {
    bottom: -vp_height / 2,
    left: -vp_width / 2,
    top: vp_height / 2,
    right: vp_width / 2,
    center: {
      x: center.x,
      y: center.y
    }
  }

  // var viewPort = Helpers.getCameraParametersFromScene(aspectRatio, scene)
  const camera = new THREE.OrthographicCamera(
    viewPort.left,
    viewPort.right,
    viewPort.top,
    viewPort.bottom,
    1,
    1000
  )
  camera.position.z = 10
  camera.position.x = viewPort.center.x
  camera.position.y = viewPort.center.y

  const renderer = new THREE.WebGLRenderer()
  renderer.setSize(width, height)
  renderer.setClearColor(0xfffffff, 1)

  parent.append(renderer.domElement)
  parent.style.display = 'block'

  var controls = new OrbitControls(camera, parent)
  controls.enablePan = opt['pan'] == null ? true : opt['pan']
  controls.screenSpacePanning = opt['pan'] == null ? true : opt['pan']
  controls.enableZoom = opt['zoom'] == null ? true : opt['zoom']
  controls.enableRotate = opt['rotate'] == null ? true : opt['rotate']
  controls.target.x = camera.position.x
  controls.target.y = camera.position.y
  controls.target.z = 0
  controls.zoomSpeed = 3

  //Uncomment this to disable rotation (does not make much sense with 2D drawings).
  //controls.enableRotate = false;

  this.render = function() {
    renderer.render(scene, camera)
  }

  controls.addEventListener('change', this.render)

  for (let k in cEvents) {
    parent.addEventListener(k, cEvents[k])
  }

  this.render()
  controls.update()

  const raycaster = new THREE.Raycaster()

  this.resize = function(width, height) {
    const originalWidth = renderer.domElement.width
    const originalHeight = renderer.domElement.height

    const hscale = width / originalWidth
    const vscale = height / originalHeight

    camera.top = vscale * camera.top
    camera.bottom = vscale * camera.bottom
    camera.left = hscale * camera.left
    camera.right = hscale * camera.right

    // camera.updateProjectionMatrix();

    renderer.setSize(width, height)
    renderer.setClearColor(0xfffffff, 1)
    this.render()
  }

  return {
    canvas: parent,
    raycaster: raycaster,
    scene: scene,
    renderer: renderer,
    camera: camera,
    controls: controls,
    objs: objs,
    intersects: intersects,
    three: THREE
  }
}

async function createObject(index, data, font) {
  return new Promise((resolve) => {
    resolve(drawEntity(data.entities[index], data, font))
  });
}

async function createObjects(data, font) {
  const objs = []
  let lineVecs = []

  const INIT = 0;
  const MAX = data.entities.length;
  const CONCURRENCY = 10; // 同時実行できる数を定義

  const generator = (function* createGenerator() {
    for (let index = INIT; index < MAX; index++) {
        yield async () => await createObject(index, data, font);
    }
  })();

  const results = await asynccParallel(generator, CONCURRENCY);
  for(const items of results) {
    for(const item of items) {
      const obj = item.mesh
      if (!obj) continue;

      objs.push(obj)
      lineVecs = lineVecs.concat(item.lineVecs)
    }
  }

  return { objs: objs, lineVecs: lineVecs }
}

async function asynccParallel(iterable, concurrency) {
  const iterator = iterable[Symbol.iterator]();
  const promises = Array.from({ length: concurrency }, (_, id) => {
      return new Promise(async (resolve) => {
          const vals = []
          for (
              let result = iterator.next();
              !result.done;
              result = iterator.next()
          ) {
              const val = await result.value();
              vals.push(val)
          }
          resolve(vals);
      });
  });
  return await Promise.all(promises);
}

async function createIntersectPoint(start, end, finieshLines) {
  return new Promise((resolve) => {
    resolve(findCrossPoint(start, end, finieshLines))
  });
}

/**
 * @param {Object} lineVecs
 * @return Array
 */
async function createIntersectPoints(lines) {
  let intersects = []

  const INIT = 0;
  const MAX = lines.length;
  const CONCURRENCY = 10; // 同時実行できる数を定義

  const generator = (function* createGenerator() {
    for (let index = INIT; index < MAX; index++) {
      const line = lines[index]
      const finieshLines = lines.slice(0, index)
      yield async () => await createIntersectPoint(line.start, line.end, finieshLines);
    }
  })();

  const results = await asynccParallel(generator, CONCURRENCY);
  for(const items of results) {
    for(const item of items) {
      intersects = intersects.concat(item)
    }
  }

  return intersects
}

/**
 * @param {Object} lineVecs
 * @return Array
 */
// function reformLines(lineVecs) {
//   const reformedLineVecs = []
//   for(let i = 0; i < lineVecs.length; i ++) {
//     reformedLineVecs.push({
//       index: i,
//       lineVec: lineVecs[i]
//     })
//   }
//   return reformedLineVecs
// }

/**
 * @param {Object} objs
 * @return Array
 */
function createViewScope(objs) {
  var dims = {
    min: { x: false, y: false, z: false },
    max: { x: false, y: false, z: false }
  }

  for (const obj of objs) {
    var bbox = new THREE.Box3().setFromObject(obj)
    if (bbox.min.x && (dims.min.x === false || dims.min.x > bbox.min.x))
      dims.min.x = bbox.min.x
    if (bbox.min.y && (dims.min.y === false || dims.min.y > bbox.min.y))
      dims.min.y = bbox.min.y
    if (bbox.min.z && (dims.min.z === false || dims.min.z > bbox.min.z))
      dims.min.z = bbox.min.z
    if (bbox.max.x && (dims.max.x === false || dims.max.x < bbox.max.x))
      dims.max.x = bbox.max.x
    if (bbox.max.y && (dims.max.y === false || dims.max.y < bbox.max.y))
      dims.max.y = bbox.max.y
    if (bbox.max.z && (dims.max.z === false || dims.max.z < bbox.max.z))
      dims.max.z = bbox.max.z
  }
  return dims
}

/**
 * createLineTypeShaders
 * @param {Object} data
 * @return data
 */
function createLineTypeShaders(data) {
  if (!data.tables || !data.tables.lineType) return

  const ltypes = data.tables.lineType.lineTypes
  for (const type in ltypes) {
    const ltype = ltypes[type]
    if (!ltype.pattern) continue

    data.tables.lineType.lineTypes[type].material = createDashedLineShader(ltype.pattern)
  }
  return data
}

/**
 * Viewer class for a dxf object.
 * @param {Object} entity
 * @param {Object} data
 */
function createDashedLineShader(pattern) {
  var i,
    dashedLineShader = {},
    totalLength = 0.0
  for (i = 0; i < pattern.length; i++) {
    totalLength += Math.abs(pattern[i])
  }
  dashedLineShader.uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib['common'],
    THREE.UniformsLib['fog'],
    {
      pattern: {
        type: 'fv1',
        value: pattern
      },
      patternLength: {
        type: 'f',
        value: totalLength
      }
    }
  ])
  dashedLineShader.vertexShader = [
    'attribute float lineDistance;',
    'varying float vLineDistance;',
    THREE.ShaderChunk['color_pars_vertex'],
    'void main() {',
    THREE.ShaderChunk['color_vertex'],
    'vLineDistance = lineDistance;',
    'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
    '}'
  ].join('\n')
  dashedLineShader.fragmentShader = [
    'uniform vec3 diffuse;',
    'uniform float opacity;',
    'uniform float pattern[' + pattern.length + '];',
    'uniform float patternLength;',
    'varying float vLineDistance;',
    THREE.ShaderChunk['color_pars_fragment'],
    THREE.ShaderChunk['fog_pars_fragment'],
    'void main() {',
    'float pos = mod(vLineDistance, patternLength);',
    'for ( int i = 0; i < ' + pattern.length + '; i++ ) {',
    'pos = pos - abs(pattern[i]);',
    'if( pos < 0.0 ) {',
    'if( pattern[i] > 0.0 ) {',
    'gl_FragColor = vec4(1.0, 0.0, 0.0, opacity );',
    'break;',
    '}',
    'discard;',
    '}',
    '}',
    THREE.ShaderChunk['color_fragment'],
    THREE.ShaderChunk['fog_fragment'],
    '}'
  ].join('\n')
  return dashedLineShader
}

/**
 * @param {Object} scene
 */
function findExtents(scene) {
  for (var child of scene.children) {
    var minX, maxX, minY, maxY
    if (child.position) {
      minX = Math.min(child.position.x, minX)
      minY = Math.min(child.position.y, minY)
      maxX = Math.max(child.position.x, maxX)
      maxY = Math.max(child.position.y, maxY)
    }
  }

  return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } }
}


// Show/Hide helpers from https://plainjs.com/javascript/effects/hide-or-show-an-element-42/
// get the default display style of an element
function defaultDisplay(tag) {
  var iframe = document.createElement('iframe')
  iframe.setAttribute('frameborder', 0)
  iframe.setAttribute('width', 0)
  iframe.setAttribute('height', 0)
  document.documentElement.appendChild(iframe)

  var doc = (iframe.contentWindow || iframe.contentDocument).document

  // IE support
  doc.write()
  doc.close()

  var testEl = doc.createElement(tag)
  doc.documentElement.appendChild(testEl)
  var display = (window.getComputedStyle
    ? getComputedStyle(testEl, null)
    : testEl.currentStyle
  ).display
  iframe.parentNode.removeChild(iframe)
  return display
}

// actual show/hide function used by show() and hide() below
function showHide(el, show) {
  var value = el.getAttribute('data-olddisplay'),
    display = el.style.display,
    computedDisplay = (window.getComputedStyle
      ? getComputedStyle(el, null)
      : el.currentStyle
    ).display

  if (show) {
    if (!value && display === 'none') el.style.display = ''
    if (el.style.display === '' && computedDisplay === 'none')
      value = value || defaultDisplay(el.nodeName)
  } else {
    if ((display && display !== 'none') || !(computedDisplay == 'none'))
      el.setAttribute(
        'data-olddisplay',
        computedDisplay == 'none' ? display : computedDisplay
      )
  }
  if (!show || el.style.display === 'none' || el.style.display === '')
    el.style.display = show ? value || '' : 'none'
}

// helper functions
function show(el) {
  showHide(el, true)
}
function hide(el) {
  showHide(el)
}
