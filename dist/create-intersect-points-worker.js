import * as THREE from 'three'
import { create, all } from 'mathjs'
const math = create(all, {})

/**
 * @param {Object} point1 { x: xxx, y: yyy, z: zzz }
 * @param {Object} point2 { x: xxx, y: yyy, z: zzz }
 * @return array
 */
export function findCrossPoint(point1, point2, finieshLines) {
  const intersects = []
  var minxo = math.min(point1.x, point2.x)
  var minyo = math.min(point1.y, point2.y)
  var maxxo = math.max(point1.x, point2.x)
  var maxyo = math.max(point1.y, point2.y)

  var originCoefficienConst = getCoefficienConst(point1, point2)
  var ao = originCoefficienConst[0]
  var ko = originCoefficienConst[1]
  for (var c = 0; c < finieshLines.length; c++) {
    var minxt = math.min(finieshLines[c].start.x, finieshLines[c].end.x)
    var minyt = math.min(finieshLines[c].start.y, finieshLines[c].end.y)
    var maxxt = math.max(finieshLines[c].start.x, finieshLines[c].end.x)
    var maxyt = math.max(finieshLines[c].start.y, finieshLines[c].end.y)
    if (maxxt < minxo || maxxo < minxt || maxyt < minyo || maxyo < minyt) {
      continue
    }
    var targetCoefficienConst = getCoefficienConst(
      finieshLines[c].start,
      finieshLines[c].end
    )
    var at = targetCoefficienConst[0]
    var kt = targetCoefficienConst[1]
    var intersectX, intersectY
    if (at == null && kt == null) {
      continue
    } else if (ao == null && ko == null) {
      continue
    } else if (ko == null && kt == null) {
      continue
    } else if (ao == null && at == null) {
      continue
    } else if (ko == null && at == null) {
      intersectX = ao
      intersectY = kt
    } else if (ao == null && kt == null) {
      intersectX = at
      intersectY = ko
    } else if (ko == null) {
      intersectX = ao
      intersectY = at * ao + kt
    } else if (ao == null) {
      intersectY = ko
      intersectX = (ko - kt) / at
    } else if (kt == null) {
      intersectX = at
      intersectY = ao * at + ko
    } else if (at == null) {
      intersectY = kt
      intersectX = (kt - ko) / ao
    } else {
      try {
        var result = solveSimultaneousEquation(
          [
            [1, -1 * ao],
            [1, -1 * at]
          ],
          [ko, kt]
        )
        intersectX = result[1][0]
        intersectY = result[0][0]
      } catch (ex) {
        console.log(ex)
      }
    }
    if (
      math.max(minxo, minxt) <= intersectX &&
      intersectX <= math.min(maxxo, maxxt) &&
      math.max(minyo, minyt) <= intersectY &&
      intersectY <= math.min(maxyo, maxyt) &&
      !(intersectX == point1.x && intersectY == point1.y) &&
      !(intersectX == point2.x && intersectY == point2.y)
    ) {
      var geometry, material, point
      geometry = new THREE.Geometry()
      geometry.vertices.push(new THREE.Vector3(intersectX, intersectY, 0))
      material = new THREE.PointsMaterial({
        size: 0.05,
        vertexColors: THREE.VertexColors
      })
      point = new THREE.Points(geometry, material)
      intersects.push(point)
    }
  }
  return intersects
}

/**
 * @param {Array} formula [Array<Array<Float> >] 係数行列A: num x num 行列
 * @param {Array} results [Array<Float>] 右辺のベクトルb: num x 1 行列
 * @return Array
 */
function solveSimultaneousEquation(formula, results) {
  return math.lusolve(math.matrix(formula), math.matrix(results))._data
}

/**
 * @param {Object} point1 { x: xxx, y: yyy, z: zzz }
 * @param {Object} point2 { x: xxx, y: yyy, z: zzz }
 * @return array
 */
function getCoefficienConst(point1, point2) {
  if (point1.x == point2.x && point1.y == point2.y) {
    return [null, null]
  } else if (point1.x == point2.x) {
    return [point1.x, null]
  } else if (point1.y == point2.y) {
    return [null, point1.y]
  }

  var result = solveSimultaneousEquation(
    [
      [point1.x, 1],
      [point2.x, 1]
    ],
    [point1.y, point2.y]
  )
  return [result[0][0], result[1][0]]
}
