var progress = document.getElementById('file-progress-bar');
var $progress = $('.progress');

var cadview = document.querySelector('#cad-view');
cadview.addEventListener('mousemove', handleMouseMove);
var cadCanvas;

// Setup the dnd listeners.
var dropZone = $('.drop-zone');
dropZone.on('dragover', handleDragOver, false);
dropZone.on('drop', onFileSelected, false);

document.getElementById('dxf').addEventListener('change', onFileSelected, false);

const fields = {
  pickedObjects: [],
  makerObjects: []
}


function onFileSelected(evt) {
  progress.style.width = '0%';
  progress.textContent = '0%';

  var file = evt.target.files[0];
  var output = [];
  output.push('<li><strong>', encodeURI(file.name), '</strong> (', file.type || 'n/a', ') - ',
    file.size, ' bytes, last modified: ',
    file.lastModifiedDate ? file.lastModifiedDate.toLocaleDateString() : 'n/a',
    '</li>');
  document.getElementById('file-description').innerHTML = '<ul>' + output.join('') + '</ul>';

  $progress.addClass('loading');

  var reader = new FileReader();
  reader.onprogress = updateProgress;
  reader.onloadend = onSuccess;
  reader.onabort = abortUpload;
  reader.onerror = errorHandler;
  reader.readAsText(file);
}

function abortUpload() {
  console.log('Aborted read!')
}

function errorHandler(evt) {
  switch(evt.target.error.code) {
  case evt.target.error.NOT_FOUND_ERR:
    alert('File Not Found!');
    break;
  case evt.target.error.NOT_READABLE_ERR:
    alert('File is not readable');
    break;
  case evt.target.error.ABORT_ERR:
    break; // noop
  default:
    alert('An error occurred reading this file.');
  }
}

function updateProgress(evt) {
  console.log('progress');
  console.log(Math.round((evt.loaded /evt.total) * 100));
  if(evt.lengthComputable) {
    var percentLoaded = Math.round((evt.loaded /evt.total) * 100);
    if (percentLoaded < 100) {
      progress.style.width = percentLoaded + '%';
      progress.textContent = percentLoaded + '%';
    }
  }
}

function onSuccess(evt){
  var fileReader = evt.target;
  if(fileReader.error) return console.log("error onloadend!?");
  progress.style.width = '100%';
  progress.textContent = '100%';
  setTimeout(function() { $progress.removeClass('loading'); }, 2000);
  var parser = new window.DxfParser();
  var dxf = parser.parseSync(fileReader.result);
  
  // Three.js changed the way fonts are loaded, and now we need to use FontLoader to load a font
  //  and enable TextGeometry. See this example http://threejs.org/examples/?q=text#webgl_geometry_text
  //  and this discussion https://github.com/mrdoob/three.js/issues/7398 
  var font;
  var loader = new THREE.FontLoader();
  loader.load( 'fonts/helvetiker_regular.typeface.json', function ( response ) {
    font = response;
    cadCanvas = new ThreeDxf.Viewer(dxf, document.getElementById('cad-view'), 400, 400, font);
  });
  
}

function handleDragOver(evt) {
  evt.stopPropagation();
  evt.preventDefault();
  evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
}

function handleMouseMove(e) {

  const camera = cadCanvas.camera;
  const scene = cadCanvas.scene;
  const rect = e.target.getBoundingClientRect();

  // スクリーン上のマウス位置を取得する
  let mouseX = e.clientX - rect.left;
  let mouseY = e.clientY - rect.top;
  // 取得したスクリーン座標を-1〜1に正規化する（WebGLは-1〜1で座標が表現される）
  mouseX =  (mouseX/window.innerWidth)  * 2 - 1;
  mouseY = -(mouseY/window.innerHeight) * 2 + 1;
  const mouse = new THREE.Vector2();
  mouse.x = mouseX;
  mouse.y = mouseY;
  

  // マウスの位置ベクトル
  const pos = new THREE.Vector3(mouseX, mouseY, 1);

  // pos はスクリーン座標系なので、オブジェクトの座標系に変換
  // オブジェクト座標系は今表示しているカメラからの視点なので、第二引数にカメラオブジェクトを渡す
  // new THREE.Projector.unprojectVector(pos, camera); ↓最新版では以下の方法で得る
  pos.unproject(camera);

  // 始点、向きベクトルを渡してレイを作成
  const ray = new THREE.Raycaster();
  ray.setFromCamera( mouse, camera );
  // camera.position, pos.sub(camera.position).normalize()

  // 交差判定
  // 引数は取得対象となるMeshの配列を渡す。以下はシーン内のすべてのオブジェクトを対象に。
  // const objs = ray.intersectObjects(scene.children); 

  //ヒエラルキーを持った子要素も対象とする場合は第二引数にtrueを指定する
  const objs = ray.intersectObjects(scene.children, true);

  if (objs.length > 0) {
    if (fields.makerObjects.length > 0){
      fields.makerObjects.forEach((o) => {
        scene.remove(o);
      });
    }
    fields.pickedObjects = objs
    console.log(fields.pickedObjects)
    // 交差していたらobjsが1以上になるので、やりたいことをやる。
    fields.pickedObjects.forEach((o) => {
      const bb = ThreeDxf.Helpers.getCompoundBoundingBox(objs[0].object);
      const center = bb.center();
      // const geometry = new THREE.BoxGeometry(bb);
      const geometry = new THREE.PlaneGeometry(bb.max.x - bb.min.x, bb.max.y - bb.min.y, 1);
      const material = new THREE.MeshBasicMaterial({color: 0x00ff00, side: THREE.DoubleSide});
      const plane = new THREE.Mesh(geometry, material);
      plane.translateX(center.x);
      plane.translateY(center.y);
      scene.add(plane);
      fields.makerObjects.push(plane);
    })
    cadCanvas.render();
  }
}
