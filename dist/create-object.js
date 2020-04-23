import * as THREE from 'three'

/**
 * Viewer class for a dxf object.
 * @param {Object} entity
 * @param {Object} data
 * @return mesh
 */
export function drawEntity(entity, data, font) {
  let mesh
  let lineVecs = []
  if (entity.type === 'CIRCLE' || entity.type === 'ARC') {
    mesh = drawArc(entity, data)
  } else if (
    entity.type === 'LWPOLYLINE' ||
    entity.type === 'LINE' ||
    entity.type === 'POLYLINE'
  ) {
    const result = drawLine(entity, data)
    mesh = result.lines
    lineVecs = result.lineVecs
  } else if (entity.type === 'TEXT') {
    mesh = drawText(entity, data, font)
  } else if (entity.type === 'SOLID') {
    mesh = drawSolid(entity, data)
  } else if (entity.type === 'POINT') {
    mesh = drawPoint(entity, data)
  } else if (entity.type === 'INSERT') {
    const result = drawBlock(entity, data, font)
    mesh = result.group
    lineVecs = result.lineVecs
  } else if (entity.type === 'SPLINE') {
    mesh = drawSpline(entity, data)
  } else if (entity.type === 'MTEXT') {
    mesh = drawMtext(entity, data, font)
  } else if (entity.type === 'ELLIPSE') {
    mesh = drawEllipse(entity, data)
  } else if (entity.type === 'DIMENSION') {
    var dimTypeEnum = entity.dimensionType & 7
    if (dimTypeEnum === 0) {
      const result = drawDimension(entity, data, font)
      mesh = result.group
      lineVecs = result.lineVecs
    } else {
      console.log('Unsupported Dimension type: ' + dimTypeEnum)
    }
  } else {
    console.log('Unsupported Entity Type: ' + entity.type)
  }
  return { mesh: mesh, lineVecs: lineVecs }
}

/**
 * Viewer class for a dxf object.
 * @param {Object} entity
 * @param {Object} data
 */
function drawEllipse(entity, data) {
  var color = getColor(entity, data)

  var xrad = Math.sqrt(
    Math.pow(entity.majorAxisEndPoint.x, 2) +
      Math.pow(entity.majorAxisEndPoint.y, 2)
  )
  var yrad = xrad * entity.axisRatio
  var rotation = Math.atan2(
    entity.majorAxisEndPoint.y,
    entity.majorAxisEndPoint.x
  )

  var curve = new THREE.EllipseCurve(
    entity.center.x,
    entity.center.y,
    xrad,
    yrad,
    entity.startAngle,
    entity.endAngle,
    false, // Always counterclockwise
    rotation
  )

  var points = curve.getPoints(50)
  var geometry = new THREE.BufferGeometry().setFromPoints(points)
  var material = new THREE.LineBasicMaterial({ linewidth: 1, color: color })

  // Create the final object to add to the scene
  var ellipse = new THREE.Line(geometry, material)
  return ellipse
}

/**
 * Viewer class for a dxf object.
 * @param {Object} entity
 * @param {Object} data
 */
function drawMtext(entity, data, font) {
  try {
    var color = getColor(entity, data)
    var geometry = new THREE.TextBufferGeometry(entity.text, {
      font: font,
      size: entity.height * (4 / 5),
      height: 10
    })

    var material = new THREE.MeshBasicMaterial({ color: color })
    var text = new THREE.Mesh(geometry, material)

    // Measure what we rendered.
    var measure = new THREE.Box3()
    measure.setFromObject(text)

    var textWidth = measure.max.x - measure.min.x
    // If the text ends up being wider than the box, it's supposed
    // to be multiline. Doing that in threeJS is overkill.
    if (textWidth > entity.width) {
      console.log('Can\'t render this multipline MTEXT entity, sorry.', entity)
      return undefined
    }

    text.position.z = 0
    switch (entity.attachmentPoint) {
      case 1:
        // Top Left
        text.position.x = entity.position.x
        text.position.y = entity.position.y - entity.height
        break
      case 2:
        // Top Center
        text.position.x = entity.position.x - textWidth / 2
        text.position.y = entity.position.y - entity.height
        break
      case 3:
        // Top Right
        text.position.x = entity.position.x - textWidth
        text.position.y = entity.position.y - entity.height
        break

      case 4:
        // Middle Left
        text.position.x = entity.position.x
        text.position.y = entity.position.y - entity.height / 2
        break
      case 5:
        // Middle Center
        text.position.x = entity.position.x - textWidth / 2
        text.position.y = entity.position.y - entity.height / 2
        break
      case 6:
        // Middle Right
        text.position.x = entity.position.x - textWidth
        text.position.y = entity.position.y - entity.height / 2
        break

      case 7:
        // Bottom Left
        text.position.x = entity.position.x
        text.position.y = entity.position.y
        break
      case 8:
        // Bottom Center
        text.position.x = entity.position.x - textWidth / 2
        text.position.y = entity.position.y
        break
      case 9:
        // Bottom Right
        text.position.x = entity.position.x - textWidth
        text.position.y = entity.position.y
        break

      default:
        return undefined
    }
  } catch (ex) {
    console.log(ex);
    return null
  }

  return text
}

/**
 * Viewer class for a dxf object.
 * @param {Object} entity
 * @param {Object} data
 */
function drawSpline(entity, data) {
  var color = getColor(entity, data)

  var points = entity.controlPoints.map(function(vec) {
    return new THREE.Vector2(vec.x, vec.y)
  })

  var interpolatedPoints = []
  var curve
  if (entity.degreeOfSplineCurve === 2 || entity.degreeOfSplineCurve === 3) {
    for (var i = 0; i + 2 < points.length; i = i + 2) {
      if (entity.degreeOfSplineCurve === 2) {
        curve = new THREE.QuadraticBezierCurve(
          points[i],
          points[i + 1],
          points[i + 2]
        )
      } else {
        curve = new THREE.QuadraticBezierCurve3(
          points[i],
          points[i + 1],
          points[i + 2]
        )
      }
      interpolatedPoints.push.apply(interpolatedPoints, curve.getPoints(50))
    }
  } else {
    curve = new THREE.SplineCurve(points)
    interpolatedPoints = curve.getPoints(100)
  }

  var geometry = new THREE.BufferGeometry().setFromPoints(interpolatedPoints)
  var material = new THREE.LineBasicMaterial({ linewidth: 1, color: color })
  var splineObject = new THREE.Line(geometry, material)

  return splineObject
}

/**
 * Viewer class for a dxf object.
 * @param {Object} entity
 * @param {Object} data
 */
function drawLine(entity, data) {
  const lineVecs = []
  const geometry = new THREE.Geometry()
  const color = getColor(entity, data)
  let material
  let lineType

  // create geometry
  for (let i = 0; i < entity.vertices.length; i++) {
    if (entity.vertices[i].bulge) {
      const bulge = entity.vertices[i].bulge
      const startPoint = entity.vertices[i]
      const endPoint =
        i + 1 < entity.vertices.length
          ? entity.vertices[i + 1]
          : geometry.vertices[0]
      const bulgeGeometry = new THREEx.BulgeGeometry(startPoint, endPoint, bulge)
      geometry.vertices.push.apply(geometry.vertices, bulgeGeometry.vertices)
    } else {
      const vertex = entity.vertices[i]
      geometry.vertices.push(new THREE.Vector3(vertex.x, vertex.y, 0))
    }
  }

  if (entity.shape) geometry.vertices.push(geometry.vertices[0])

  // create intersectPoints
  for (let i = 1; i < geometry.vertices.length; i++) {
    lineVecs.push({
      start: geometry.vertices[i - 1],
      end: geometry.vertices[i]
    })
  }

  // set material
  if (entity.lineType && data.tables) {
    lineType = data.tables.lineType.lineTypes[entity.lineType]
  }

  if (lineType && lineType.pattern && lineType.pattern.length !== 0) {
    material = new THREE.LineDashedMaterial({
      color: color,
      gapSize: 4,
      dashSize: 4
    })
  } else {
    material = new THREE.LineBasicMaterial({
      linewidth: 1,
      color: color
    })
  }
  return { lines: new THREE.Line(geometry, material), lineVecs: lineVecs }
}

/**
 * Viewer class for a dxf object.
 * @param {Object} entity
 * @param {Object} data
 */
function drawArc(entity, data) {
  var startAngle, endAngle
  if (entity.type === 'CIRCLE') {
    startAngle = entity.startAngle || 0
    endAngle = startAngle + 2 * Math.PI
  } else {
    startAngle = entity.startAngle
    endAngle = entity.endAngle
  }

  var curve = new THREE.ArcCurve(0, 0, entity.radius, startAngle, endAngle)

  var points = curve.getPoints(32)
  var geometry = new THREE.BufferGeometry().setFromPoints(points)

  var material = new THREE.LineBasicMaterial({
    color: getColor(entity, data)
  })

  var arc = new THREE.Line(geometry, material)
  arc.position.x = entity.center.x
  arc.position.y = entity.center.y
  arc.position.z = entity.center.z

  return arc
}

/**
 * Viewer class for a dxf object.
 * @param {Object} entity
 * @param {Object} data
 */
function drawSolid(entity, data) {
  var material,
    mesh,
    verts,
    geometry = new THREE.Geometry()

  verts = geometry.vertices
  verts.push(
    new THREE.Vector3(
      entity.points[0].x,
      entity.points[0].y,
      entity.points[0].z
    )
  )
  verts.push(
    new THREE.Vector3(
      entity.points[1].x,
      entity.points[1].y,
      entity.points[1].z
    )
  )
  verts.push(
    new THREE.Vector3(
      entity.points[2].x,
      entity.points[2].y,
      entity.points[2].z
    )
  )
  verts.push(
    new THREE.Vector3(
      entity.points[3].x,
      entity.points[3].y,
      entity.points[3].z
    )
  )

  // Calculate which direction the points are facing (clockwise or counter-clockwise)
  var vector1 = new THREE.Vector3()
  var vector2 = new THREE.Vector3()
  vector1.subVectors(verts[1], verts[0])
  vector2.subVectors(verts[2], verts[0])
  vector1.cross(vector2)

  // If z < 0 then we must draw these in reverse order
  if (vector1.z < 0) {
    geometry.faces.push(new THREE.Face3(2, 1, 0))
    geometry.faces.push(new THREE.Face3(2, 3, 0))
  } else {
    geometry.faces.push(new THREE.Face3(0, 1, 2))
    geometry.faces.push(new THREE.Face3(0, 3, 2))
  }

  material = new THREE.MeshBasicMaterial({
    color: getColor(entity, data)
  })
  return new THREE.Mesh(geometry, material)
}

/**
 * Viewer class for a dxf object.
 * @param {Object} entity
 * @param {Object} data
 */
function drawText(entity, data, font) {
  var geometry, material, text
  if (!font)
    return console.warn(
      'Text is not supported without a Three.js font loaded with THREE.FontLoader! Load a font of your choice and pass this into the constructor. See the sample for this repository or Three.js examples at http://threejs.org/examples/?q=text#webgl_geometry_text for more details.'
    )
  geometry = new THREE.TextBufferGeometry(entity.text, {
    font: font,
    height: 0,
    size: entity.textHeight / 2 || 12
  })

  if (entity.rotation) {
    var zRotation = (entity.rotation * Math.PI) / 180
    geometry.rotateZ(zRotation)
  }

  material = new THREE.MeshBasicMaterial({
    color: getColor(entity, data)
  })

  text = new THREE.Mesh(geometry, material)
  text.position.x = entity.startPoint.x
  text.position.y = entity.startPoint.y
  text.position.z = entity.startPoint.z

  return text
}

/**
 * Viewer class for a dxf object.
 * @param {Object} entity
 * @param {Object} data
 */
function drawPoint(entity, data) {
  var geometry, material, point
  geometry = new THREE.Geometry()
  geometry.vertices.push(
    new THREE.Vector3(entity.position.x, entity.position.y, entity.position.z)
  )
  var numPoints = 1
  var color = getColor(entity, data)
  var colors = new Float32Array(numPoints * 3)
  colors[0] = color.r
  colors[1] = color.g
  colors[2] = color.b
  geometry.colors = colors
  geometry.computeBoundingBox()
  material = new THREE.PointsMaterial({
    size: 0.05,
    vertexColors: THREE.VertexColors
  })
  point = new THREE.Points(geometry, material)

  return point
}

/**
 * Viewer class for a dxf object.
 * @param {Object} entity
 * @param {Object} data
 */
function drawDimension(entity, data, font) {
  const block = data.blocks[entity.block]
  let lineVecs = []
  if (!block || !block.entities) return { group: null, lineVecs: lineVecs }

  const group = new THREE.Object3D()
  // if(entity.anchorPoint) {
  //     group.position.x = entity.anchorPoint.x;
  //     group.position.y = entity.anchorPoint.y;
  //     group.position.z = entity.anchorPoint.z;
  // }

  for (let i = 0; i < block.entities.length; i++) {
    const result = drawEntity(block.entities[i], data, font)
    const childEntity = result.mesh
    lineVecs = result.lineVecs

    if (childEntity) group.add(childEntity)
  }

  return { group: group, lineVecs: lineVecs }
}

/**
 * Viewer class for a dxf object.
 * @param {Object} entity
 * @param {Object} data
 */
function drawBlock(entity, data, font) {
  const block = data.blocks[entity.name]
  const group = new THREE.Object3D()
  let lineVecs = []
  if (entity.xScale) group.scale.x = entity.xScale
  if (entity.yScale) group.scale.y = entity.yScale
  if (entity.rotation) {
    group.rotation.z = (entity.rotation * Math.PI) / 180
  }
  if (entity.position) {
    group.position.x = entity.position.x
    group.position.y = entity.position.y
    group.position.z = entity.position.z
  }
  group.position.z = 0 //FIX:zがundefinedにならないように
  if (!block.entities) return group
  for (var i = 0; i < block.entities.length; i++) {
    const result = drawEntity(block.entities[i], data, font)
    const childEntity = result.mesh
    lineVecs = result.lineVecs

    if (childEntity) group.add(childEntity)
  }
  return { group: group, lineVecs: lineVecs }
}


/**
 * Viewer class for a dxf object.
 * @param {Object} entity
 * @param {Object} data
 */
function getColor(entity, data) {
  var color = 0x000000 //default
  if (entity.color) {
    color = entity.color
  } else if (
    data.tables &&
    data.tables.layer &&
    data.tables.layer.layers[entity.layer]
  ) {
    color = data.tables.layer.layers[entity.layer].color
  }
  if (color == null || color === 0xffffff) {
    color = 0x000000
  }
  return color
}
