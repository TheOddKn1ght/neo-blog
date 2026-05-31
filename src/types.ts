export type PostMeta = {
  slug: string;
  title: string;
  date: string;
  description: string;
};

export type Post = PostMeta & { html: string };

export type Page = {
  slug: string;
  title: string;
  description: string;
  html: string;
};

export type SiteIndex = {
  posts: PostMeta[];
  gallery: string[];
};
