/// <reference types="vite/client" />

// swagger-ui-dist ships no types for its bundle (ui/api.ts)
declare module 'swagger-ui-dist/swagger-ui-es-bundle.js' {
  const SwaggerUIBundle: (options: Record<string, unknown>) => unknown
  export default SwaggerUIBundle
}
declare module 'swagger-ui-dist/swagger-ui.css'
