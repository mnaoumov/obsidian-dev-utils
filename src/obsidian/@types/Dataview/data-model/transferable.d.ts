/** Simplifies passing dataview values across the JS web worker barrier. */
export declare namespace Transferable {
    /** Convert a literal value to a serializer-friendly transferable value. */
    function transferable(value: any): any;
    /** Convert a transferable value back to a literal value we can work with. */
    function value(transferable: any): any;
}
