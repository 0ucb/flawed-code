from playwright.sync_api import sync_playwright, expect
import time

def test_reading_companion():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Capture console errors
        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg) if msg.type == "error" else None)
        
        page.goto("http://localhost:3000")
        page.wait_for_load_state("networkidle")
        page.screenshot(path="C:/Users/dlee1/Documents/chat project/template-2/.agents/skills/webapp-testing/test-screenshots/01-initial.png", full_page=True)
        
        # Step 1: Open settings and enable Reading Companion
        print("Step 1: Opening settings...")
        # Scroll to top first
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(200)
        # Click the settings/gear icon - it's the gear emoji button
        settings_btn = page.locator("button:has-text('⚙')")
        if settings_btn.count() > 0:
            settings_btn.first.click()
        else:
            # Try by role
            page.click('button[aria-label*="Settings"], button[title*="Settings"], button:has(svg path[d*="settings"])')
        page.wait_for_timeout(500)
        page.screenshot(path="C:/Users/dlee1/Documents/chat project/template-2/.agents/skills/webapp-testing/test-screenshots/02-settings-opened.png", full_page=True)
        
        # Navigate to Reading Companion tab
        rc_tab = page.get_by_role("tab", name="Reading Companion", exact=True)
        if rc_tab.count() > 0:
            rc_tab.click()
        else:
            # Try clicking the tab by text
            page.click("button:has-text('Reading Companion')")
        page.wait_for_timeout(300)
        
        # Enable Reading Companion
        rc_toggle = page.locator("input[type='checkbox']")
        if rc_toggle.count() > 0:
            rc_toggle.first.check()
        page.wait_for_timeout(200)
        
        # Save settings
        save_btn = page.get_by_role("button", name="Save Settings", exact=True)
        if save_btn.count() > 0:
            save_btn.click()
        else:
            page.click("button:has-text('Save')")
        page.wait_for_timeout(500)
        
        # Step 2: Check that Reading Companion panel appears
        print("Step 2: Checking Reading Companion panel...")
        rc_header = page.locator("text=Reading Companion")
        try:
            expect(rc_header).to_be_visible(timeout=3000)
            print("  [PASS] Reading Companion header is visible")
        except Exception:
            print("  [FAIL] Reading Companion header NOT found")
        
        # Check for Add Content button
        add_btn = page.get_by_role("button", name="Add Content", exact=True)
        try:
            expect(add_btn).to_be_visible(timeout=3000)
            print("  [PASS] Add Content button is visible")
        except Exception:
            print("  [FAIL] Add Content button NOT found")
        
        # Check panel exists
        panel = page.locator("[style*='width: 400px']")
        if panel.count() > 0:
            print("  [PASS] Reading panel exists with correct width")
        
        # Step 3: Try clicking Add Content (should open file picker)
        print("Step 3: Testing Add Content click...")
        if add_btn.count() > 0:
            add_btn.click()
            page.wait_for_timeout(500)
            # File picker may or may not show in headless mode
            print("  [PASS] Add Content button is clickable")
        
        # Step 4: Check for any console errors
        print(f"\nConsole errors: {len(console_errors)}")
        for err in console_errors[:5]:
            print(f"  - {err.text}")
        
        # Final screenshot
        page.screenshot(path="C:/Users/dlee1/Documents/chat project/template-2/.agents/skills/webapp-testing/test-screenshots/03-final.png", full_page=True)
        
        browser.close()
        print("\nBrowser test complete!")

if __name__ == "__main__":
    test_reading_companion()
