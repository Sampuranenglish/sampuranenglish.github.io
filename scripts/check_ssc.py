from playwright.sync_api import sync_playwright
import json
import os

OUTPUT_FILE = "data/ssc-latest.json"

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto("https://ssc.gov.in/", wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(8000)

        # Diagnostics: how many links exist on the page at all
        total_links = page.eval_on_selector_all("a", "els => els.length")
        print(f"Total <a> links found on page: {total_links}")

        links = page.eval_on_selector_all(
            "a[href*='.pdf'], a[href*='NoticeBoards'], a[href*='attachment'], "
            "a[href*='notice'], a[href*='Notice']",
            "els => els.map(e => ({text: e.innerText.trim(), href: e.href}))"
            ".filter(x => x.text.length > 3)"
        )

        print(f"Matching notice-like links found: {len(links)}")
        for l in links[:5]:
            print(" -", l["text"][:80], "|", l["href"])

        browser.close()

    if not links:
        print("No notice links found — page structure may have changed.")
        return

    latest = links[0]

    existing = {}
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE) as f:
            existing = json.load(f)

    if existing.get("title") != latest["text"]:
        with open(OUTPUT_FILE, "w") as f:
            json.dump({"title": latest["text"], "link": latest["href"]}, f, indent=2)
        print("Updated with new notice:", latest["text"])
    else:
        print("No change.")

if __name__ == "__main__":
    main()
