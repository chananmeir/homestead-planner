-- Migration: Add variety columns to planted_item and planting_event tables
-- Created: 2025-11-11
-- Description: Adds support for specific plant varieties (e.g., "Brandywine", "Roma", "Red Leaf")

-- Add variety column to planted_item table
ALTER TABLE planted_item ADD COLUMN variety VARCHAR(100);

-- Add variety column to planting_event table
ALTER TABLE planting_event ADD COLUMN variety VARCHAR(100);
