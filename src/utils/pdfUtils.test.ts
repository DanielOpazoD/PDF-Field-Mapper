import { describe, it, expect } from 'vitest';
import { generateId, convertToPdfCoordinates } from './pdfUtils';

describe('pdfUtils', () => {
  describe('generateId', () => {
    it('should generate a string ID', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('convertToPdfCoordinates', () => {
    it('should correctly convert percentage to points', () => {
      const field = { x: 10, y: 10, width: 20, height: 10 };
      const dim = { width: 1000, height: 1000 };
      
      const result = convertToPdfCoordinates(field, dim);
      
      // x = 10% of 1000 = 100
      expect(result.x).toBe(100);
      // width = 20% of 1000 = 200
      expect(result.width).toBe(200);
      // height = 10% of 1000 = 100
      expect(result.height).toBe(100);
      // y = 1000 - (10% + 10%) * 1000 = 1000 - 200 = 800
      expect(result.y).toBe(800);
    });
  });
});
