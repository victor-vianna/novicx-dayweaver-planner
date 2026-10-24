// Facade: the UI imports from here; VITE_DATA_SOURCE picks the implementation.
import { isMockMode } from "@/lib/data-source";

import * as mock from "./mock/posts";
import * as remote from "./supabase/posts";

export type { NewPostInput, PostPatch } from "./mock/posts";

const impl = (): typeof mock => (isMockMode() ? mock : remote);

export const listPosts: typeof mock.listPosts = (...args) => impl().listPosts(...args);
export const getPost: typeof mock.getPost = (...args) => impl().getPost(...args);
export const updatePost: typeof mock.updatePost = (...args) => impl().updatePost(...args);
export const markPostPublished: typeof mock.markPostPublished = (...args) =>
  impl().markPostPublished(...args);
export const unmarkPostPublished: typeof mock.unmarkPostPublished = (...args) =>
  impl().unmarkPostPublished(...args);
export const setPostMedia: typeof mock.setPostMedia = (...args) => impl().setPostMedia(...args);
export const listUpcomingDeliveries: typeof mock.listUpcomingDeliveries = (...args) =>
  impl().listUpcomingDeliveries(...args);
export const createPost: typeof mock.createPost = (...args) => impl().createPost(...args);
