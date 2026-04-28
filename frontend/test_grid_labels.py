from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    page.goto('http://localhost:3000/?tab=designer')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(3000)

    # Screenshot the page
    page.screenshot(path='/tmp/grid_labels_check.png', full_page=False)

    # Check for SVG text elements with grid labels
    svg_texts = page.locator('svg text').all()
    print(f"Total SVG text elements: {len(svg_texts)}")

    # Look for label-pattern keys
    label_texts = page.locator('svg text[class="select-none"]').all()
    print(f"SVG text with select-none class: {len(label_texts)}")

    # Check showGridLabels in localStorage
    show_labels = page.evaluate("localStorage.getItem('showGridLabels')")
    print(f"localStorage showGridLabels: {show_labels}")

    # Check if any text contains "A1"
    a1_texts = page.locator('svg text:has-text("A1")').all()
    print(f"Text elements containing 'A1': {len(a1_texts)}")

    # Get the first SVG's innerHTML to inspect
    svgs = page.locator('svg[id^="garden-grid-svg-"]').all()
    print(f"Garden grid SVGs found: {len(svgs)}")

    if svgs:
        # Get a small portion of the SVG content
        inner = svgs[0].evaluate("el => el.innerHTML.substring(0, 2000)")
        print(f"First SVG innerHTML (first 2000 chars):\n{inner}")

    browser.close()
