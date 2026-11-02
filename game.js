(function(){
"use strict";

/* ============ EDIT ME: game settings ============ */
var CONFIG = {
  cells: 20,        // board size (cells x cells)
  startSpeed: 140,  // ms per move (lower = faster)
  minSpeed: 60,     // fastest allowed
  speedStep: 12,    // how much faster each level
  levelEvery: 5,    // gems needed per level
  plateSeed: 7      // change this number for a different baseplate pattern
};
/* ================================================= */

var N = CONFIG.cells, OFF = (N - 1) / 2;
var COLORS = [0x00d4ff, 0xffd400, 0xb15cff, 0x3ddc5a, 0xff4d4d, 0x3d6bff, 0xff9a1f]; // I O T S Z J L
var SHAPES = [
  [[0,0],[1,0],[2,0],[3,0]], [[0,0],[1,0],[0,1],[1,1]], [[0,0],[1,0],[2,0],[1,1]],
  [[1,0],[2,0],[0,1],[1,1]], [[0,0],[1,0],[1,1],[2,1]], [[0,0],[0,1],[1,1],[2,1]], [[2,0],[0,1],[1,1],[2,1]]
];
var WHITE = new THREE.Color(1,1,1);

var view = document.getElementById('view');
if (typeof THREE === 'undefined') { view.innerHTML = '<div class="err">3D engine failed to load. Check your connection and reload.</div>'; return; }
var renderer;
try { renderer = new THREE.WebGLRenderer({antialias:true}); }
catch (e) { view.innerHTML = '<div class="err">WebGL is not available in this browser.</div>'; return; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
view.appendChild(renderer.domElement);

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
var camZoom = 1, shake = 0, pop = 0;

/* ---------- Sky ---------- */
scene.add(new THREE.Mesh(
  new THREE.SphereGeometry(90, 16, 12),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top:{value:new THREE.Color(0x2f86e6)}, bot:{value:new THREE.Color(0xd6f0ff)} },
    vertexShader: 'varying float h;void main(){h=normalize(position).y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform vec3 top;uniform vec3 bot;varying float h;void main(){gl_FragColor=vec4(mix(bot,top,smoothstep(-.05,.6,h)),1.);}'
  })
));
var clouds = [];
var cloudMat = new THREE.MeshLambertMaterial({color:0xffffff});
for (var c = 0; c < 8; c++) {
  var g = new THREE.Group();
  for (var j = 0; j < 4; j++) {
    var s = new THREE.Mesh(new THREE.SphereGeometry(1.4 + Math.random()*1.2, 10, 8), cloudMat);
    s.position.set(j*1.6 - 2.4, Math.random()*.6, Math.random()*1.2);
    s.scale.y = .7; g.add(s);
  }
  g.position.set(-40 + c*11, 14 + Math.random()*8, -18 - Math.random()*26);
  g.userData.v = .4 + Math.random()*.5;
  scene.add(g); clouds.push(g);
}

/* ---------- Lights ---------- */
scene.add(new THREE.HemisphereLight(0xcfeaff, 0x6a7fa8, 0.95));
var sun = new THREE.DirectionalLight(0xfff3d6, 1.1);
sun.position.set(8, 18, 6); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
var sc = sun.shadow.camera; sc.left = -14; sc.right = 14; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 50;
scene.add(sun);

/* ---------- Tetris baseplate ---------- */
function buildPlate() {
  var seed = CONFIG.plateSeed;
  function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  var grid = []; for (var y = 0; y < N; y++) { grid.push([]); for (var x = 0; x < N; x++) grid[y].push(-1); }
  for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
    if (grid[y][x] >= 0) continue;
    var placed = false;
    for (var t = 0; t < 12 && !placed; t++) {
      var idx = Math.floor(rnd() * 7), cells = SHAPES[idx], r = Math.floor(rnd() * 4);
      for (var i = 0; i < r; i++) cells = cells.map(function(p){ return [-p[1], p[0]]; });
      for (var k = 0; k < 4 && !placed; k++) {
        var ox = x - cells[k][0], oy = y - cells[k][1], ok = true;
        for (var q = 0; q < 4; q++) {
          var cx = ox + cells[q][0], cy = oy + cells[q][1];
          if (cx < 0 || cy < 0 || cx >= N || cy >= N || grid[cy][cx] >= 0) { ok = false; break; }
        }
        if (ok) { for (q = 0; q < 4; q++) grid[oy + cells[q][1]][ox + cells[q][0]] = idx; placed = true; }
      }
    }
    if (!placed) grid[y][x] = Math.floor(rnd() * 7);
  }
  var tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(.96, .4, .96), new THREE.MeshStandardMaterial({roughness:.5}), N*N);
  var studs = new THREE.InstancedMesh(new THREE.CylinderGeometry(.27, .27, .14, 14), new THREE.MeshStandardMaterial({roughness:.4}), N*N);
  tiles.receiveShadow = studs.receiveShadow = true; studs.castShadow = true;
  var m4 = new THREE.Matrix4(), col = new THREE.Color(), n = 0;
  for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
    col.setHex(COLORS[grid[y][x]]).lerp(WHITE, .12);
    tiles.setMatrixAt(n, m4.makeTranslation(x - OFF, -.2, y - OFF)); tiles.setColorAt(n, col);
    col.lerp(WHITE, .25);
    studs.setMatrixAt(n, m4.makeTranslation(x - OFF, .07, y - OFF)); studs.setColorAt(n, col);
    n++;
  }
  scene.add(tiles, studs);
  var slab = new THREE.Mesh(new THREE.BoxGeometry(N + .8, .9, N + .8), new THREE.MeshStandardMaterial({color:0x2b3a67, roughness:.7}));
  slab.position.y = -.85; slab.receiveShadow = true; scene.add(slab);
  var wm = new THREE.MeshStandardMaterial({color:0xeaf4ff, roughness:.4}), h = N/2 + .15;
  [[0,-h,N+.6,.5,.3],[0,h,N+.6,.5,.3],[-h,0,.3,.5,N],[h,0,.3,.5,N]].forEach(function(w){
    var m = new THREE.Mesh(new THREE.BoxGeometry(w[2], w[3], w[4]), wm);
    m.position.set(w[0], .22, w[1]); m.castShadow = true; m.receiveShadow = true; scene.add(m);
  });
}
buildPlate();

/* ---------- Snake + food meshes ---------- */
var segGeo = new THREE.BoxGeometry(.88, .88, .88), eyeGeo = new THREE.BoxGeometry(.15, .15, .1), eyeMat = new THREE.MeshBasicMaterial({color:0x111111});
var meshes = [], headAng = 0;
function W(c, y) { return new THREE.Vector3(c.x - OFF, y, c.y - OFF); }
function mkSeg(i) {
  var col = i === 0 ? new THREE.Color(0xffffff) : new THREE.Color(COLORS[(i - 1) % 7]).lerp(WHITE, .1);
  var m = new THREE.Mesh(segGeo, new THREE.MeshStandardMaterial({color: col, roughness:.35}));
  m.castShadow = true;
  if (i === 0) [-1, 1].forEach(function(s){ var e = new THREE.Mesh(eyeGeo, eyeMat); e.position.set(s * .22, .14, .45); m.add(e); });
  return m;
}
function syncMeshes(snap) {
  while (meshes.length < snake.length) {
    var m = mkSeg(meshes.length);
    m.position.copy(meshes.length ? meshes[meshes.length - 1].position : W(snake[0], .64));
    scene.add(m); meshes.push(m);
  }
  while (meshes.length > snake.length) scene.remove(meshes.pop());
  for (var i = 0; i < snake.length; i++) {
    meshes[i].userData.t = W(snake[i], .64);
    if (snap) meshes[i].position.copy(meshes[i].userData.t);
  }
  headAng = Math.atan2(dir.x, dir.y);
  if (snap) meshes[0].rotation.y = headAng;
}
function clearMeshes() { meshes.forEach(function(m){ scene.remove(m); }); meshes = []; }

var food = new THREE.Mesh(new THREE.OctahedronGeometry(.44), new THREE.MeshStandardMaterial({color:0xffc400, emissive:0xff9a00, emissiveIntensity:.5, roughness:.2, metalness:.3}));
food.castShadow = true; scene.add(food);

/* ---------- Render loop ---------- */
function resize() {
  var w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  var a = w / h; camera.aspect = a;
  camZoom = a < 1 ? 1 + (1 / a - 1) * .55 : 1;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
camera.position.set(0, 16, 13); resize();

var last = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  var dt = Math.min((now - last) / 1000, .05); last = now;
  var k = Math.min(1, dt * 16);
  meshes.forEach(function(m){ if (m.userData.t) m.position.lerp(m.userData.t, k); });
  var hd = meshes[0], hp = hd ? hd.position : new THREE.Vector3();
  if (hd) {
    var d = ((headAng - hd.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    hd.rotation.y += d * k;
    pop = Math.max(0, pop - dt * 4); hd.scale.setScalar(1.06 + pop * .3);
  }
  food.rotation.y += dt * 2; food.rotation.x += dt * .7;
  food.position.y = .85 + Math.sin(now / 300) * .12;
  clouds.forEach(function(c){ c.position.x += c.userData.v * dt; if (c.position.x > 50) c.position.x = -50; });
  var f = Math.min(1, dt * 3);
  camera.position.x += (hp.x * .35 - camera.position.x) * f;
  camera.position.y += (16 * camZoom - camera.position.y) * f;
  camera.position.z += (13 * camZoom + hp.z * .3 - camera.position.z) * f;
  if (shake > 0) { camera.position.x += (Math.random() - .5) * shake; camera.position.y += (Math.random() - .5) * shake; shake = Math.max(0, shake - dt * 1.6); }
  camera.lookAt(hp.x * .5, 0, hp.z * .5);
  renderer.render(scene, camera);
}

/* ---------- Game logic ---------- */
var snake, dir = {x:1,y:0}, nextDir, foodCell, score = 0, best = 0, speedMs, timer, level, running = false, paused = false;
var $ = function(id){ return document.getElementById(id); };
var scoreEl = $('score'), bestEl = $('best'), levelEl = $('level');
var startO = $('start-overlay'), overO = $('over-overlay'), pauseO = $('pause-overlay');

function reset() {
  var cx = Math.floor(N / 2), cy = Math.floor(N / 2);
  snake = [{x:cx,y:cy},{x:cx-1,y:cy},{x:cx-2,y:cy}];
  dir = {x:1,y:0}; nextDir = {x:1,y:0};
  score = 0; level = 1; speedMs = CONFIG.startSpeed; paused = false;
  scoreEl.textContent = 0; levelEl.textContent = 1;
  placeFood(); clearMeshes(); syncMeshes(true);
}
function placeFood() {
  var ok = false;
  while (!ok) {
    foodCell = {x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N)};
    ok = !snake.some(function(s){ return s.x === foodCell.x && s.y === foodCell.y; });
  }
  var p = W(foodCell, .85); food.position.set(p.x, p.y, p.z);
}
function tick() {
  if (paused) return;
  dir = nextDir;
  var head = {x: snake[0].x + dir.x, y: snake[0].y + dir.y};
  if (head.x < 0 || head.y < 0 || head.x >= N || head.y >= N || snake.some(function(s){ return s.x === head.x && s.y === head.y; })) { gameOver(); return; }
  snake.unshift(head);
  if (head.x === foodCell.x && head.y === foodCell.y) {
    score++; scoreEl.textContent = score; pop = 1;
    if (score % CONFIG.levelEvery === 0) { level++; levelEl.textContent = level; speedMs = Math.max(CONFIG.minSpeed, speedMs - CONFIG.speedStep); restartTimer(); }
    placeFood();
  } else snake.pop();
  syncMeshes(false);
}
function restartTimer() { clearInterval(timer); timer = setInterval(tick, speedMs); }
function gameOver() {
  running = false; clearInterval(timer); shake = .7;
  meshes.forEach(function(m){ m.material.color.setHex(0x8d99ae); });
  if (score > best) { best = score; bestEl.textContent = best; }
  $('over-text').textContent = 'Score: ' + score;
  setTimeout(function(){ overO.classList.remove('hidden'); }, 450);
}
function startGame() {
  reset(); running = true;
  startO.classList.add('hidden'); overO.classList.add('hidden'); pauseO.classList.add('hidden');
  restartTimer();
}
function togglePause() { if (!running) return; paused = !paused; pauseO.classList.toggle('hidden', !paused); }

/* ---------- Input ---------- */
var KEYS = {ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},w:{x:0,y:-1},s:{x:0,y:1},a:{x:-1,y:0},d:{x:1,y:0}};
var MAP = {up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}};
function setDir(d) { if (!running || paused) return; if (d.x === -dir.x && d.y === -dir.y) return; nextDir = d; }
window.addEventListener('keydown', function(e){
  if (e.key === 'p' || e.key === 'P') { togglePause(); return; }
  var d = KEYS[e.key]; if (d) { e.preventDefault(); setDir(d); }
});
$('start-btn').addEventListener('click', startGame);
$('retry-btn').addEventListener('click', startGame);
$('resume-btn').addEventListener('click', togglePause);

var dpad = $('dpad'), lastPress = 0;
function press(b) {
  var n = Date.now(); if (n - lastPress < 80) return; lastPress = n;
  if (b.dataset.action === 'pause') { togglePause(); return; }
  var d = MAP[b.dataset.dir]; if (d) setDir(d);
}
dpad.addEventListener('touchstart', function(e){ var b = e.target.closest('button'); if (!b) return; e.preventDefault(); press(b); }, {passive:false});
dpad.addEventListener('click', function(e){ var b = e.target.closest('button'); if (b) press(b); });

var ts = null;
view.addEventListener('touchstart', function(e){ var t = e.changedTouches[0]; ts = {x:t.clientX, y:t.clientY}; }, {passive:true});
view.addEventListener('touchmove', function(e){ e.preventDefault(); }, {passive:false});
view.addEventListener('touchend', function(e){
  if (!ts) return;
  var t = e.changedTouches[0], dx = t.clientX - ts.x, dy = t.clientY - ts.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) >= 18) {
    if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? {x:1,y:0} : {x:-1,y:0}); else setDir(dy > 0 ? {x:0,y:1} : {x:0,y:-1});
  }
  ts = null;
}, {passive:true});
document.addEventListener('gesturestart', function(e){ e.preventDefault(); });

reset();
requestAnimationFrame(animate);
})();
