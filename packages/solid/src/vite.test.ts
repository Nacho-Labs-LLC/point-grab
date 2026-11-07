import { describe, expect, it } from "vitest";
import pointGrabSolid from "./vite";

describe("pointGrabSolid", () => {
  it("annotates intrinsic JSX with source and component metadata before Solid compiles it", async () => {
    const plugin = pointGrabSolid({ root: "/project" });
    const output = await plugin.transform?.(
      "export function Card() {\n  return <button>Save</button>;\n}\n",
      "/project/src/components/Card.tsx",
    );
    const code = output;

    expect(code).toContain(
      'data-point-grab-source="src/components/Card.tsx:2:10"',
    );
    expect(code).toContain('data-point-grab-component="Card"');
  });

  it("uses a variable name for arrow-function components", async () => {
    const plugin = pointGrabSolid({ root: "/project" });
    const output = await plugin.transform?.(
      "const Card = () => <button>Save</button>;\n",
      "/project/src/components/Card.tsx",
    );

    expect(output).toContain('data-point-grab-component="Card"');
  });

  it("retains the owning component through For and Show render callbacks", () => {
    const code = pointGrabSolid({ root: "/project" }).transform(
      "function Catalog() { return <For each={items}>{item => <Show when={item.visible}>{() => <button>{item.name}</button>}</Show>}</For>; }",
      "/project/src/Catalog.tsx",
    );
    expect(code).toContain('data-point-grab-component="Catalog"');
  });

  it("uses the resolved Vite root rather than the shell working directory", () => {
    const plugin = pointGrabSolid();
    plugin.configResolved?.({ root: "/project" });
    expect(
      plugin.transform("const Card = () => <p />;", "/project/src/Card.tsx"),
    ).toContain('data-point-grab-source="src/Card.tsx:1:20"');
  });

  it("keeps explicit root overrides and existing user metadata", () => {
    const plugin = pointGrabSolid({ root: "/workspace" });
    plugin.configResolved({ root: "/workspace/app" });
    const output = plugin.transform(
      'function Card() { return <div data-point-grab-component="Manual" data-point-grab-source="custom.tsx:1:1" />; }',
      "/workspace/app/Card.tsx",
    );
    expect(output?.match(/data-point-grab-component=/g)).toHaveLength(1);
    expect(output).toContain('data-point-grab-component="Manual"');
    expect(output).toContain('data-point-grab-source="custom.tsx:1:1"');
    expect(
      plugin.transform(
        "const Card = () => <div />;",
        "/workspace/app/Card.tsx?import",
      ),
    ).toContain("app/Card.tsx:1:20");
  });

  it("skips dependencies and non-JSX modules", () => {
    const plugin = pointGrabSolid();
    expect(
      plugin.transform("export const n = 1;", "/project/src/data.ts"),
    ).toBeNull();
    expect(
      plugin.transform(
        "const Card = () => <div />;",
        "/project/node_modules/vendor/Card.tsx",
      ),
    ).toBeNull();
  });

  it("runs only in Vite dev mode so metadata is not shipped to production", () => {
    expect(pointGrabSolid().apply).toBe("serve");
  });

  it("does not annotate JSX components because they do not produce DOM elements directly", async () => {
    const plugin = pointGrabSolid({ root: "/project" });
    const output = await plugin.transform?.(
      "export function App() {\n  return <Card />;\n}\n",
      "/project/src/App.tsx",
    );
    const code = output;

    expect(code).not.toContain("data-point-grab-source");
  });
});
