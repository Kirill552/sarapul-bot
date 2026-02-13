import { describe, it, expect } from "vitest";
import { parseAdmSarapulHtml, parseRssFeed } from "../src/tools/parser-utils.js";

describe("parser-utils", () => {
  describe("parseAdmSarapulHtml", () => {
    it("should parse news items from HTML with .news-item class", () => {
      const html = `
        <html>
          <body>
            <div class="news-item">
              <h2 class="title">First News</h2>
              <p class="content">First content</p>
              <a href="/news/1">Read more</a>
              <span class="date">15 февраля 2026</span>
            </div>
            <div class="news-item">
              <h2 class="title">Second News</h2>
              <p class="content">Second content</p>
              <a href="/news/2">Read more</a>
            </div>
          </body>
        </html>
      `;

      const items = parseAdmSarapulHtml(html, 10);

      expect(items).toHaveLength(2);
      expect(items[0].title).toBe("First News");
      expect(items[0].content).toBe("First content");
      expect(items[0].url).toBe("https://adm-sarapul.ru/news/1");
      expect(items[0].date).toBeDefined();
    });

    it("should respect limit parameter", () => {
      const html = `
        <html><body>
          <div class="news-item"><h2>News 1</h2></div>
          <div class="news-item"><h2>News 2</h2></div>
          <div class="news-item"><h2>News 3</h2></div>
        </body></html>
      `;

      const items = parseAdmSarapulHtml(html, 2);

      expect(items).toHaveLength(2);
    });

    it("should skip items with short titles", () => {
      const html = `
        <html><body>
          <div class="news-item"><h2>Ab</h2><p>Content</p></div>
          <div class="news-item"><h2>Valid Title Here</h2><p>Content</p></div>
        </body></html>
      `;

      const items = parseAdmSarapulHtml(html);

      expect(items).toHaveLength(1);
      expect(items[0].title).toBe("Valid Title Here");
    });

    it("should fallback to parsing links with /news/", () => {
      const html = `
        <html><body>
          <a href="/news/article-1">Fallback News Title</a>
          <a href="/news/article-2">Another Fallback</a>
        </body></html>
      `;

      const items = parseAdmSarapulHtml(html);

      expect(items.length).toBeGreaterThan(0);
      expect(items[0].url).toContain("adm-sarapul.ru");
    });

    it("should handle absolute URLs in links", () => {
      const html = `
        <html><body>
          <div class="news-item">
            <h2>External Link</h2>
            <a href="https://example.com/news/1">Link</a>
          </div>
        </body></html>
      `;

      const items = parseAdmSarapulHtml(html);

      expect(items[0].url).toBe("https://example.com/news/1");
    });
  });

  describe("parseRssFeed", () => {
    it("should parse RSS 2.0 feed", () => {
      const xml = `
        <?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <title>Test Feed</title>
            <item>
              <title>RSS Item 1</title>
              <description>Description 1</description>
              <link>https://example.com/1</link>
              <pubDate>Wed, 12 Feb 2026 10:00:00 GMT</pubDate>
            </item>
            <item>
              <title>RSS Item 2</title>
              <description>Description 2</description>
              <link>https://example.com/2</link>
            </item>
          </channel>
        </rss>
      `;

      const items = parseRssFeed(xml);

      expect(items).toHaveLength(2);
      expect(items[0].title).toBe("RSS Item 1");
      expect(items[0].content).toBe("Description 1");
      expect(items[0].date).toBeDefined();
    });

    it("should parse Atom feed", () => {
      const xml = `
        <?xml version="1.0"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <title>Atom Feed</title>
          <entry>
            <title>Atom Entry</title>
            <content>Atom content</content>
            <link href="https://example.com/atom/1"/>
            <published>2026-02-12T10:00:00Z</published>
          </entry>
        </feed>
      `;

      const items = parseRssFeed(xml);

      expect(items).toHaveLength(1);
      expect(items[0].title).toBe("Atom Entry");
    });

    it("should skip items without title", () => {
      const xml = `
        <rss version="2.0">
          <channel>
            <item>
              <description>No title here</description>
            </item>
            <item>
              <title>Valid Item</title>
              <description>Has title</description>
            </item>
          </channel>
        </rss>
      `;

      const items = parseRssFeed(xml);

      expect(items).toHaveLength(1);
    });

    it("should use title as content when description missing", () => {
      const xml = `
        <rss version="2.0">
          <channel>
            <item>
              <title>Title Only</title>
            </item>
          </channel>
        </rss>
      `;

      const items = parseRssFeed(xml);

      expect(items[0].content).toBe("Title Only");
    });
  });
});
