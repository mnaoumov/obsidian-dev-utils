/** Defines the AST for a field which can be evaluated. */
import { Literal } from "../data-model/value.js";
/** Comparison operators which yield true/false. */
export type CompareOp = ">" | ">=" | "<=" | "<" | "=" | "!=";
/** Arithmetic operators which yield numbers and other values. */
export type ArithmeticOp = "+" | "-" | "*" | "/" | "%" | "&" | "|";
/** All valid binary operators. */
export type BinaryOp = CompareOp | ArithmeticOp;
/** A (potentially computed) field to select or compare against. */
export type Field = BinaryOpField | VariableField | LiteralField | FunctionField | IndexField | NegatedField | LambdaField | ObjectField | ListField;
/** Literal representation of some field type. */
export interface LiteralField {
    type: "literal";
    value: Literal;
}
/** A variable field for a variable with a given name. */
export interface VariableField {
    type: "variable";
    name: string;
}
/** A list, which is an ordered collection of fields. */
export interface ListField {
    type: "list";
    values: Field[];
}
/** An object, which is a mapping of name to field. */
export interface ObjectField {
    type: "object";
    values: Record<string, Field>;
}
/** A binary operator field which combines two subnodes somehow. */
export interface BinaryOpField {
    type: "binaryop";
    left: Field;
    right: Field;
    op: BinaryOp;
}
/** A function field which calls a function on 0 or more arguments. */
export interface FunctionField {
    type: "function";
    /** Either the name of the function being called, or a Function object. */
    func: Field;
    /** The arguments being passed to the function. */
    arguments: Field[];
}
export interface LambdaField {
    type: "lambda";
    /** An ordered list of named arguments. */
    arguments: string[];
    /** The field which should be evaluated with the arguments in context. */
    value: Field;
}
/** A field which indexes a variable into another variable. */
export interface IndexField {
    type: "index";
    /** The field to index into. */
    object: Field;
    /** The index. */
    index: Field;
}
/** A field which negates the value of the original field. */
export interface NegatedField {
    type: "negated";
    /** The child field to negated. */
    child: Field;
}
/** Utility methods for creating & comparing fields. */
export declare namespace Fields {
    function variable(name: string): VariableField;
    function literal(value: Literal): LiteralField;
    function binaryOp(left: Field, op: BinaryOp, right: Field): Field;
    function index(obj: Field, index: Field): IndexField;
    /** Converts a string in dot-notation-format into a variable which indexes. */
    function indexVariable(name: string): Field;
    function lambda(args: string[], value: Field): LambdaField;
    function func(func: Field, args: Field[]): FunctionField;
    function list(values: Field[]): ListField;
    function object(values: Record<string, Field>): ObjectField;
    function negate(child: Field): NegatedField;
    function isCompareOp(op: BinaryOp): op is CompareOp;
    const NULL: LiteralField;
}
