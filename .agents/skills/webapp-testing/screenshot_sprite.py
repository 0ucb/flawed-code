from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1400, "height": 1200})
    page.goto('file:///C:/Users/dlee1/Documents/chat%20project/template-2/docs/sprite-prototype.html')
    page.wait_for_load_state('networkidle')
    page.screenshot(path='/tmp/sprite_v3.png', full_page=True)
    print("Screenshot saved to /tmp/sprite_v3.png")
    browser.close()
