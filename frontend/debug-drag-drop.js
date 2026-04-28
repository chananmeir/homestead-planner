/**
 * Drag-Drop Diagnostic Script
 *
 * Paste this into the browser console while on the Garden Designer page
 * to diagnose why plants aren't sticking when dragged.
 */

console.log('🔍 Starting Drag-Drop Diagnostic...\n');

// Check 1: Verify backend is accessible
console.log('1️⃣ Testing Backend Connection...');
fetch('http://localhost:5000/api/plants')
  .then(res => {
    if (res.ok) {
      console.log('✅ Backend API is responding');
      return res.json();
    } else {
      console.error('❌ Backend returned error:', res.status, res.statusText);
      throw new Error('Backend not OK');
    }
  })
  .then(plants => {
    console.log(`✅ Successfully loaded ${plants.length} plants`);
  })
  .catch(err => {
    console.error('❌ CRITICAL: Cannot reach backend!', err);
    console.log('   Make sure backend server is running on port 5000');
    console.log('   Run: cd backend && python app.py');
  });

// Check 2: Verify DnD Context
console.log('\n2️⃣ Checking Drag-Drop Setup...');
setTimeout(() => {
  const dndContext = document.querySelector('[data-dnd-context]');
  const droppable = document.querySelector('#garden-grid-svg');
  const plantPalette = document.querySelector('.plant-palette') || document.querySelector('[data-plant-palette]');

  console.log('DnD Context element:', dndContext ? '✅ Found' : '❌ Not found');
  console.log('Garden Grid SVG:', droppable ? '✅ Found' : '❌ Not found');
  console.log('Plant Palette:', plantPalette ? '✅ Found' : '❌ Not found (check component rendered)');

  if (!droppable) {
    console.warn('⚠️  Garden grid SVG not found! Make sure a bed is selected.');
  }
}, 1000);

// Check 3: Monitor network requests
console.log('\n3️⃣ Setting up Network Monitor...');
const originalFetch = window.fetch;
window.fetch = function(...args) {
  const url = args[0];
  if (typeof url === 'string' && url.includes('/api/')) {
    console.log('📡 API Request:', args[0], args[1]?.method || 'GET');
  }
  return originalFetch.apply(this, args)
    .then(response => {
      if (typeof url === 'string' && url.includes('/api/')) {
        console.log('📥 API Response:', url, response.status, response.ok ? '✅' : '❌');
      }
      return response;
    });
};

// Check 4: Monitor drag events
console.log('\n4️⃣ Setting up Drag Event Monitor...');
console.log('Try dragging a plant now. You should see logs below:\n');

// Add global drag event listeners
window.addEventListener('dragstart', (e) => {
  console.log('🎯 Drag started:', e.target);
}, { capture: true });

window.addEventListener('dragend', (e) => {
  console.log('🎯 Drag ended:', e.target);
}, { capture: true });

window.addEventListener('drop', (e) => {
  console.log('🎯 Drop event:', e.target);
}, { capture: true });

// Check 5: Instructions
console.log('\n📋 NEXT STEPS:');
console.log('1. Make sure backend server is running (cd backend && python app.py)');
console.log('2. Make sure you have selected a garden bed from the dropdown');
console.log('3. Try dragging a plant from the palette onto the grid');
console.log('4. Watch this console for logs - you should see:');
console.log('   - "handleDragEnd triggered"');
console.log('   - "Attempting to place plant"');
console.log('   - "Sending POST request"');
console.log('   - "Planted item created successfully"');
console.log('\n5. If you see error messages, they will appear in RED above');
console.log('6. If you see NO logs at all, the drag-drop system is not working');
console.log('\n🔍 Diagnostic setup complete. Try dragging a plant now!');
