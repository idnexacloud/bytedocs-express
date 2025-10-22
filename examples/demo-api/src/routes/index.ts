/**
 * API Routes Index
 */

import { Router, Request, Response } from 'express';
import usersRoutes from './users.routes';
import productsRoutes from './products.routes';

const router = Router();

/**
 * Health check endpoint
 * @summary API Health Check
 * @tag System
 * @description Check if the API is running and healthy
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

/**
 * API Information
 * @summary Get API Information
 * @tag System
 * @description Get general information about the API
 */
router.get('/info', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      name: 'Demo API',
      version: '1.0.0',
      description: 'A demo API showcasing ByteDocs Express',
      documentation: '/docs',
      endpoints: {
        users: '/api/users',
        products: '/api/products',
        health: '/api/health',
      },
    },
  });
});

// Mount resource routes
router.use('/users', usersRoutes);
router.use('/products', productsRoutes);

export default router;
