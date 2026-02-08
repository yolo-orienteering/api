import { defineOperationApp } from '@directus/extensions-sdk';

var app = defineOperationApp({
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

export { app as default };
