export type PostMeta = {
  slug: string;
  title: string;
  date: string;
  description: string;
  image?: string;
  imageAlt?: string;
};

export type Post = PostMeta & { html: string };

export type Page = {
  slug: string;
  title: string;
  description: string;
  html: string;
  image?: string;
  imageAlt?: string;
};

export type GalleryItem = {
  src: string;
  alt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOptionalString(value: Record<string, unknown>, key: string): boolean {
  return value[key] === undefined || typeof value[key] === "string";
}

export function isPostMeta(value: unknown): value is PostMeta {
  if (!isRecord(value)) return false;
  return (
    typeof value.slug === "string" &&
    typeof value.title === "string" &&
    typeof value.date === "string" &&
    typeof value.description === "string" &&
    hasOptionalString(value, "image") &&
    hasOptionalString(value, "imageAlt")
  );
}

export function isPost(value: unknown): value is Post {
  return isPostMeta(value) && typeof (value as Record<string, unknown>).html === "string";
}

export function isPage(value: unknown): value is Page {
  if (!isRecord(value)) return false;
  return (
    typeof value.slug === "string" &&
    typeof value.title === "string" &&
    typeof value.description === "string" &&
    typeof value.html === "string" &&
    hasOptionalString(value, "image") &&
    hasOptionalString(value, "imageAlt")
  );
}

export function isGalleryItem(value: unknown): value is GalleryItem {
  return isRecord(value) && typeof value.src === "string" && typeof value.alt === "string";
}

export function isPostIndex(value: unknown): value is PostMeta[] {
  return Array.isArray(value) && value.every(isPostMeta);
}

export function isGalleryIndex(value: unknown): value is GalleryItem[] {
  return Array.isArray(value) && value.every(isGalleryItem);
}
