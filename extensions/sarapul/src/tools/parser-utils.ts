import { parseHTML } from "linkedom";

export type ParsedNewsItem = {
  title: string;
  content: string;
  url: string;
  date?: number;
};

export type RssItem = {
  title: string;
  content: string;
  link?: string;
  date?: number;
};

export function parseAdmSarapulHtml(html: string, limit: number = 10): ParsedNewsItem[] {
  const { document } = parseHTML(html);
  const items: ParsedNewsItem[] = [];

  const newsElements = document.querySelectorAll(".news-item, .news__item, article, .item");

  for (const el of newsElements) {
    if (items.length >= limit) {
      break;
    }

    const titleEl = el.querySelector("h2, h3, h4, .title, .news-title, a");
    const contentEl = el.querySelector("p, .content, .description, .preview, .text");
    const linkEl = el.querySelector("a[href]");
    const dateEl = el.querySelector("time, .date, .news-date");

    const title = titleEl?.textContent?.trim() ?? "";
    const content = contentEl?.textContent?.trim() ?? "";
    const href = linkEl?.getAttribute("href") ?? "";
    const dateStr = dateEl?.textContent?.trim() ?? "";

    if (!title || title.length < 5) {
      continue;
    }

    let url = href;
    if (href && !href.startsWith("http")) {
      url = href.startsWith("/")
        ? `https://adm-sarapul.ru${href}`
        : `https://adm-sarapul.ru/news/${href}`;
    }

    const date = parseRussianDate(dateStr);

    items.push({ title, content: content || title, url, date });
  }

  if (items.length === 0) {
    const links = document.querySelectorAll("a[href*='/news/']");
    for (const link of links) {
      if (items.length >= limit) {
        break;
      }

      const title = link.textContent?.trim() ?? "";
      const href = link.getAttribute("href") ?? "";

      if (!title || title.length < 5) {
        continue;
      }

      const url = href.startsWith("http")
        ? href
        : href.startsWith("/")
          ? `https://adm-sarapul.ru${href}`
          : `https://adm-sarapul.ru/${href}`;

      items.push({ title, content: title, url, date: undefined });
    }
  }

  return items;
}

export function parseRssFeed(xml: string): RssItem[] {
  const { document } = parseHTML(xml);
  const items: RssItem[] = [];

  const itemElements = document.querySelectorAll("item, entry");

  for (const el of itemElements) {
    const titleEl = el.querySelector("title");
    const contentEl = el.querySelector("description, content, summary, content\\:encoded");
    const linkEl = el.querySelector("link, guid");
    const dateEl = el.querySelector("pubDate, published, updated, dc\\:date");

    const title = titleEl?.textContent?.trim() ?? "";
    const content = contentEl?.textContent?.trim() ?? "";
    const link = linkEl?.getAttribute("href") ?? linkEl?.textContent?.trim() ?? "";
    const dateStr = dateEl?.textContent?.trim() ?? "";

    if (!title) {
      continue;
    }

    items.push({
      title,
      content: content || title,
      link,
      date: parseRssDate(dateStr),
    });
  }

  return items;
}

function parseRussianDate(dateStr: string): number | undefined {
  if (!dateStr) {
    return undefined;
  }

  const months: Record<string, number> = {
    "января": 0, "февраля": 1, "марта": 2, "апреля": 3,
    "мая": 4, "июня": 5, "июля": 6, "августа": 7,
    "сентября": 8, "октября": 9, "ноября": 10, "декабря": 11,
  };

  const match = dateStr.match(/(\d{1,2})\s+([а-яё]+)\s+(\d{4})/i);
  if (match) {
    const day = parseInt(match[1], 10);
    const monthName = match[2].toLowerCase();
    const year = parseInt(match[3], 10);
    const month = months[monthName];
    if (month !== undefined) {
      return new Date(year, month, day).getTime();
    }
  }

  const isoMatch = dateStr.match(/\d{4}-\d{2}-\d{2}/);
  if (isoMatch) {
    return new Date(isoMatch[0]).getTime();
  }

  return undefined;
}

function parseRssDate(dateStr: string): number | undefined {
  if (!dateStr) {
    return undefined;
  }

  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date.getTime();
  }

  return undefined;
}
