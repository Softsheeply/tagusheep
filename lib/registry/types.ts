export type RnRegistryEntry = {
  rn: string;
  rnType?: string | null;
  legalName?: string | null;
  productLines?: string[];
  ftcDetailUrl?: string | null;
  source: "ftc" | "import" | "manual";
  fetchedAt?: string | null;
  hitCount?: number;
};

export type CaRegistryEntry = {
  ca: string;
  legalName?: string | null;
  address?: string | null;
  province?: string | null;
  dateIssued?: string | null;
  source: "ca_bureau" | "import" | "manual";
  fetchedAt?: string | null;
  hitCount?: number;
};

export type BrandAliasEntry = {
  id: string;
  rn?: string | null;
  ca?: string | null;
  retailBrand: string;
  confidence: "community" | "curated" | "ocr";
  confirmCount: number;
  notes?: string | null;
};

export type TagSnapMatch = {
  id: string;
  brand?: string | null;
  productName?: string | null;
  rn?: string | null;
  styleNumber?: string | null;
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
};

export type TagSnapDecodeResult = {
  extracted: {
    rn: string | null;
    ca: string | null;
    wpl: string | null;
    styleNumber: string | null;
    brandFromTag: string | null;
    rawText?: string | null;
  };
  rnRegistry: RnRegistryEntry | null;
  caRegistry: CaRegistryEntry | null;
  retailBrand: string | null;
  retailBrandSource: "alias" | "tag_ocr" | "tagsheep" | null;
  matchingTags: TagSnapMatch[];
  cache: {
    rnHit: boolean;
    caHit: boolean;
  };
  timingMs: number;
};
