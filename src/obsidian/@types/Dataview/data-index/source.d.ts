/** AST implementation for queries over data sources. */
/** The source of files for a query. */
export type Source = TagSource | CsvSource | FolderSource | LinkSource | EmptySource | NegatedSource | BinaryOpSource;
/** Valid operations for combining sources. */
export type SourceOp = "&" | "|";
/** A tag as a source of data. */
export interface TagSource {
    type: "tag";
    /** The tag to source from. */
    tag: string;
}
/** A csv as a source of data. */
export interface CsvSource {
    type: "csv";
    /** The path to the CSV file. */
    path: string;
}
/** A folder prefix as a source of data. */
export interface FolderSource {
    type: "folder";
    /** The folder prefix to source from. */
    folder: string;
}
/** Either incoming or outgoing links to a given file. */
export interface LinkSource {
    type: "link";
    /** The file to look for links to/from.  */
    file: string;
    /**
     * The direction to look - if incoming, then all files linking to the target file. If outgoing, then all files
     * which the file links to.
     */
    direction: "incoming" | "outgoing";
}
/** A source which is everything EXCEPT the files returned by the given source. */
export interface NegatedSource {
    type: "negate";
    /** The source to negate. */
    child: Source;
}
/** A source which yields nothing. */
export interface EmptySource {
    type: "empty";
}
/** A source made by combining subsources with a logical operators. */
export interface BinaryOpSource {
    type: "binaryop";
    op: SourceOp;
    left: Source;
    right: Source;
}
/** Utility functions for creating and manipulating sources. */
export declare namespace Sources {
    /** Create a source which searches from a tag. */
    function tag(tag: string): TagSource;
    /** Create a source which fetches from a CSV file. */
    function csv(path: string): CsvSource;
    /** Create a source which searches for files under a folder prefix. */
    function folder(prefix: string): FolderSource;
    /** Create a source which searches for files which link to/from a given file. */
    function link(file: string, incoming: boolean): LinkSource;
    /** Create a source which joins two sources by a logical operator (and/or). */
    function binaryOp(left: Source, op: SourceOp, right: Source): Source;
    /** Create a source which takes the intersection of two sources. */
    function and(left: Source, right: Source): Source;
    /** Create a source which takes the union of two sources. */
    function or(left: Source, right: Source): Source;
    /** Create a source which negates the underlying source. */
    function negate(child: Source): NegatedSource;
    function empty(): EmptySource;
}
