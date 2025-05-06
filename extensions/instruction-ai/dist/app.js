import { defineOperationApp } from '@directus/extensions-sdk';

var app = defineOperationApp({
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

export { app as default };
