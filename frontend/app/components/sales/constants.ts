import { Dimensions } from 'react-native';

export const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const { width } = Dimensions.get('window');
export const isDesktop = width > 768;
export const SCREEN_WIDTH = width;

// Quick amount buttons
export const QUICK_AMOUNTS = [20, 25, 50, 100, 200];

// Default amount for new plays
export const DEFAULT_AMOUNT = '20';
