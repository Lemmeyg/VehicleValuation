export interface Article {
  id: number;
  title: string;
  excerpt: string;
  category: string;
  readTime: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  price: string;
  description: string;
  features: string[];
  recommended?: boolean;
}

export interface DirectoryItem {
  id: number;
  name: string;
  role: string;
  location: string;
  rating: number;
  reviewCount: number;
  image: string;
}
