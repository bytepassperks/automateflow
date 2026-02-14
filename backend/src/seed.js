const { Template } = require('./models');

const templates = [
  {
    name: 'LinkedIn Profile Scraper',
    slug: 'linkedin-scraper',
    description: 'Extract profile data from a LinkedIn profile URL including name, headline, experience, and education.',
    category: 'Scraping',
    script: 'linkedin_scraper',
    parameters: {
      type: 'object',
      properties: {
        profileUrl: {
          type: 'string',
          description: 'LinkedIn profile URL to scrape',
        },
      },
      required: ['profileUrl'],
    },
    requiredFields: ['profileUrl'],
    tags: ['linkedin', 'scraping', 'profile'],
    isPublic: true,
    successRate: 85.0,
  },
  {
    name: 'Product Price Monitor',
    slug: 'price-monitor',
    description: 'Monitor a product page and check if the current price is below your target price.',
    category: 'Monitoring',
    script: 'price_monitor',
    parameters: {
      type: 'object',
      properties: {
        productUrl: {
          type: 'string',
          description: 'URL of the product page',
        },
        targetPrice: {
          type: 'number',
          description: 'Target price threshold',
        },
      },
      required: ['productUrl', 'targetPrice'],
    },
    requiredFields: ['productUrl', 'targetPrice'],
    tags: ['price', 'monitoring', 'ecommerce'],
    isPublic: true,
    successRate: 90.0,
  },
  {
    name: 'Form Auto-Filler',
    slug: 'form-filler',
    description: 'Automatically fill out a web form with provided field values and optionally submit it.',
    category: 'Automation',
    script: 'form_filler',
    parameters: {
      type: 'object',
      properties: {
        formUrl: {
          type: 'string',
          description: 'URL of the form page',
        },
        fieldValues: {
          type: 'object',
          description: 'Key-value pairs of form field names and values',
        },
        submit: {
          type: 'boolean',
          description: 'Whether to submit the form after filling',
          default: false,
        },
      },
      required: ['formUrl', 'fieldValues'],
    },
    requiredFields: ['formUrl', 'fieldValues'],
    tags: ['form', 'automation', 'fill'],
    isPublic: true,
    successRate: 88.0,
  },
  {
    name: 'Screenshot Generator',
    slug: 'screenshot-generator',
    description: 'Take a screenshot of any webpage with configurable viewport size and full-page option.',
    category: 'Utility',
    script: 'screenshot_generator',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL to screenshot',
        },
        viewport: {
          type: 'object',
          properties: {
            width: { type: 'number', default: 1920 },
            height: { type: 'number', default: 1080 },
          },
          description: 'Viewport dimensions',
        },
        fullPage: {
          type: 'boolean',
          description: 'Capture full page scroll',
          default: false,
        },
      },
      required: ['url'],
    },
    requiredFields: ['url'],
    tags: ['screenshot', 'utility', 'capture'],
    isPublic: true,
    successRate: 95.0,
  },
  {
    name: 'PDF Invoice Downloader',
    slug: 'pdf-invoice-downloader',
    description: 'Log into a portal and download PDF invoices by identifier.',
    category: 'Document',
    script: 'pdf_invoice_downloader',
    parameters: {
      type: 'object',
      properties: {
        portalUrl: {
          type: 'string',
          description: 'URL of the invoice portal',
        },
        loginCredentials: {
          type: 'object',
          properties: {
            username: { type: 'string' },
            password: { type: 'string' },
          },
          description: 'Login credentials for the portal',
        },
        invoiceIdentifier: {
          type: 'string',
          description: 'Invoice number or identifier to download',
        },
      },
      required: ['portalUrl', 'loginCredentials', 'invoiceIdentifier'],
    },
    requiredFields: ['portalUrl', 'loginCredentials', 'invoiceIdentifier'],
    tags: ['pdf', 'invoice', 'download', 'document'],
    isPublic: true,
    successRate: 80.0,
  },
];

async function seedTemplates() {
  try {
    const count = await Template.count();
    if (count === 0) {
      await Template.bulkCreate(templates);
      console.log('Seeded 5 templates');
    } else {
      console.log(`Templates already exist (${count}), skipping seed`);
    }
  } catch (err) {
    console.error('Seed error:', err.message);
  }
}

module.exports = { seedTemplates };

if (require.main === module) {
  seedTemplates().then(() => process.exit(0));
}
