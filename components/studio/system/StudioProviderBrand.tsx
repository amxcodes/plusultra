import React from 'react';

export type StudioProvider = {
  id: number;
  name: string;
  label: string;
  mark: string;
  brand: 'netflix' | 'disney' | 'prime' | 'apple' | 'hulu' | 'max';
};

export const studioProviders: StudioProvider[] = [
  { id: 8, name: 'Netflix', label: 'Netflix', mark: 'N', brand: 'netflix' },
  { id: 337, name: 'Disney+', label: 'Disney+', mark: 'Disney+', brand: 'disney' },
  { id: 9, name: 'Prime Video', label: 'Prime Video', mark: 'prime', brand: 'prime' },
  { id: 350, name: 'Apple TV+', label: 'Apple TV+', mark: 'tv+', brand: 'apple' },
  { id: 15, name: 'Hulu', label: 'Hulu', mark: 'hulu', brand: 'hulu' },
  { id: 1899, name: 'Max', label: 'Max', mark: 'max', brand: 'max' },
];

interface StudioProviderMarkProps {
  provider: StudioProvider;
  className?: string;
}

export const StudioProviderMark: React.FC<StudioProviderMarkProps> = ({ provider, className = '' }) => (
  <span className={`studio-news-provider__mark studio-news-provider__mark--${provider.brand} ${className}`} aria-hidden="true">
    {provider.mark}
  </span>
);
