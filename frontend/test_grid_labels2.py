from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    page.goto('http://localhost:3000')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)

    # Screenshot to see what page we're on
    page.screenshot(path='/tmp/grid_labels_page.png')
    print(f"URL: {page.url}")
    print(f"Title: {page.title()}")

    # Check if there's a login form
    login_inputs = page.locator('input[type="password"]').all()
    print(f"Password inputs: {len(login_inputs)}")

    if login_inputs:
        # Try to login
        username_input = page.locator('input[type="text"], input[name="username"], input[type="email"]').first
        username_input.fill('marcsie')
        login_inputs[0].fill('marcsie')
        # Look for submit button
        submit = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign")').first
        submit.click()
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(2000)
        print(f"After login URL: {page.url}")

    # Navigate to designer
    page.goto('http://localhost:3000/?tab=designer')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(3000)
    page.screenshot(path='/tmp/grid_labels_designer.png')

    # Check for SVG elements
    svgs = page.locator('svg[id^="garden-grid-svg-"]').all()
    print(f"Garden grid SVGs found: {len(svgs)}")

    # Check showGridLabels in localStorage
    show_labels = page.evaluate("localStorage.getItem('showGridLabels')")
    print(f"localStorage showGridLabels: {show_labels}")

    # Check all SVG text elements
    svg_texts = page.locator('svg text').all()
    print(f"Total SVG text elements: {len(svg_texts)}")

    if svgs:
        inner = svgs[0].evaluate("el => el.innerHTML.substring(0, 3000)")
        print(f"First SVG innerHTML (first 3000 chars):\n{inner}")

    # If no labels, check the React component state by looking at what's rendered
    all_texts = page.locator('text').all()
    print(f"All <text> elements on page: {len(all_texts)}")

    browser.close()
