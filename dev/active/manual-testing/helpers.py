"""Shared helpers for all testing phases."""
import os, json, sys

# Fix encoding for Windows console
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except:
        pass

SCREENSHOTS = os.path.join(os.path.dirname(__file__), 'screenshots')
os.makedirs(SCREENSHOTS, exist_ok=True)
BASE = 'http://localhost:3000'
API = 'http://localhost:5000'

# All 13 tabs in order
TABS = [
    "Garden Planner", "Garden Designer", "Property Designer",
    "Indoor Starts", "My Seeds", "Seed Catalog", "Livestock",
    "Planting Calendar", "Weather", "Nutrition", "Compost",
    "Harvests", "Photos"
]

ALL_RESULTS = []
ALL_BUGS = []
CONSOLE_ERRORS = []

def screenshot(page, name):
    path = os.path.join(SCREENSHOTS, f'{name}.png')
    page.screenshot(path=path, full_page=True)
    print(f"  [Screenshot] {name}.png")
    return path

def kill_overlay(page):
    page.evaluate("() => { document.querySelectorAll('iframe').forEach(el => el.remove()); }")

def safe_click(page, locator, timeout=5000):
    """Click with overlay removal and force."""
    kill_overlay(page)
    try:
        locator.click(force=True, timeout=timeout)
        return True
    except:
        kill_overlay(page)
        try:
            locator.click(force=True, timeout=timeout)
            return True
        except Exception as e:
            print(f"  [WARN] Click failed: {str(e)[:100]}")
            return False

def login(page, username='manualtest', password='ManualTest1!'):
    """Login to the app. Returns True if successful."""
    page.goto(BASE)
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)
    kill_overlay(page)

    body = page.inner_text('body')
    if username.lower() in body.lower() and 'logout' in body.lower():
        print(f"  Already logged in as {username}")
        return True

    # Click Login in header to open modal (the first Login button in the page header)
    # Use JavaScript to find and click the header login button
    page.evaluate("""() => {
        // Find buttons in header area
        const header = document.querySelector('header') || document.querySelector('nav') || document.body;
        const buttons = header.querySelectorAll('button');
        for (const btn of buttons) {
            if (btn.textContent.trim() === 'Login') {
                btn.click();
                break;
            }
        }
    }""")
    page.wait_for_timeout(1500)
    kill_overlay(page)

    # Fill login form - IDs are #username and #password
    ufield = page.locator('#username')
    if ufield.is_visible():
        ufield.fill(username)

    pfield = page.locator('#password')
    if pfield.is_visible():
        pfield.fill(password)

    # Submit the form using JavaScript - find the Login button inside the modal/form
    page.evaluate("""() => {
        // The modal Login button is the large blue one - it's typically inside a form
        // or inside a div that also contains the inputs
        const usernameInput = document.getElementById('username');
        if (usernameInput) {
            // Walk up to find the form or container
            let container = usernameInput.closest('form') || usernameInput.parentElement.parentElement.parentElement;
            if (container) {
                const btns = container.querySelectorAll('button');
                for (const btn of btns) {
                    if (btn.textContent.trim() === 'Login') {
                        btn.click();
                        return;
                    }
                }
            }
        }
        // Fallback: submit the form if it exists
        const form = document.querySelector('form');
        if (form) form.submit();
    }""")

    page.wait_for_timeout(3000)
    page.wait_for_load_state('networkidle')
    kill_overlay(page)

    body = page.inner_text('body')
    success = username.lower() in body.lower() and 'logout' in body.lower()
    if not success:
        # Maybe we need to wait longer or there's an error
        page.wait_for_timeout(2000)
        body = page.inner_text('body')
        success = username.lower() in body.lower() and 'logout' in body.lower()

    print(f"  Login {'successful' if success else 'FAILED'}")
    return success

def click_tab(page, tab_name):
    """Click a tab by name. Tabs are buttons in the tab bar with icons + text."""
    kill_overlay(page)
    # The tabs have text like "Garden\nPlanner" (with line break between icon and text)
    # Use get_by_text with exact match
    tab = page.get_by_text(tab_name, exact=True)
    try:
        if tab.is_visible(timeout=2000):
            safe_click(page, tab)
            page.wait_for_timeout(2000)
            page.wait_for_load_state('networkidle')
            kill_overlay(page)
            return True
    except:
        pass

    # Fallback: partial text
    tab = page.locator(f'button:has-text("{tab_name}"), a:has-text("{tab_name}")').first
    try:
        if tab.is_visible(timeout=2000):
            safe_click(page, tab)
            page.wait_for_timeout(2000)
            page.wait_for_load_state('networkidle')
            kill_overlay(page)
            return True
    except:
        pass

    print(f"  [WARN] Tab '{tab_name}' not found")
    return False

def log_result(test, status, notes=""):
    ALL_RESULTS.append({"test": test, "status": status, "notes": notes})
    icon = {"pass": "PASS", "fail": "FAIL", "warn": "WARN", "skip": "SKIP"}.get(status, "???")
    msg = f"  [{icon}] {test}"
    if notes:
        msg += f" -- {notes}"
    print(msg)

def log_bug(bug_id, title, tab, severity, steps, expected, actual, screenshot_ref="", console_errs=""):
    bug = {
        "id": bug_id, "title": title, "tab": tab, "severity": severity,
        "steps": steps, "expected": expected, "actual": actual,
        "screenshot": screenshot_ref, "console_errors": console_errs
    }
    ALL_BUGS.append(bug)
    print(f"  [BUG-{bug_id}] {severity}: {title}")

def save_phase_results(phase_num):
    path = os.path.join(os.path.dirname(__file__), f'phase{phase_num}_results.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump({
            "results": ALL_RESULTS,
            "bugs": ALL_BUGS,
            "console_errors": CONSOLE_ERRORS[:100]
        }, f, indent=2, ensure_ascii=False)

def setup_console_logging(page):
    def on_console(msg):
        if msg.type == 'error':
            CONSOLE_ERRORS.append(f"[{msg.type}] {msg.text}")
    page.on('console', on_console)

def print_summary(phase_name):
    print(f"\n{'=' * 60}")
    print(f"{phase_name} Summary")
    print(f"{'=' * 60}")
    passed = sum(1 for r in ALL_RESULTS if r['status'] == 'pass')
    failed = sum(1 for r in ALL_RESULTS if r['status'] == 'fail')
    warned = sum(1 for r in ALL_RESULTS if r['status'] == 'warn')
    print(f"  Passed: {passed}, Failed: {failed}, Warnings: {warned}")
    print(f"  Bugs found: {len(ALL_BUGS)}")
    print(f"  Console errors: {len(CONSOLE_ERRORS)}")
    if CONSOLE_ERRORS:
        unique = list(set(CONSOLE_ERRORS))[:10]
        print("  Unique console errors:")
        for e in unique:
            print(f"    {e[:200]}")


def drag_plant_to_grid(page, plant_locator, bed_id, target_cell_x=1, target_cell_y=1, cell_size=40):
    """Drag a plant element onto the garden grid SVG using incremental mouse moves.

    @dnd-kit's MouseSensor requires 8px of movement before activation.
    We use 25 incremental moves with 30ms delays to reliably trigger it and
    fire native mousemove events that GardenDesigner tracks for drop position.

    Args:
        page: Playwright page object
        plant_locator: Playwright Locator pointing to the draggable plant element
        bed_id: The numeric bed ID (used to find `#garden-grid-svg-{bed_id}`)
        target_cell_x: Target grid column (0-indexed)
        target_cell_y: Target grid row (0-indexed)
        cell_size: Pixel size of each grid cell (default 40 at zoom=1.0)

    Returns:
        dict with keys: activated (bool), modal_appeared (bool), error (str|None)
    """
    result = {'activated': False, 'modal_appeared': False, 'error': None}

    try:
        # Get bounding boxes
        plant_box = plant_locator.bounding_box()
        if not plant_box:
            result['error'] = 'Plant element has no bounding box'
            return result

        grid_svg = page.locator(f'#garden-grid-svg-{bed_id}')
        if not grid_svg.is_visible(timeout=3000):
            result['error'] = f'Grid SVG #{bed_id} not visible'
            return result
        grid_box = grid_svg.bounding_box()
        if not grid_box:
            result['error'] = 'Grid SVG has no bounding box'
            return result

        # Calculate start (center of plant element) and target (center of target cell)
        start_x = plant_box['x'] + plant_box['width'] / 2
        start_y = plant_box['y'] + plant_box['height'] / 2
        target_x = grid_box['x'] + (target_cell_x * cell_size) + (cell_size / 2)
        target_y = grid_box['y'] + (target_cell_y * cell_size) + (cell_size / 2)

        print(f"    Drag: ({start_x:.0f},{start_y:.0f}) -> ({target_x:.0f},{target_y:.0f})")

        # Move to start position and press
        page.mouse.move(start_x, start_y)
        page.wait_for_timeout(100)
        page.mouse.down()
        page.wait_for_timeout(100)

        # Incremental moves — 25 steps with 30ms delay each
        # This reliably exceeds the 8px activation threshold and fires mousemove events
        steps = 25
        for i in range(1, steps + 1):
            frac = i / steps
            page.mouse.move(
                start_x + (target_x - start_x) * frac,
                start_y + (target_y - start_y) * frac,
            )
            page.wait_for_timeout(30)

        # Check if drag overlay appeared (indicates @dnd-kit activation)
        drag_overlay = page.locator('[class*="DragOverlay"], [style*="pointer-events: none"][style*="position: fixed"]')
        if drag_overlay.count() > 0:
            result['activated'] = True
            print("    Drag overlay detected — drag activated!")

        # Release at target
        page.mouse.up()
        page.wait_for_timeout(1500)

        # Check if PlantConfigModal appeared (contains "Place" button or variety selector)
        place_btn = page.locator('button:has-text("Place")')
        if place_btn.count() > 0 and place_btn.first.is_visible(timeout=3000):
            result['modal_appeared'] = True
            result['activated'] = True  # Modal implies drag worked
            print("    PlantConfigModal appeared!")
        else:
            # Also check for any modal/dialog that appeared
            modal = page.locator('[class*="modal"], [role="dialog"]')
            if modal.count() > 0 and modal.first.is_visible(timeout=1000):
                result['modal_appeared'] = True
                result['activated'] = True
                print("    Modal/dialog detected!")

    except Exception as e:
        result['error'] = str(e)[:200]

    return result


def complete_plant_config_modal(page, quantity=1):
    """Complete the PlantConfigModal by clicking the Place button.

    Assumes the modal is already visible. Leaves variety as default.

    Args:
        page: Playwright page object
        quantity: Expected quantity (used for logging only)

    Returns:
        True if the Place button was clicked successfully, False otherwise.
    """
    try:
        # Look for the Place button — text is "Place X Plants" or "Place Plant"
        place_btn = page.locator('button:has-text("Place")')
        if place_btn.count() > 0:
            # Find the actual save/place button (not "Preview Placement")
            for i in range(place_btn.count()):
                btn = place_btn.nth(i)
                text = btn.inner_text()
                if 'Preview' in text:
                    continue
                if btn.is_visible() and btn.is_enabled():
                    print(f"    Clicking: {text}")
                    btn.click()
                    page.wait_for_timeout(3000)
                    # Verify modal closed — allow extra time for animation
                    try:
                        btn.wait_for(state='hidden', timeout=3000)
                        print("    Modal closed — plant placed!")
                        return True
                    except:
                        # Check for success toast as secondary signal
                        toast = page.locator('text=/Placed \\d+/')
                        if toast.count() > 0:
                            print("    Toast confirms placement (modal may still be animating)")
                            return True
                        print("    Modal still visible after click")
                        return False

        print("    No enabled Place button found")
        return False
    except Exception as e:
        print(f"    Error completing modal: {str(e)[:100]}")
        return False
