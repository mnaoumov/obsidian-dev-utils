import type { Link } from '../data-model/value.d.ts';
export declare const IMAGE_EXTENSIONS: Readonly<Set<string>>;
/** Determines if the given link points to an embedded image. */
export declare function isImageEmbed(link: Link): boolean;
/** Extract text of the form 'WxH' or 'W' from the display of a link. */
export declare function extractImageDimensions(link: Link): [number, number] | [number] | undefined;
