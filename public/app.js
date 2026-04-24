/**
 * Responsive Three.js Background for Login Page
 * Theme: Dark, Tech/School, Cyan Accents
 */

// 1. Select the Canvas
const canvas = document.querySelector('#webgl-canvas');

// 2. Setup Scene
const scene = new THREE.Scene();
// Add slight fog to fade particles into the distance
scene.fog = new THREE.FogExp2(0x050505, 0.03);

// 3. Setup Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.z = 8; // Pull camera back

// 4. Setup Renderer
const renderer = new THREE.WebGLRenderer({ 
    canvas: canvas, 
    alpha: true, // Transparent background to let HTML background show through
    antialias: true 
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// ==========================================
// 5. Create 3D Objects
// ==========================================

// A. Central Geometric Object (Wireframe Icosahedron)
const geoGeometry = new THREE.IcosahedronGeometry(3, 1);
const geoMaterial = new THREE.MeshBasicMaterial({ 
    color: 0x00f2fe, // Cyan to match CSS
    wireframe: true,
    transparent: true,
    opacity: 0.15 // Keep it subtle so it doesn't distract from the login box
});
const geoMesh = new THREE.Mesh(geoGeometry, geoMaterial);
scene.add(geoMesh);

// B. Inner Glowing Sphere
const sphereGeometry = new THREE.SphereGeometry(2.5, 32, 32);
const sphereMaterial = new THREE.MeshBasicMaterial({
    color: 0x4facfe, // Slightly different blue for depth
    transparent: true,
    opacity: 0.05,
    wireframe: true
});
const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
scene.add(sphereMesh);

// C. Floating Particle Field
const particlesCount = 1500;
const posArray = new Float32Array(particlesCount * 3);

for(let i = 0; i < particlesCount * 3; i++) {
    // Spread particles in a wide area around the center
    posArray[i] = (Math.random() - 0.5) * 30;
}

const particlesGeometry = new THREE.BufferGeometry();
particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

const particlesMaterial = new THREE.PointsMaterial({
    size: 0.03,
    color: 0xffffff,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending
});

const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(particlesMesh);

// ==========================================
// 6. Mouse Interaction (Parallax Effect)
// ==========================================
let mouseX = 0;
let mouseY = 0;
let targetX = 0;
let targetY = 0;
const windowHalfX = window.innerWidth / 2;
const windowHalfY = window.innerHeight / 2;

document.addEventListener('mousemove', (event) => {
    mouseX = (event.clientX - windowHalfX);
    mouseY = (event.clientY - windowHalfY);
});

// ==========================================
// 7. Animation Loop
// ==========================================
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();

    // Rotate center objects
    geoMesh.rotation.y = elapsedTime * 0.1;
    geoMesh.rotation.x = elapsedTime * 0.05;
    
    sphereMesh.rotation.y = -elapsedTime * 0.05;
    sphereMesh.rotation.z = elapsedTime * 0.02;

    // Rotate particle field slowly
    particlesMesh.rotation.y = -elapsedTime * 0.02;

    // Apply smooth mouse parallax effect
    targetX = mouseX * 0.001;
    targetY = mouseY * 0.001;
    
    scene.rotation.y += 0.05 * (targetX - scene.rotation.y);
    scene.rotation.x += 0.05 * (targetY - scene.rotation.x);

    // Render the scene
    renderer.render(scene, camera);
}

// Start loop
animate();

// ==========================================
// 8. Responsive Window Resize
// ==========================================
window.addEventListener('resize', () => {
    // Update camera aspect ratio
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    // Update renderer size and pixel ratio
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});