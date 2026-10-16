import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const ZOOM = 14;
const RADIUS_M = 3500;
const EYE = 1.7;

function tileXY(lng, lat, z) {
  const n = 2 ** z;
  const x = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

function loadImg(url) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('img fail'));
    img.src = url;
  });
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function WalkMap({ lands = [], selectedId, onSelect, center = [39.59, 46.59], onClose }) {
  const mountRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [locked, setLocked] = useState(false);
  const [picked, setPicked] = useState(null);
  const stateRef = useRef({});
  const joyRef = useRef({ active: false, id: null, sx: 0, sy: 0, dx: 0, dy: 0 });
  const lookRef = useRef({ id: null, lx: 0, ly: 0 });
  const readyRef = useRef(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let disposed = false;
    let raf = 0;
    let cleanupFns = [];

    // center the walk area on the selected plot (fallback: prop / overall centroid)
    let centerLat = center[0];
    let centerLng = center[1];
    const selLand = lands.find((l) => l.id === selectedId) || lands[0];
    if (selLand) {
      const ring = (selLand.geometry?.coordinates || [])[0] || [];
      if (ring.length) {
        centerLat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
        centerLng = ring.reduce((s, p) => s + p[0], 0) / ring.length;
      }
    } else if (lands.length) {
      const all = lands.flatMap((l) => (l.geometry?.coordinates || [])[0] || []);
      if (all.length) {
        centerLat = all.reduce((s, p) => s + p[1], 0) / all.length;
        centerLng = all.reduce((s, p) => s + p[0], 0) / all.length;
      }
    }
    const halfLat = RADIUS_M / 111320;
    const halfLng = RADIUS_M / (111320 * Math.cos((centerLat * Math.PI) / 180));
    const size = RADIUS_M * 2;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9fc5e8);
    scene.fog = new THREE.Fog(0x9fc5e8, 800, 7000);

    const camera = new THREE.PerspectiveCamera(72, mount.clientWidth / mount.clientHeight, 0.1, 20000);
    camera.rotation.order = 'YXZ';

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xcfe5ff, 0x6b7c5e, 1.35));
    const sun = new THREE.DirectionalLight(0xfff2dd, 1.6);
    sun.position.set(-0.6, 1, 0.4).multiplyScalar(5000);
    scene.add(sun);

    // --- async data + geometry build ---
    (async () => {
      try {
        const t = tileXY(centerLng, centerLat, ZOOM);
        const span = 5;
        const x0 = Math.floor(t.x) - 2;
        const y0 = Math.floor(t.y) - 2;
        const px = 256 * span;

        const demC = document.createElement('canvas');
        demC.width = demC.height = px;
        const dctx = demC.getContext('2d', { willReadFrequently: true });
        const satC = document.createElement('canvas');
        satC.width = satC.height = px;
        const sctx = satC.getContext('2d');

        await Promise.all(Array.from({ length: span * span }, async (_, k) => {
          const i = Math.floor(k / span), j = k % span;
          const gx = x0 + i, gy = y0 + j;
          try {
            const dem = await loadImg(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${ZOOM}/${gx}/${gy}.png`);
            dctx.drawImage(dem, i * 256, j * 256);
          } catch { /* keep blank */ }
          try {
            const sat = await loadImg(`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${ZOOM}/${gy}/${gx}`);
            sctx.drawImage(sat, i * 256, j * 256);
          } catch { /* keep blank */ }
        }));

        const demData = dctx.getImageData(0, 0, px, px).data;
        const westLng = centerLng - halfLng, eastLng = centerLng + halfLng;
        const northLat = centerLat + halfLat, southLat = centerLat - halfLat;

        const demAt = (lng, lat) => {
          const fx = ((lng - westLng) / (eastLng - westLng)) * (px - 1);
          const fy = ((northLat - lat) / (northLat - southLat)) * (px - 1);
          const x0i = Math.max(0, Math.min(px - 2, Math.floor(fx)));
          const y0i = Math.max(0, Math.min(px - 2, Math.floor(fy)));
          const tx = Math.min(1, Math.max(0, fx - x0i));
          const ty = Math.min(1, Math.max(0, fy - y0i));
          const h = (x, y) => {
            const k = (y * px + x) * 4;
            return demData[k] * 256 + demData[k + 1] + demData[k + 2] / 256 - 32768;
          };
          return h(x0i, y0i) * (1 - tx) * (1 - ty) + h(x0i + 1, y0i) * tx * (1 - ty)
            + h(x0i, y0i + 1) * (1 - tx) * ty + h(x0i + 1, y0i + 1) * tx * ty;
        };

        const toWorld = (lng, lat) => ({
          x: (lng - centerLng) * 111320 * Math.cos((centerLat * Math.PI) / 180),
          z: (centerLat - lat) * 111320
        });
        const heightAt = (x, z) => demAt(centerLng + x / (111320 * Math.cos((centerLat * Math.PI) / 180)), centerLat - z / 111320);

        // terrain mesh
        const seg = 220;
        const geo = new THREE.PlaneGeometry(size, size, seg, seg);
        const pos = geo.attributes.position;
        const hgrid = [];
        for (let j = 0; j <= seg; j++) {
          const row = [];
          for (let i = 0; i <= seg; i++) {
            const vx = -size / 2 + (i / seg) * size;
            const vy = -size / 2 + (j / seg) * size;
            const w = toWorld(centerLng + (vx / (111320 * Math.cos((centerLat * Math.PI) / 180))), centerLat + vy / 111320);
            const h = heightAt(w.x, w.z);
            row.push(h);
            pos.setZ(j * (seg + 1) + i, h);
          }
          hgrid.push(row);
        }
        // exact height of the visible terrain surface (bilinear on the mesh grid)
        const terrainY = (x, z) => {
          const gx = Math.max(0, Math.min(seg - 1e-6, ((x + size / 2) / size) * seg));
          const gy = Math.max(0, Math.min(seg - 1e-6, ((size / 2 - z) / size) * seg));
          const i0 = Math.floor(gx), j0 = Math.floor(gy);
          const tx = gx - i0, ty = gy - j0;
          const h00 = hgrid[j0][i0], h10 = hgrid[j0][i0 + 1];
          const h01 = hgrid[j0 + 1][i0], h11 = hgrid[j0 + 1][i0 + 1];
          return (h00 * (1 - tx) + h10 * tx) * (1 - ty) + (h01 * (1 - tx) + h11 * tx) * ty;
        };
        geo.computeVertexNormals();
        const uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) {
          uv.setXY(i, (pos.getX(i) + size / 2) / size, 1 - (pos.getY(i) + size / 2) / size);
        }
        const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(satC) }));
        ground.rotation.x = -Math.PI / 2;
        scene.add(ground);

        // OSM data — official API (XML), Overpass mirrors as fallback
        let roadWays = [], buildingWays = [];
        const bbox = `${westLng},${southLat},${eastLng},${northLat}`;
        const osmQuery = async () => {
          const res = await fetch(`https://api.openstreetmap.org/api/0.6/map?bbox=${bbox}`, {
            headers: { 'User-Agent': 'KarabakhAgroInvest-demo/1.0' }
          });
          if (!res.ok) throw new Error('osm ' + res.status);
          const xml = new DOMParser().parseFromString(await res.text(), 'text/xml');
          const nodeMap = {};
          xml.querySelectorAll('node').forEach((n) => {
            nodeMap[n.getAttribute('id')] = { lon: parseFloat(n.getAttribute('lon')), lat: parseFloat(n.getAttribute('lat')) };
          });
          xml.querySelectorAll('way').forEach((w) => {
            const nds = [...w.querySelectorAll('nd')].map((nd) => nodeMap[nd.getAttribute('ref')]).filter(Boolean);
            if (nds.length < 2) return;
            const tags = {};
            w.querySelectorAll('tag').forEach((t) => { tags[t.getAttribute('k')] = t.getAttribute('v'); });
            if (tags.highway) roadWays.push(nds);
            else if (tags.building) buildingWays.push(nds);
          });
        };
        const overpassQuery = async () => {
          const q = `[out:json][timeout:25];(way["highway"](${southLat},${westLng},${northLat},${eastLng});way["building"](${southLat},${westLng},${northLat},${eastLng}););out geom;`;
          const endpoints = [
            'https://overpass-api.de/api/interpreter',
            'https://overpass.kumi.systems/api/interpreter',
            'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
          ];
          for (const ep of endpoints) {
            try {
              const res = await fetch(ep, { method: 'POST', body: 'data=' + encodeURIComponent(q) });
              if (!res.ok) continue;
              const json = await res.json();
              for (const el of (json.elements || [])) {
                const nds = (el.geometry || el.nodes || []).map((n) => (typeof n === 'object' ? n : null)).filter(Boolean);
                if (!nds.length) continue;
                if (el.tags && el.tags.highway) roadWays.push(nds);
                else if (el.tags && el.tags.building) buildingWays.push(nds);
              }
              if (roadWays.length || buildingWays.length) return;
            } catch { /* next */ }
          }
        };
        try { await osmQuery(); } catch { try { await overpassQuery(); } catch { /* offline */ } }

        // roads
        const roadPts = [];
        const roadPos = [];
        for (const nds of roadWays) {
          const pts = nds.map((n) => toWorld(n.lon, n.lat));
          for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i], b = pts[i + 1];
            const dx = b.x - a.x, dz = b.z - a.z;
            const len = Math.hypot(dx, dz) || 1;
            const nx = -dz / len, nz = dx / len;
            const w = 7;
            const y1 = terrainY(a.x, a.z) + 0.5, y2 = terrainY(b.x, b.z) + 0.5;
            const quad = [
              a.x + nx * w, y1, a.z + nz * w,
              a.x - nx * w, y1, a.z - nz * w,
              b.x + nx * w, y2, b.z + nz * w,
              b.x + nx * w, y2, b.z + nz * w,
              a.x - nx * w, y1, a.z - nz * w,
              b.x - nx * w, y2, b.z - nz * w
            ];
            for (const v of quad) roadPos.push(v);
          }
        }
        if (roadPos.length) {
          const rg = new THREE.BufferGeometry();
          rg.setAttribute('position', new THREE.Float32BufferAttribute(roadPos, 3));
          scene.add(new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0x848b92 })));
        }

        // buildings
        const rng = mulberry32(42);
        const bMat = new THREE.MeshLambertMaterial({ color: 0xb9b1a3 });
        for (const nds of buildingWays.slice(0, 500)) {
          const pts = nds.map((n) => toWorld(n.lon, n.lat));
          if (pts.length < 4) continue;
          const shape = new THREE.Shape();
          shape.moveTo(pts[0].x, -pts[0].z);
          for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, -pts[i].z);
          const hgt = 3.5 + rng() * 6;
          const bg = new THREE.ExtrudeGeometry(shape, { depth: hgt, bevelEnabled: false });
          const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
          const cz = pts.reduce((s, p) => s + p.z, 0) / pts.length;
          const bm = new THREE.Mesh(bg, bMat);
          bm.position.set(0, terrainY(cx, cz) - 0.2, 0);
          scene.add(bm);
        }

        // trees
        const treeCount = 6000;
        const trunkG = new THREE.CylinderGeometry(0.25, 0.35, 2.2, 5);
        const crownG = new THREE.ConeGeometry(1.9, 4.6, 6);
        const trunkM = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
        const crownM = new THREE.MeshLambertMaterial({ color: 0x3f7a3a });
        const trunks = new THREE.InstancedMesh(trunkG, trunkM, treeCount);
        const crowns = new THREE.InstancedMesh(crownG, crownM, treeCount);
        const m4 = new THREE.Matrix4();
        let placed = 0, guard = 0;
        while (placed < treeCount && guard++ < treeCount * 20) {
          const x = (rng() - 0.5) * size * 0.94;
          const z = (rng() - 0.5) * size * 0.94;
          const y = terrainY(x, z);
          m4.makeTranslation(x, y + 1.1, z);
          trunks.setMatrixAt(placed, m4);
          m4.makeTranslation(x, y + 2.2 + 2.3, z);
          crowns.setMatrixAt(placed, m4);
          placed++;
        }
        scene.add(trunks); scene.add(crowns);

        // plots (pickable)
        const pickables = [];
        for (const l of lands) {
          const ring = (l.geometry?.coordinates || [])[0] || [];
          if (ring.length < 3) continue;
          const pts = ring.map(([lng, lat]) => {
            const w = toWorld(lng, lat);
            return new THREE.Vector2(w.x, -w.z);
          });
          const shape = new THREE.Shape(pts);
          const tris = THREE.ShapeUtils.triangulateShape(pts, []);
          const verts = [];
          for (const tri of tris) {
            for (const idx of tri) {
              const p = pts[idx];
              const w = toWorld(centerLng + p.x / (111320 * Math.cos((centerLat * Math.PI) / 180)), centerLat - p.y / 111320);
              verts.push(p.x, terrainY(w.x, w.z) + 1.8, -p.y);
            }
          }
          if (!verts.length) continue;
          const pg = new THREE.BufferGeometry();
          pg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
          const fill = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({
            color: l.color || '#eab308', transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false
          }));
          fill.userData.land = l;
          scene.add(fill);
          pickables.push(fill);

          const linePts = ring.map(([lng, lat]) => {
            const w = toWorld(lng, lat);
            return new THREE.Vector3(w.x, terrainY(w.x, w.z) + 2.2, w.z);
          });
          linePts.push(linePts[0].clone());
          const lg = new THREE.BufferGeometry().setFromPoints(linePts);
          scene.add(new THREE.Line(lg, new THREE.LineBasicMaterial({ color: l.color || '#eab308' })));

          // translucent curtain walls along the plot border
          const cverts = [];
          for (let i = 0; i < ring.length - 1; i++) {
            const a = toWorld(ring[i][0], ring[i][1]);
            const b = toWorld(ring[i + 1][0], ring[i + 1][1]);
            const ya = terrainY(a.x, a.z), yb = terrainY(b.x, b.z);
            cverts.push(a.x, ya, a.z, b.x, yb, b.z, a.x, ya + 10, a.z);
            cverts.push(a.x, ya + 6, a.z, b.x, yb, b.z, b.x, yb + 10, b.z);
          }
          if (cverts.length) {
            const cg = new THREE.BufferGeometry();
            cg.setAttribute('position', new THREE.Float32BufferAttribute(cverts, 3));
            scene.add(new THREE.Mesh(cg, new THREE.MeshBasicMaterial({
              color: l.color || '#eab308', transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false
            })));
          }
        }

        // start position: walk center, clamped into the walkable area
        const startW0 = toWorld(centerLng, centerLat);
        const startLen = Math.hypot(startW0.x, startW0.z);
        const startMax = (RADIUS_M - 120) * 0.9;
        const startW = startLen > startMax
          ? { x: (startW0.x / startLen) * startMax, z: (startW0.z / startLen) * startMax }
          : startW0;

        // face the nearest other plot so the user sees the area
        let startYaw = Math.PI;
        let bestD = Infinity;
        for (const l of lands) {
          const ring = (l.geometry?.coordinates || [])[0] || [];
          if (!ring.length) continue;
          const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
          const cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
          const w = toWorld(cx, cy);
          const d = Math.hypot(w.x - startW.x, w.z - startW.z);
          if (d > 30 && d < bestD) { bestD = d; startYaw = Math.atan2(-(w.x - startW.x), -(w.z - startW.z)); }
        }

        // beacon at start
        const beaconG = new THREE.CylinderGeometry(2, 2, 110, 12, 1, true);
        const beacon = new THREE.Mesh(beaconG, new THREE.MeshBasicMaterial({ color: 0xff5a3c, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
        beacon.position.set(startW.x, terrainY(startW.x, startW.z) + 55, startW.z);
        scene.add(beacon);

        Object.assign(stateRef.current, {
          camera, renderer, scene, pickables, heightAt, terrainY, toWorld,
          pos: new THREE.Vector3(startW.x, terrainY(startW.x, startW.z) + EYE, startW.z),
          yaw: startYaw, pitch: -0.12, keys: new Set(), locked: false
        });
        readyRef.current = true;
        setReady(true);
      } catch (e) {
        if (!disposed) setFailed(true);
      }
    })();

    // --- controls ---
    const st = () => stateRef.current;

    const onKeyDown = (e) => {
      const s = st();
      if (!s.camera) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) {
        e.preventDefault();
        s.keys.add(k);
      }
      if (k === 'escape') document.exitPointerLock?.();
    };
    const onKeyUp = (e) => st().keys.delete(e.key.toLowerCase());
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    cleanupFns.push(() => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); });

    const canvas = renderer.domElement;
    const isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    let dragLook = null;
    let lockFailed = false;
    let lockTimer = 0;

    const doPick = () => {
      const s = st();
      if (!s.camera) return;
      const rc = new THREE.Raycaster();
      rc.setFromCamera(new THREE.Vector2(0, 0), s.camera);
      const hits = rc.intersectObjects(s.pickables, false);
      if (hits.length) {
        const land = hits[0].object.userData.land;
        setPicked(land);
        if (onSelect) onSelect(land);
      }
    };

    const tryLock = () => {
      if (isTouch || lockFailed) return;
      try {
        const p = canvas.requestPointerLock?.();
        clearTimeout(lockTimer);
        lockTimer = setTimeout(() => { if (!st().locked) lockFailed = true; }, 1500);
        if (p && p.catch) p.catch(() => { lockFailed = true; });
      } catch { lockFailed = true; }
    };

    const onMouseMove = (e) => {
      const s = st();
      if (!s.camera) return;
      if (s.locked) {
        s.yaw -= (e.movementX || 0) * 0.0021;
        s.pitch -= (e.movementY || 0) * 0.0021;
        s.pitch = Math.max(-1.35, Math.min(1.35, s.pitch));
      } else if (dragLook && !isTouch) {
        s.yaw -= (e.clientX - dragLook.x) * 0.004;
        s.pitch = Math.max(-1.35, Math.min(1.35, s.pitch - (e.clientY - dragLook.y) * 0.004));
        dragLook = { x: e.clientX, y: e.clientY };
      }
    };
    document.addEventListener('mousemove', onMouseMove);
    cleanupFns.push(() => document.removeEventListener('mousemove', onMouseMove));

    const onMouseDown = (e) => {
      if (!isTouch && !st().locked) dragLook = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp = () => { dragLook = null; };
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    cleanupFns.push(() => { canvas.removeEventListener('mousedown', onMouseDown); window.removeEventListener('mouseup', onMouseUp); });

    const onLockChange = () => {
      const s = st();
      s.locked = document.pointerLockElement === canvas;
      setLocked(s.locked);
    };
    document.addEventListener('pointerlockchange', onLockChange);
    cleanupFns.push(() => document.removeEventListener('pointerlockchange', onLockChange));

    const onCanvasClick = () => {
      const s = st();
      if (!s.camera) return;
      if (isTouch) { doPick(); return; }
      if (s.locked || lockFailed) { doPick(); return; }
      tryLock();
    };
    canvas.addEventListener('click', onCanvasClick);
    cleanupFns.push(() => canvas.removeEventListener('click', onCanvasClick));

    const onLockError = () => { lockFailed = true; };
    document.addEventListener('pointerlockerror', onLockError);
    cleanupFns.push(() => document.removeEventListener('pointerlockerror', onLockError));

    // mobile controls
    const joyEl = document.getElementById('walk-joy');
    const onTouchStart = (e) => {
      const s = st();
      if (!s.camera) return;
      for (const t of e.changedTouches) {
        const x = t.clientX / window.innerWidth;
        if (x < 0.45 && !joyRef.current.active) {
          joyRef.current = { active: true, id: t.identifier, sx: t.clientX, sy: t.clientY, dx: 0, dy: 0 };
          if (joyEl) { joyEl.style.display = 'block'; joyEl.style.left = (t.clientX - 60) + 'px'; joyEl.style.top = (t.clientY - 60) + 'px'; }
        } else if (lookRef.current.id === null) {
          lookRef.current = { id: t.identifier, lx: t.clientX, ly: t.clientY };
        }
      }
    };
    const onTouchMove = (e) => {
      const s = st();
      if (!s.camera) return;
      for (const t of e.changedTouches) {
        const j = joyRef.current;
        if (j.active && t.identifier === j.id) {
          j.dx = Math.max(-50, Math.min(50, t.clientX - j.sx));
          j.dy = Math.max(-50, Math.min(50, t.clientY - j.sy));
        } else if (lookRef.current.id === t.identifier) {
          s.yaw -= (t.clientX - lookRef.current.lx) * 0.005;
          s.pitch -= (t.clientY - lookRef.current.ly) * 0.005;
          s.pitch = Math.max(-1.35, Math.min(1.35, s.pitch));
          lookRef.current.lx = t.clientX; lookRef.current.ly = t.clientY;
        }
      }
    };
    const onTouchEnd = (e) => {
      for (const t of e.changedTouches) {
        const j = joyRef.current;
        if (j.active && t.identifier === j.id) {
          joyRef.current = { active: false, id: null, sx: 0, sy: 0, dx: 0, dy: 0 };
          if (joyEl) joyEl.style.display = 'none';
        }
        if (lookRef.current.id === t.identifier) lookRef.current = { id: null, lx: 0, ly: 0 };
      }
    };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
    cleanupFns.push(() => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    });

    const onResize = () => {
      const s = st();
      if (!s.camera) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', onResize);
    cleanupFns.push(() => window.removeEventListener('resize', onResize));

    let last = performance.now();
    const loop = (now) => {
      if (disposed) return;
      const s = st();
      if (s.camera && readyRef.current) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const k = s.keys;
        let mf = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
        let mr = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
        const sprint = k.has('shift') ? 2.4 : 1;
        if (joyRef.current.active) { mf += -joyRef.current.dy / 50; mr += joyRef.current.dx / 50; }
        const speed = 5.5 * sprint;
        if (mf || mr) {
          const sin = Math.sin(s.yaw), cos = Math.cos(s.yaw);
          const fx = -sin, fz = -cos;
          const rx = cos, rz = -sin;
          s.pos.x += (fx * mf + rx * mr) * speed * dt;
          s.pos.z += (fz * mf + rz * mr) * speed * dt;
          const d = Math.hypot(s.pos.x, s.pos.z);
          const maxR = RADIUS_M - 120;
          if (d > maxR) { s.pos.x *= maxR / d; s.pos.z *= maxR / d; }
        }
        s.pos.y = Math.max(s.heightAt(s.pos.x, s.pos.z), s.terrainY(s.pos.x, s.pos.z)) + EYE;
        s.camera.position.copy(s.pos);
        s.camera.rotation.y = s.yaw;
        s.camera.rotation.x = s.pitch;
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cleanupFns.forEach((fn) => fn());
      if (document.pointerLockElement === canvas) document.exitPointerLock?.();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
        }
      });
      renderer.dispose();
      if (canvas.parentNode === mount) mount.removeChild(canvas);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[60] bg-ink-900">
      <div ref={mountRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2">
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/70" />
          <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/70" />
        </div>
      </div>

      {!ready && !failed && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-ink-900/80">
          <div className="flex flex-col items-center gap-3 text-white">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            <div className="text-sm font-semibold">3D sahə yüklənir…</div>
          </div>
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-ink-900/90">
          <div className="max-w-sm text-center text-sm text-white">
            3D sahə yüklənə bilmədİ (xəritə/əhali məlumatı çatmadı). Bağlayıb yenidən açın.
          </div>
        </div>
      )}

      <div className="absolute left-3 top-3 z-20 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-white/90 px-3 py-1.5 text-xs font-bold text-ink-800 shadow-lg backdrop-blur transition hover:bg-white"
        >
          ✕ Bağla
        </button>
        <div className="rounded-xl bg-ink-900/80 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur">
          {locked ? 'Çıxış: Esc' : 'Klik: seç · Sürüşdür: baxış · Mobil: joystick + toxun'}
        </div>
      </div>

      {picked && (
        <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-xl bg-ink-900/85 px-4 py-2 text-center text-white shadow-xl backdrop-blur">
          <div className="text-sm font-bold">{picked.code} · {picked.districtName}</div>
          <div className="text-xs text-slate-300">{picked.purposeLabel} · {picked.areaHa} ha</div>
        </div>
      )}

      <div
        id="walk-joy"
        className="pointer-events-none fixed z-30 hidden h-[120px] w-[120px] rounded-full border-2 border-white/40 bg-white/10"
        style={{ display: 'none' }}
      >
        <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/50" />
      </div>
    </div>
  );
}
