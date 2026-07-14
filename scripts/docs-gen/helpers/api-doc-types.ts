/**
 * @file
 *
 * Shared data-model types for the API documentation generator.
 */

export interface EnumMemberInfo {
  description: string;
  name: string;
  value: string;
}

export interface LinkMatchGroups {
  display?: string;
  target: string;
}

export interface MarkdownSegment {
  lang?: string;
  text: string;
  type: 'code' | 'prose';
}

export interface MemberInfo {
  description: string;
  examples: string[];
  inheritedFrom: string;
  isStatic: boolean;
  name: string;
  overloadKey: string;
  parameters: ParameterInfo[];
  remarks: string;
  returnDescription: string;
  returnType: string;
  signature: string;
  since: string;
  type: string;
}

export interface PageContent {
  content: string;
  filePath: string;
}

export interface ParameterInfo {
  description: string;
  name: string;
  type: string;
}

export interface ReturnTypeProvider {
  getReturnType(): TextProvider;
  getReturnTypeNode?(): TextProvider | undefined;
}

export interface SidebarEntry {
  collapsed: boolean;
  items: (SidebarEntry | SidebarLink)[];
  label: string;
}

export interface SidebarLink {
  label: string;
  link: string;
}

/** Recursive tree node for building the sidebar */
export interface SidebarTreeNode {
  children: Map<string, SidebarTreeNode>;
  types: TypeInfo[];
}

export interface TextProvider {
  getText(): string;
}

export interface TypeInfo {
  baseTypes: string[];
  /** For classes: the constructor (public/protected), if any */
  constructorInfo?: MemberInfo;
  description: string;
  /** For enums: the enum members */
  enumMembers: EnumMemberInfo[];
  examples: string[];
  /** For classes: types in the `implements` clause */
  implementsTypes: string[];
  kind: 'class' | 'enum' | 'function' | 'interface' | 'type' | 'variable';
  methods: MemberInfo[];
  name: string;
  namespace: string;
  properties: MemberInfo[];
  remarks: string;
  /** For type aliases: the right-hand-side type text */
  typeAliasText?: string;
  typeParameters: string[];
  /** For variables: the declaration keyword (let/const/var) */
  variableKeyword?: string;
  /** For variables: the type annotation */
  variableType?: string;
}

export interface WebApiEntry {
  url: string;
}
