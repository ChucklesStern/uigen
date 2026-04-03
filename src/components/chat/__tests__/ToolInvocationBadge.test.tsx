import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import {
  getToolLabel,
  ToolInvocationBadge,
} from "../ToolInvocationBadge";

afterEach(() => {
  cleanup();
});

// --- getToolLabel ---

test("getToolLabel: str_replace_editor create", () => {
  expect(
    getToolLabel("str_replace_editor", { command: "create", path: "/App.jsx" })
  ).toBe("Creating App.jsx");
});

test("getToolLabel: str_replace_editor str_replace", () => {
  expect(
    getToolLabel("str_replace_editor", {
      command: "str_replace",
      path: "/Card.jsx",
    })
  ).toBe("Editing Card.jsx");
});

test("getToolLabel: str_replace_editor insert", () => {
  expect(
    getToolLabel("str_replace_editor", {
      command: "insert",
      path: "/index.js",
    })
  ).toBe("Editing index.js");
});

test("getToolLabel: str_replace_editor view", () => {
  expect(
    getToolLabel("str_replace_editor", { command: "view", path: "/utils.ts" })
  ).toBe("Reading utils.ts");
});

test("getToolLabel: str_replace_editor undo_edit (no path)", () => {
  expect(getToolLabel("str_replace_editor", { command: "undo_edit" })).toBe(
    "Undoing edit"
  );
});

test("getToolLabel: file_manager rename", () => {
  expect(
    getToolLabel("file_manager", { command: "rename", path: "/OldName.jsx" })
  ).toBe("Renaming OldName.jsx");
});

test("getToolLabel: file_manager delete", () => {
  expect(
    getToolLabel("file_manager", {
      command: "delete",
      path: "/Component.jsx",
    })
  ).toBe("Deleting Component.jsx");
});

test("getToolLabel: unknown tool name returns raw tool name", () => {
  expect(getToolLabel("some_other_tool", { command: "run" })).toBe(
    "some_other_tool"
  );
});

test("getToolLabel: extracts filename from nested path", () => {
  expect(
    getToolLabel("str_replace_editor", {
      command: "create",
      path: "/src/components/Button.tsx",
    })
  ).toBe("Creating Button.tsx");
});

// --- ToolInvocationBadge rendering ---

test("ToolInvocationBadge shows spinner when pending", () => {
  render(
    <ToolInvocationBadge
      toolInvocation={{
        toolCallId: "1",
        toolName: "str_replace_editor",
        args: { command: "create", path: "/App.jsx" },
        state: "call",
      }}
    />
  );

  expect(screen.getByText("Creating App.jsx")).toBeDefined();
  // Spinner present (animate-spin class), green dot absent
  const badge = screen.getByText("Creating App.jsx").closest("div");
  expect(badge?.parentElement?.querySelector(".bg-emerald-500")).toBeNull();
  expect(
    badge?.parentElement?.querySelector(".animate-spin")
  ).toBeDefined();
});

test("ToolInvocationBadge shows green dot when result", () => {
  render(
    <ToolInvocationBadge
      toolInvocation={{
        toolCallId: "2",
        toolName: "str_replace_editor",
        args: { command: "create", path: "/App.jsx" },
        state: "result",
        result: "Success",
      }}
    />
  );

  expect(screen.getByText("Creating App.jsx")).toBeDefined();
  const badge = screen.getByText("Creating App.jsx").closest("div");
  expect(badge?.parentElement?.querySelector(".bg-emerald-500")).toBeDefined();
  expect(badge?.parentElement?.querySelector(".animate-spin")).toBeNull();
});

test("ToolInvocationBadge renders label text", () => {
  render(
    <ToolInvocationBadge
      toolInvocation={{
        toolCallId: "3",
        toolName: "file_manager",
        args: { command: "delete", path: "/OldComponent.jsx" },
        state: "result",
        result: { success: true },
      }}
    />
  );

  expect(screen.getByText("Deleting OldComponent.jsx")).toBeDefined();
});
