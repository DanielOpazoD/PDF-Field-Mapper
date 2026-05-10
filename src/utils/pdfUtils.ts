/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PageDimension } from '../types';

/**
 * Generates a unique identifier using crypto.randomUUID if available,
 * otherwise falls back to a random string.
 * @returns {string} A unique ID.
 */
export const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15);
};

/**
 * Converts percentage-based coordinates to PDF point coordinates.
 * In PDF, (0,0) is bottom-left, while in web it's top-left.
 * @param field The field with percentage coordinates (0-100).
 * @param dim The dimensions of the PDF page in points.
 * @returns An object with PDF coordinates (x, y, width, height).
 */
export const convertToPdfCoordinates = (
  field: { x: number; y: number; width: number; height: number },
  dim: PageDimension
) => {
  const pdfX = (field.x / 100) * dim.width;
  const pdfW = (field.width / 100) * dim.width;
  const pdfH = (field.height / 100) * dim.height;
  const pdfY = dim.height - ((field.y + field.height) / 100) * dim.height;

  return {
    x: Number(pdfX.toFixed(2)),
    y: Number(pdfY.toFixed(2)),
    width: Number(pdfW.toFixed(2)),
    height: Number(pdfH.toFixed(2))
  };
};
