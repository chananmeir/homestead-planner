"""Phase 6 DnD: Drag-and-Drop plant placement on all 3 bed methods.

Tests whether @dnd-kit drag activation works with Playwright mouse events
and whether plants can be placed on SFG, MIGardener, and Row beds.

Key discovery: The Garden Designer uses nested overflow-auto containers:
  - Left sidebar: max-h-[calc(100vh-200px)] overflow-y-auto (PlantPalette)
  - Main area: flex-1 flex-col overflow-auto (header card + bed grids)
  - Grid container: overflow-x-auto overflow-y-auto (bed SVGs)

The grid SVGs exist in the DOM but are below the fold of the main area
scrollable container. We must scroll the grid into view AND ensure the
plant element is visible in the sidebar before attempting the drag.

Usage:
    python dev/active/manual-testing/phase6_dnd.py
"""
import sys, os, re
sys.path.insert(0, os.path.dirname(__file__))
from playwright.sync_api import sync_playwright
from helpers import *


def scroll_grid_into_view(page, bed_id):
    """Scroll the garden grid SVG for the given bed into the visible viewport.

    The grid lives inside a nested overflow container. We use JavaScript
    scrollIntoView to bring it into view within its scroll parent.
    """
    page.evaluate(f"""() => {{
        const svg = document.getElementById('garden-grid-svg-{bed_id}');
        if (svg) {{
            svg.scrollIntoView({{ behavior: 'instant', block: 'center' }});
        }}
    }}""")
    page.wait_for_timeout(500)


def search_plant_palette(page, plant_name):
    """Type into the Plant Palette search box to filter to a specific plant.

    This brings the desired plant near the top of the sidebar, ensuring
    it's visible within the sidebar's overflow-y-auto container.
    """
    search = page.locator('input[placeholder*="Search"]').first
    try:
        if search.is_visible(timeout=2000):
            search.fill('')  # Clear first
            search.fill(plant_name)
            page.wait_for_timeout(800)
            return True
    except:
        pass
    return False


def clear_plant_search(page):
    """Clear the plant palette search box."""
    search = page.locator('input[placeholder*="Search"]').first
    try:
        if search.is_visible(timeout=1000):
            search.fill('')
            page.wait_for_timeout(500)
    except:
        pass


def get_all_bed_ids(page):
    """Get all garden-grid-svg-{id} IDs from the DOM."""
    return page.evaluate("""() => {
        const svgs = document.querySelectorAll('svg[id^="garden-grid-svg-"]');
        return Array.from(svgs).map(s => {
            const m = s.id.match(/garden-grid-svg-(\\d+)/);
            return m ? parseInt(m[1]) : null;
        }).filter(Boolean);
    }""")


def get_bed_id_from_page(page):
    """Get the first visible garden grid SVG bed ID."""
    ids = get_all_bed_ids(page)
    return ids[0] if ids else None


def click_bed_to_activate(page, bed_id):
    """Click on a bed's grid SVG to make it the active bed."""
    page.evaluate(f"""() => {{
        const svg = document.getElementById('garden-grid-svg-{bed_id}');
        if (svg) {{
            svg.scrollIntoView({{ behavior: 'instant', block: 'center' }});
            svg.dispatchEvent(new MouseEvent('click', {{ bubbles: true }}));
        }}
    }}""")
    page.wait_for_timeout(500)


def find_draggable_plant(page, plant_name):
    """Find a draggable plant element in the palette after searching.

    Uses the search box to filter, then finds the first cursor-grab
    element whose text matches.
    """
    search_plant_palette(page, plant_name)

    # Look for cursor-grab elements (draggable items)
    grab_items = page.locator('[class*="cursor-grab"]')
    count = grab_items.count()
    print(f"    Found {count} cursor-grab items after searching '{plant_name}'")

    for i in range(count):
        item = grab_items.nth(i)
        try:
            text = item.inner_text(timeout=1000)
            if plant_name.lower() in text.lower():
                if item.is_visible():
                    # Scroll into view within the sidebar
                    item.scroll_into_view_if_needed()
                    page.wait_for_timeout(200)
                    box = item.bounding_box()
                    if box:
                        print(f"    Plant '{plant_name}' at ({box['x']:.0f}, {box['y']:.0f})")
                        return item
        except:
            continue

    # Fallback: look for any visible text match
    text_loc = page.get_by_text(plant_name, exact=False).first
    try:
        if text_loc.is_visible(timeout=1000):
            text_loc.scroll_into_view_if_needed()
            page.wait_for_timeout(200)
            box = text_loc.bounding_box()
            if box:
                print(f"    Plant '{plant_name}' (text fallback) at ({box['x']:.0f}, {box['y']:.0f})")
                return text_loc
    except:
        pass

    return None


def select_single_bed(page, bed_name_keyword):
    """Use the Display Beds dropdown to show only one specific bed.

    This also makes that bed the active bed.
    Returns True if successful.
    """
    # The "Display Beds:" dropdown lets us select a single bed
    display_dropdown = page.locator('select:visible').all()
    for sel in display_dropdown:
        options = sel.locator('option').all()
        option_texts = [opt.inner_text() for opt in options]
        # Check if this is the Display Beds dropdown (has "All Beds" option)
        if any('all beds' in t.lower() for t in option_texts):
            for opt in options:
                text = opt.inner_text()
                if bed_name_keyword.lower() in text.lower() and 'all' not in text.lower():
                    sel.select_option(label=text)
                    page.wait_for_timeout(1500)
                    kill_overlay(page)
                    print(f"  Display Beds set to: {text}")
                    return True
    return False


def try_drag(page, plant_loc, bed_id, cell_x, cell_y, cell_size=40):
    """Attempt the full drag sequence:
    1. Scroll grid into view
    2. Get bounding boxes (both should be in viewport now)
    3. Incremental mouse drag
    4. Check for modal

    Returns result dict.
    """
    result = {'activated': False, 'modal_appeared': False, 'error': None}

    try:
        # Scroll grid into view first
        scroll_grid_into_view(page, bed_id)
        page.wait_for_timeout(300)

        # Scroll plant into view within sidebar
        plant_loc.scroll_into_view_if_needed()
        page.wait_for_timeout(300)

        # Get bounding boxes - should now be in viewport
        plant_box = plant_loc.bounding_box()
        if not plant_box:
            result['error'] = 'Plant element has no bounding box'
            return result

        grid_svg = page.locator(f'#garden-grid-svg-{bed_id}')
        grid_box = grid_svg.bounding_box()
        if not grid_box:
            result['error'] = f'Grid SVG #{bed_id} has no bounding box'
            return result

        # Verify both are within viewport
        viewport = page.viewport_size
        vp_h = viewport['height'] if viewport else 900

        print(f"    Plant box: y={plant_box['y']:.0f} h={plant_box['height']:.0f}")
        print(f"    Grid box:  y={grid_box['y']:.0f} h={grid_box['height']:.0f} w={grid_box['width']:.0f}")
        print(f"    Viewport:  {viewport}")

        if plant_box['y'] < 0 or plant_box['y'] > vp_h:
            print(f"    WARNING: Plant is outside viewport (y={plant_box['y']:.0f})")
        if grid_box['y'] < 0 or grid_box['y'] + grid_box['height'] < 0:
            print(f"    WARNING: Grid is outside viewport (y={grid_box['y']:.0f})")

        # Calculate start and target coordinates
        start_x = plant_box['x'] + plant_box['width'] / 2
        start_y = plant_box['y'] + plant_box['height'] / 2
        # Target: center of the specified cell
        target_x = grid_box['x'] + (cell_x * cell_size) + (cell_size / 2)
        target_y = grid_box['y'] + (cell_y * cell_size) + (cell_size / 2)

        # Clamp target to grid bounds
        target_x = min(target_x, grid_box['x'] + grid_box['width'] - 5)
        target_y = min(target_y, grid_box['y'] + grid_box['height'] - 5)

        print(f"    Drag: ({start_x:.0f},{start_y:.0f}) -> ({target_x:.0f},{target_y:.0f})")

        # Perform incremental mouse drag
        page.mouse.move(start_x, start_y)
        page.wait_for_timeout(150)
        page.mouse.down()
        page.wait_for_timeout(150)

        # 30 steps with 25ms delay — reliable activation
        steps = 30
        for i in range(1, steps + 1):
            frac = i / steps
            page.mouse.move(
                start_x + (target_x - start_x) * frac,
                start_y + (target_y - start_y) * frac,
            )
            page.wait_for_timeout(25)

        # Brief pause at target before releasing
        page.wait_for_timeout(200)

        # Check for drag overlay before releasing
        overlay_visible = page.evaluate("""() => {
            const overlays = document.querySelectorAll('[style*="pointer-events: none"][style*="position: fixed"]');
            return overlays.length > 0;
        }""")
        if overlay_visible:
            result['activated'] = True
            print("    Drag overlay detected!")

        page.mouse.up()
        page.wait_for_timeout(1500)

        # Check if PlantConfigModal appeared
        place_btn = page.locator('button:has-text("Place")')
        try:
            if place_btn.first.is_visible(timeout=3000):
                result['modal_appeared'] = True
                result['activated'] = True
                print("    PlantConfigModal appeared!")
        except:
            pass

        if not result['modal_appeared']:
            # Check for any modal/dialog
            modal = page.locator('[role="dialog"], [class*="modal"]')
            try:
                if modal.first.is_visible(timeout=1000):
                    result['modal_appeared'] = True
                    result['activated'] = True
                    print("    Dialog/modal detected!")
            except:
                pass

    except Exception as e:
        result['error'] = str(e)[:200]

    return result


def try_pointer_event_fallback(page, plant_loc, bed_id, cell_x=1, cell_y=1, cell_size=40):
    """Fallback: dispatch synthetic PointerEvent objects via page.evaluate().

    @dnd-kit uses Pointer Events internally. This dispatches
    pointerdown → pointermove (30 steps) → pointerup directly.
    """
    result = {'activated': False, 'modal_appeared': False, 'error': None}

    try:
        scroll_grid_into_view(page, bed_id)
        plant_loc.scroll_into_view_if_needed()
        page.wait_for_timeout(300)

        plant_box = plant_loc.bounding_box()
        grid_svg = page.locator(f'#garden-grid-svg-{bed_id}')
        grid_box = grid_svg.bounding_box()

        if not plant_box or not grid_box:
            result['error'] = 'Missing bounding box'
            return result

        start_x = plant_box['x'] + plant_box['width'] / 2
        start_y = plant_box['y'] + plant_box['height'] / 2
        target_x = grid_box['x'] + (cell_x * cell_size) + (cell_size / 2)
        target_y = grid_box['y'] + (cell_y * cell_size) + (cell_size / 2)
        target_x = min(target_x, grid_box['x'] + grid_box['width'] - 5)
        target_y = min(target_y, grid_box['y'] + grid_box['height'] - 5)

        print(f"    PointerEvent: ({start_x:.0f},{start_y:.0f}) -> ({target_x:.0f},{target_y:.0f})")

        # Dispatch pointer events via JavaScript
        page.evaluate(f"""async () => {{
            const el = document.elementFromPoint({start_x}, {start_y});
            if (!el) return;

            el.dispatchEvent(new PointerEvent('pointerdown', {{
                clientX: {start_x}, clientY: {start_y},
                bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse',
                button: 0, buttons: 1, isPrimary: true
            }}));

            const steps = 30;
            for (let i = 1; i <= steps; i++) {{
                await new Promise(r => setTimeout(r, 25));
                const frac = i / steps;
                const x = {start_x} + ({target_x} - {start_x}) * frac;
                const y = {start_y} + ({target_y} - {start_y}) * frac;

                document.dispatchEvent(new PointerEvent('pointermove', {{
                    clientX: x, clientY: y,
                    bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse',
                    button: 0, buttons: 1, isPrimary: true
                }}));
                document.dispatchEvent(new MouseEvent('mousemove', {{
                    clientX: x, clientY: y,
                    bubbles: true, cancelable: true, button: 0, buttons: 1
                }}));
            }}

            await new Promise(r => setTimeout(r, 200));

            document.dispatchEvent(new PointerEvent('pointerup', {{
                clientX: {target_x}, clientY: {target_y},
                bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse',
                button: 0, buttons: 0, isPrimary: true
            }}));
        }}""")

        page.wait_for_timeout(2000)

        place_btn = page.locator('button:has-text("Place")')
        try:
            if place_btn.first.is_visible(timeout=2000):
                result['modal_appeared'] = True
                result['activated'] = True
                print("    PointerEvent: Modal appeared!")
        except:
            print("    PointerEvent: No modal")

    except Exception as e:
        result['error'] = str(e)[:200]

    return result


# ── Test Matrix ──────────────────────────────────────────────────────
TEST_MATRIX = [
    {'bed_keyword': 'sfg',  'bed_label': 'SFG Bed Alpha',  'plant': 'Tomato',   'cell': (2, 2)},
    {'bed_keyword': 'mig',  'bed_label': 'MIG Bed Beta',   'plant': 'Lettuce',  'cell': (2, 2)},
    {'bed_keyword': 'row',  'bed_label': 'Row Bed Gamma',  'plant': 'Cucumber', 'cell': (2, 2)},
]


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(viewport={'width': 1400, 'height': 1200})
        page = context.new_page()
        setup_console_logging(page)

        print("=" * 60)
        print("Phase 6 DnD: Drag-and-Drop Plant Placement")
        print("=" * 60)

        # ── Login ────────────────────────────────────────────────
        if not login(page):
            print("  FATAL: Login failed")
            browser.close()
            sys.exit(1)

        # ── Navigate to Garden Designer ──────────────────────────
        click_tab(page, "Garden Designer")
        page.wait_for_timeout(3000)
        kill_overlay(page)

        # Check what beds exist
        bed_ids = get_all_bed_ids(page)
        print(f"  Bed IDs in DOM: {bed_ids}")

        # Screenshot the initial state
        screenshot(page, 'P6D_01_designer_loaded')

        # Scroll to see if grids are below the fold
        if bed_ids:
            scroll_grid_into_view(page, bed_ids[0])
            page.wait_for_timeout(500)
            screenshot(page, 'P6D_02_grid_scrolled')

        # ── Run tests for each bed ───────────────────────────────
        for idx, test in enumerate(TEST_MATRIX):
            bed_kw = test['bed_keyword']
            plant_name = test['plant']
            cell_x, cell_y = test['cell']
            label = test['bed_label']

            print(f"\n{'─' * 50}")
            print(f"  TEST {idx+1}: {plant_name} on {label}")
            print(f"{'─' * 50}")

            # Try to select only this bed using Display Beds dropdown
            selected_single = select_single_bed(page, bed_kw)
            if not selected_single:
                # Fallback: try alpha/beta/gamma keywords
                fallbacks = {'sfg': ['alpha'], 'mig': ['beta'], 'row': ['gamma']}
                for fb in fallbacks.get(bed_kw, []):
                    selected_single = select_single_bed(page, fb)
                    if selected_single:
                        break

            if not selected_single:
                print(f"  Could not isolate {label} in Display Beds, using all beds")

            page.wait_for_timeout(1000)

            # Get current bed IDs
            current_ids = get_all_bed_ids(page)
            print(f"  Available bed IDs: {current_ids}")

            if not current_ids:
                log_result(f"Grid for {label}", "fail", "No bed SVGs in DOM")
                # Reset to all beds for next test
                page.locator('select:visible').all()
                continue

            bed_id = current_ids[0]  # Use the first (or only) visible bed
            print(f"  Using bed ID: {bed_id}")

            # Scroll grid into view and screenshot
            scroll_grid_into_view(page, bed_id)
            page.wait_for_timeout(500)
            screenshot(page, f'P6D_{idx+1:02d}_a_grid_{bed_kw}')

            # Find the plant in the palette
            plant_loc = find_draggable_plant(page, plant_name)
            if not plant_loc:
                log_result(f"Find {plant_name} in palette", "fail", "Not found after search")
                clear_plant_search(page)
                # Reset display beds to all
                for sel in page.locator('select:visible').all():
                    opts = sel.locator('option').all()
                    for opt in opts:
                        if 'all beds' in opt.inner_text().lower():
                            sel.select_option(label=opt.inner_text())
                            break
                continue

            log_result(f"Find {plant_name} in palette", "pass")

            # ── Attempt 1: Standard mouse drag ───────────────────
            print(f"\n  Attempt 1: Standard mouse drag")
            drag_result = try_drag(page, plant_loc, bed_id, cell_x, cell_y)

            if drag_result['error']:
                print(f"    Error: {drag_result['error']}")

            screenshot(page, f'P6D_{idx+1:02d}_b_after_drag_{bed_kw}')

            if drag_result['modal_appeared']:
                log_result(f"Drag {plant_name} to {label}", "pass", "Modal appeared!")
                placed = complete_plant_config_modal(page)
                screenshot(page, f'P6D_{idx+1:02d}_c_placed_{bed_kw}')
                log_result(f"Place {plant_name} on {label}",
                           "pass" if placed else "fail",
                           "Placed!" if placed else "Modal completion failed")
                clear_plant_search(page)
                # Reset to all beds for next test
                for sel in page.locator('select:visible').all():
                    opts = sel.locator('option').all()
                    for opt in opts:
                        if 'all beds' in opt.inner_text().lower():
                            sel.select_option(label=opt.inner_text())
                            break
                continue

            if drag_result['activated']:
                log_result(f"Drag {plant_name} (mouse)", "warn",
                           "Drag overlay seen but no modal — drop target missed?")
            else:
                log_result(f"Drag {plant_name} (mouse)", "warn",
                           "No activation — trying PointerEvent fallback")

            # ── Attempt 2: PointerEvent fallback ─────────────────
            print(f"\n  Attempt 2: PointerEvent dispatch")

            # Re-find plant (DOM may have changed)
            plant_loc = find_draggable_plant(page, plant_name)
            if not plant_loc:
                log_result(f"Re-find {plant_name}", "fail", "Not found for retry")
                clear_plant_search(page)
                continue

            pointer_result = try_pointer_event_fallback(page, plant_loc, bed_id, cell_x, cell_y)

            if pointer_result['error']:
                print(f"    Error: {pointer_result['error']}")

            screenshot(page, f'P6D_{idx+1:02d}_d_pointer_{bed_kw}')

            if pointer_result['modal_appeared']:
                log_result(f"Drag {plant_name} (PointerEvent)", "pass", "Modal appeared!")
                placed = complete_plant_config_modal(page)
                screenshot(page, f'P6D_{idx+1:02d}_e_pointer_placed_{bed_kw}')
                log_result(f"Place {plant_name} on {label}",
                           "pass" if placed else "fail")
            elif pointer_result['activated']:
                log_result(f"Drag {plant_name} (PointerEvent)", "warn",
                           "Drag activated but no modal — drop target missed?")
            else:
                log_result(f"Drag {plant_name} to {label}", "fail",
                           "Neither mouse nor PointerEvent triggered drag")

            # Cleanup for next test
            clear_plant_search(page)
            # Reset display beds to all
            for sel in page.locator('select:visible').all():
                opts = sel.locator('option').all()
                for opt in opts:
                    if 'all beds' in opt.inner_text().lower():
                        sel.select_option(label=opt.inner_text())
                        page.wait_for_timeout(500)
                        break

        # ── Final summary ────────────────────────────────────────
        print(f"\n{'─' * 50}")
        print("  Final State Check")
        print(f"{'─' * 50}")

        body = page.inner_text('body')
        placed_match = re.search(r'(\d+)\s*Plants?\s*Placed', body, re.IGNORECASE)
        if placed_match:
            count = int(placed_match.group(1))
            log_result(f"Plants Placed counter: {count}", "pass" if count > 0 else "warn")
        else:
            log_result("Plants Placed counter", "warn", "Not found")

        screenshot(page, 'P6D_99_final')
        print_summary("Phase 6 DnD")
        save_phase_results('6dnd')
        browser.close()
        print("\nPhase 6 DnD complete.")


if __name__ == '__main__':
    main()
