export type SupportedSite = 'linkedin' | 'google_maps' | 'website';

export type Prospect = {
	name: string;
	role?: string;
	company?: string;
	sector?: string;
	sourceUrl?: string;
	notes?: string;
};

export type ICP = {
	country?: string;
	sectors?: string[];
	sizeMin?: number;
	sizeMax?: number;
	roles?: string[];
	excludes?: string[];
	signals?: string[];
	googleRatingMax?: number;
};

export type ScoreResult = {
	score: number;
	reasons: string[];
};

export type Features = {
	country?: string;
	sectorText?: string;
	employeeCount?: number;
	websiteUrl?: string;
	technologies?: string[];
	googleRating?: number;
	textBlob?: string;
};


