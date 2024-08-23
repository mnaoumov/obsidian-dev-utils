import { dirname } from "path";
import { basename, extname } from "../Path.ts";
import type {
  DataviewInlineApi,
  Link
} from "./Dataview.ts";

export function fixTitle(dv: DataviewInlineApi, path: string, isFolderNote?: boolean): Link {
  const ext = extname(path);
  const title = isFolderNote ? basename(dirname(path)) : basename(path, ext);
  return dv.fileLink(path, false, title);
}

export function makeLinkWithPath(link: Link): string {
  return `${link.toString()} (${link.path})`;
}
