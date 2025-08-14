-- Add category column to inventory_items table
ALTER TABLE public.inventory_items 
ADD COLUMN category TEXT NOT NULL DEFAULT 'media equipment';