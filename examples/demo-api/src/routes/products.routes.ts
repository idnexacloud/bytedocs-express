/**
 * Products Routes
 */

import { Router } from 'express';
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/products.controller';

const router = Router();

/**
 * Get all products
 * @summary List all products
 * @tag Products
 * @description Retrieve a list of all products with optional filtering by category, price range, and stock status
 */
router.get('/', getAllProducts);

/**
 * Get product by ID
 * @summary Get a specific product
 * @tag Products
 * @param id path string true "Product ID"
 * @description Retrieve detailed information about a specific product
 */
router.get('/:id', getProductById);

/**
 * Create new product
 * @summary Create a new product
 * @tag Products
 * @description Add a new product to the catalog
 */
router.post('/', createProduct);

/**
 * Update product
 * @summary Update an existing product
 * @tag Products
 * @param id path string true "Product ID to update"
 * @description Update product information including name, price, stock, etc.
 */
router.put('/:id', updateProduct);

/**
 * Partially update product
 * @summary Partially update a product
 * @tag Products
 * @param id path string true "Product ID to update"
 * @description Update specific fields of a product
 */
router.patch('/:id', updateProduct);

/**
 * Delete product
 * @summary Delete a product
 * @tag Products
 * @param id path string true "Product ID to delete"
 * @description Remove a product from the catalog
 */
router.delete('/:id', deleteProduct);

export default router;
