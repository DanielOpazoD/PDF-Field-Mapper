/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Field {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  variableName: string;
}

export interface PageDimension {
  width: number;
  height: number;
}

export type InteractionMode = 'select' | 'draw' | 'hand';

export interface NotificationState {
  message: string;
  type: 'success' | 'error';
}
