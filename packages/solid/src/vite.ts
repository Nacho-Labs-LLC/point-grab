import { transformSync } from "@babel/core";
import type { NodePath } from "@babel/core";
import * as t from "@babel/types";
import { relative } from "node:path";

export interface PointGrabSolidOptions {
  root?: string;
}

export interface PointGrabSolidVitePlugin {
  name: string;
  enforce: "pre";
  apply: "serve";
  configResolved(config: { root: string }): void;
  transform(code: string, id: string): string | null;
}

const SOURCE_ATTRIBUTE = "data-point-grab-source";
const COMPONENT_ATTRIBUTE = "data-point-grab-component";

function getComponentName(path: NodePath<t.JSXOpeningElement>): string | null {
  // Solid control-flow children are render callbacks, not component boundaries.
  // Walk through those closures to the nearest named, PascalCase component.
  let functionPath = path.getFunctionParent();
  while (functionPath) {
    const node = functionPath.node;
    const parent = functionPath.parentPath?.node;
    const name = t.isFunctionDeclaration(node)
      ? node.id?.name
      : t.isVariableDeclarator(parent) && t.isIdentifier(parent.id)
        ? parent.id.name
        : null;
    if (name && /^[A-Z]/.test(name)) return name;
    functionPath = functionPath.getFunctionParent();
  }
  return null;
}

function isIntrinsicElement(
  name: t.JSXOpeningElement["name"],
): name is t.JSXIdentifier {
  return t.isJSXIdentifier(name) && /^[a-z]/.test(name.name);
}

function hasAttribute(
  attributes: t.JSXOpeningElement["attributes"],
  name: string,
): boolean {
  return attributes.some(
    (attribute) =>
      t.isJSXAttribute(attribute) &&
      t.isJSXIdentifier(attribute.name) &&
      attribute.name.name === name,
  );
}

function sourceLocation(
  filename: string,
  node: t.JSXOpeningElement,
  root: string,
): string | null {
  if (!node.loc) return null;
  const path = relative(root, filename).replaceAll("\\", "/");
  return `${path}:${node.loc.start.line}:${node.loc.start.column + 1}`;
}

export default function pointGrabSolid(
  options: PointGrabSolidOptions = {},
): PointGrabSolidVitePlugin {
  let root = options.root ?? process.cwd();

  return {
    name: "point-grab-solid",
    enforce: "pre",
    apply: "serve",
    configResolved(config) {
      root = options.root ?? config.root;
    },
    transform(code, id) {
      const filename = id.replace(/\?.*$/, "");
      // Test dependencies against the project-relative path, so a checkout that itself
      // lives under a node_modules directory is still instrumented.
      if (!/\.[cm]?[jt]sx$/i.test(filename) || /(^|[\\/])node_modules[\\/]/.test(relative(root, filename)))
        return null;

      const result = transformSync(code, {
        filename,
        configFile: false,
        babelrc: false,
        parserOpts: { plugins: ["jsx", "typescript"] },
        plugins: [
          () => ({
            visitor: {
              JSXOpeningElement(path: NodePath<t.JSXOpeningElement>) {
                if (!isIntrinsicElement(path.node.name)) return;

                const source = sourceLocation(filename, path.node, root);
                if (
                  source &&
                  !hasAttribute(path.node.attributes, SOURCE_ATTRIBUTE)
                ) {
                  path.node.attributes.push(
                    t.jsxAttribute(
                      t.jsxIdentifier(SOURCE_ATTRIBUTE),
                      t.stringLiteral(source),
                    ),
                  );
                }

                const component = getComponentName(path);
                if (
                  component &&
                  !hasAttribute(path.node.attributes, COMPONENT_ATTRIBUTE)
                ) {
                  path.node.attributes.push(
                    t.jsxAttribute(
                      t.jsxIdentifier(COMPONENT_ATTRIBUTE),
                      t.stringLiteral(component),
                    ),
                  );
                }
              },
            },
          }),
        ],
      });

      return result?.code ?? null;
    },
  };
}
