import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';


// Proxy middleware options
const pythonApiOptions = {
    target: 'http://localhost:8000',
    changeOrigin: true,
    pathRewrite: { '^/edtech': '' }, // Remove /edtech prefix when forwarding
    onProxyReq: (proxyReq: any, _req: express.Request, _res: express.Response) => {
        // Log the request being proxied
        console.log(`Proxying edtech request to: ${proxyReq.path}`);
    },
    onError: (err: Error, _req: express.Request, res: express.Response) => {
        console.error('Edtech proxy error:', err);
        res.status(500).json({ error: 'Unable to connect to Python API server' });
    }
};

// Create the proxy middleware
const pythonApiProxy = createProxyMiddleware(pythonApiOptions);

// Apply the proxy middleware to the /api/edtech path

export default pythonApiProxy;