const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

// Load swagger file YAML
const swaggerDocument = YAML.load(path.join(__dirname, '../swagger.yaml'));

const swaggerOptions = {
  definition: swaggerDocument,
  apis: ['./routes/*.js'], // Đường dẫn đến các file route
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

const swaggerUiOptions = {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Server NodeJS API Documentation',
  swaggerOptions: {
    docExpansion: 'none',
    filter: true,
    showRequestHeaders: true,
  },
};

module.exports = {
  swaggerUi,
  swaggerSpec: swaggerDocument,
  swaggerUiOptions,
};
