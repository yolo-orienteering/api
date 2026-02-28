import { defineOperationApp } from '@directus/extensions-sdk';

var e0 = defineOperationApp({
  id: "o-mate-news-crawler",
  name: "News Crawler",
  icon: "box",
  description: "Crawling for news for users feed",
  overview: ({ text }) => [
    {
      label: "Text",
      text
    }
  ],
  options: []
});

var e1 = defineOperationApp({
  id: "o-mate-instruction-ai",
  name: "Instruction AI",
  icon: "signpost",
  description: "Get structured data from unstructured instructions using AI.",
  overview: ({ text }) => [
    {
      label: "Text",
      text
    }
  ],
  options: []
});

const interfaces = [];const displays = [];const layouts = [];const modules = [];const panels = [];const themes = [];const operations = [e0,e1];

export { displays, interfaces, layouts, modules, operations, panels, themes };
