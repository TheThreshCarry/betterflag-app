/** Hosted collection JSON on the docs site. */
export const POSTMAN_COLLECTION_URL =
  "https://docs.betterflag.app/postman/Betterflag.postman_collection.json";

/** Import-by-URL (no Postman Cloud collection uid). */
export const POSTMAN_IMPORT_URL = `https://app.getpostman.com/run-collection/import?collectionUrl=${encodeURIComponent(POSTMAN_COLLECTION_URL)}`;
