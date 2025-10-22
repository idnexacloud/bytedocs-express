/**
 * Products Controller
 */

import { Request, Response } from 'express';
import { Product, CreateProductDTO, UpdateProductDTO } from '../types';

// Mock database
const products: Product[] = [
  {
    id: 1,
    name: 'Laptop',
    description: 'High-performance laptop for developers',
    price: 999.99,
    stock: 50,
    category: 'Electronics',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 2,
    name: 'Wireless Mouse',
    description: 'Ergonomic wireless mouse',
    price: 29.99,
    stock: 200,
    category: 'Accessories',
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
  },
  {
    id: 3,
    name: 'Mechanical Keyboard',
    description: 'RGB mechanical keyboard with blue switches',
    price: 149.99,
    stock: 75,
    category: 'Accessories',
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date('2024-01-03'),
  },
];

let nextProductId = 4;

/**
 * Get all products
 */
export const getAllProducts = (req: Request, res: Response) => {
  const { category, minPrice, maxPrice, inStock } = req.query;

  let filteredProducts = [...products];

  if (category) {
    filteredProducts = filteredProducts.filter(
      p => p.category.toLowerCase() === String(category).toLowerCase()
    );
  }

  if (minPrice) {
    filteredProducts = filteredProducts.filter(
      p => p.price >= parseFloat(String(minPrice))
    );
  }

  if (maxPrice) {
    filteredProducts = filteredProducts.filter(
      p => p.price <= parseFloat(String(maxPrice))
    );
  }

  if (inStock === 'true') {
    filteredProducts = filteredProducts.filter(p => p.stock > 0);
  }

  res.json({
    success: true,
    data: filteredProducts,
    total: filteredProducts.length,
  });
};

/**
 * Get product by ID
 */
export const getProductById = (req: Request, res: Response) => {
  const { id } = req.params;
  const product = products.find(p => p.id === parseInt(id));

  if (!product) {
    return res.status(404).json({
      success: false,
      error: 'Product not found',
    });
  }

  res.json({
    success: true,
    data: product,
  });
};

/**
 * Create new product
 */
export const createProduct = (req: Request, res: Response) => {
  const productData: CreateProductDTO = req.body;

  if (!productData.name || !productData.price || !productData.category) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: name, price, category',
    });
  }

  const newProduct: Product = {
    id: nextProductId++,
    name: productData.name,
    description: productData.description || '',
    price: productData.price,
    stock: productData.stock || 0,
    category: productData.category,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  products.push(newProduct);

  res.status(201).json({
    success: true,
    data: newProduct,
    message: 'Product created successfully',
  });
};

/**
 * Update product
 */
export const updateProduct = (req: Request, res: Response) => {
  const { id } = req.params;
  const productData: UpdateProductDTO = req.body;

  const productIndex = products.findIndex(p => p.id === parseInt(id));

  if (productIndex === -1) {
    return res.status(404).json({
      success: false,
      error: 'Product not found',
    });
  }

  const updatedProduct = {
    ...products[productIndex],
    ...productData,
    updatedAt: new Date(),
  };

  products[productIndex] = updatedProduct;

  res.json({
    success: true,
    data: updatedProduct,
    message: 'Product updated successfully',
  });
};

/**
 * Delete product
 */
export const deleteProduct = (req: Request, res: Response) => {
  const { id } = req.params;
  const productIndex = products.findIndex(p => p.id === parseInt(id));

  if (productIndex === -1) {
    return res.status(404).json({
      success: false,
      error: 'Product not found',
    });
  }

  products.splice(productIndex, 1);

  res.status(204).send();
};
