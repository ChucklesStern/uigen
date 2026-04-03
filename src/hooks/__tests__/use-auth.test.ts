import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock server actions
vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";

const mockSignIn = vi.mocked(signInAction);
const mockSignUp = vi.mocked(signUpAction);
const mockGetProjects = vi.mocked(getProjects);
const mockCreateProject = vi.mocked(createProject);
const mockGetAnonWorkData = vi.mocked(getAnonWorkData);
const mockClearAnonWork = vi.mocked(clearAnonWork);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAnonWorkData.mockReturnValue(null);
});

describe("useAuth", () => {
  describe("initial state", () => {
    test("isLoading starts as false", () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(false);
    });

    test("exposes signIn, signUp, and isLoading", () => {
      const { result } = renderHook(() => useAuth());
      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
      expect(typeof result.current.isLoading).toBe("boolean");
    });
  });

  describe("signIn", () => {
    describe("happy path — credentials valid, no anon work, existing projects", () => {
      test("redirects to most recent project", async () => {
        mockSignIn.mockResolvedValue({ success: true });
        mockGetProjects.mockResolvedValue([
          { id: "proj-1", name: "Project 1", createdAt: new Date(), updatedAt: new Date() },
          { id: "proj-2", name: "Project 2", createdAt: new Date(), updatedAt: new Date() },
        ]);

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password123");
        });

        expect(mockPush).toHaveBeenCalledWith("/proj-1");
        expect(mockCreateProject).not.toHaveBeenCalled();
      });

      test("returns the action result", async () => {
        mockSignIn.mockResolvedValue({ success: true });
        mockGetProjects.mockResolvedValue([
          { id: "proj-1", name: "P1", createdAt: new Date(), updatedAt: new Date() },
        ]);

        const { result } = renderHook(() => useAuth());

        let returnValue: unknown;
        await act(async () => {
          returnValue = await result.current.signIn("user@example.com", "password123");
        });

        expect(returnValue).toEqual({ success: true });
      });
    });

    describe("happy path — no anon work, no existing projects", () => {
      test("creates a new project and redirects", async () => {
        mockSignIn.mockResolvedValue({ success: true });
        mockGetProjects.mockResolvedValue([]);
        mockCreateProject.mockResolvedValue({
          id: "new-proj",
          name: "New Design",
          userId: "user-1",
          messages: "[]",
          data: "{}",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password123");
        });

        expect(mockCreateProject).toHaveBeenCalledWith(
          expect.objectContaining({ messages: [], data: {} })
        );
        expect(mockPush).toHaveBeenCalledWith("/new-proj");
      });
    });

    describe("happy path — anon work exists with messages", () => {
      test("creates a project from anon work and redirects", async () => {
        const anonMessages = [{ role: "user", content: "hello" }];
        const anonFsData = { "/App.jsx": { type: "file", content: "export default () => <div/>" } };

        mockSignIn.mockResolvedValue({ success: true });
        mockGetAnonWorkData.mockReturnValue({ messages: anonMessages, fileSystemData: anonFsData });
        mockCreateProject.mockResolvedValue({
          id: "anon-proj",
          name: "Design from...",
          userId: "user-1",
          messages: JSON.stringify(anonMessages),
          data: JSON.stringify(anonFsData),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password123");
        });

        expect(mockCreateProject).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: anonMessages,
            data: anonFsData,
          })
        );
        expect(mockClearAnonWork).toHaveBeenCalled();
        expect(mockGetProjects).not.toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/anon-proj");
      });
    });

    describe("error state — invalid credentials", () => {
      test("returns failure result without redirecting", async () => {
        mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" });

        const { result } = renderHook(() => useAuth());

        let returnValue: unknown;
        await act(async () => {
          returnValue = await result.current.signIn("user@example.com", "wrongpassword");
        });

        expect(returnValue).toEqual({ success: false, error: "Invalid credentials" });
        expect(mockPush).not.toHaveBeenCalled();
        expect(mockGetProjects).not.toHaveBeenCalled();
      });
    });

    describe("error state — action throws", () => {
      test("propagates the error", async () => {
        mockSignIn.mockRejectedValue(new Error("Network error"));

        const { result } = renderHook(() => useAuth());

        await expect(
          act(async () => {
            await result.current.signIn("user@example.com", "password123");
          })
        ).rejects.toThrow("Network error");
      });
    });

    describe("loading state", () => {
      test("isLoading is true while signing in, false after", async () => {
        let resolveSignIn!: (value: { success: boolean }) => void;
        mockSignIn.mockReturnValue(new Promise((res) => { resolveSignIn = res; }));
        mockGetProjects.mockResolvedValue([
          { id: "p1", name: "P", createdAt: new Date(), updatedAt: new Date() },
        ]);

        const { result } = renderHook(() => useAuth());
        expect(result.current.isLoading).toBe(false);

        let signInPromise: Promise<unknown>;
        act(() => {
          signInPromise = result.current.signIn("user@example.com", "password123");
        });

        expect(result.current.isLoading).toBe(true);

        await act(async () => {
          resolveSignIn({ success: true });
          await signInPromise;
        });

        expect(result.current.isLoading).toBe(false);
      });

      test("isLoading resets to false even when sign-in fails", async () => {
        mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "wrongpassword");
        });

        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe("signUp", () => {
    describe("happy path — new user, no anon work, no existing projects", () => {
      test("creates a new project and redirects", async () => {
        mockSignUp.mockResolvedValue({ success: true });
        mockGetProjects.mockResolvedValue([]);
        mockCreateProject.mockResolvedValue({
          id: "new-proj",
          name: "New Design",
          userId: "user-1",
          messages: "[]",
          data: "{}",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signUp("newuser@example.com", "password123");
        });

        expect(mockCreateProject).toHaveBeenCalledWith(
          expect.objectContaining({ messages: [], data: {} })
        );
        expect(mockPush).toHaveBeenCalledWith("/new-proj");
      });

      test("returns the action result", async () => {
        mockSignUp.mockResolvedValue({ success: true });
        mockGetProjects.mockResolvedValue([
          { id: "p1", name: "P", createdAt: new Date(), updatedAt: new Date() },
        ]);

        const { result } = renderHook(() => useAuth());

        let returnValue: unknown;
        await act(async () => {
          returnValue = await result.current.signUp("newuser@example.com", "password123");
        });

        expect(returnValue).toEqual({ success: true });
      });
    });

    describe("happy path — anon work exists with messages", () => {
      test("migrates anon work to a new project on sign-up", async () => {
        const anonMessages = [{ role: "user", content: "make a button" }];
        const anonFsData = { "/App.jsx": { type: "file", content: "<button/>" } };

        mockSignUp.mockResolvedValue({ success: true });
        mockGetAnonWorkData.mockReturnValue({ messages: anonMessages, fileSystemData: anonFsData });
        mockCreateProject.mockResolvedValue({
          id: "migrated-proj",
          name: "Design from...",
          userId: "user-1",
          messages: JSON.stringify(anonMessages),
          data: JSON.stringify(anonFsData),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signUp("newuser@example.com", "password123");
        });

        expect(mockCreateProject).toHaveBeenCalledWith(
          expect.objectContaining({ messages: anonMessages, data: anonFsData })
        );
        expect(mockClearAnonWork).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/migrated-proj");
      });
    });

    describe("error state — email already registered", () => {
      test("returns failure without redirecting", async () => {
        mockSignUp.mockResolvedValue({ success: false, error: "Email already registered" });

        const { result } = renderHook(() => useAuth());

        let returnValue: unknown;
        await act(async () => {
          returnValue = await result.current.signUp("existing@example.com", "password123");
        });

        expect(returnValue).toEqual({ success: false, error: "Email already registered" });
        expect(mockPush).not.toHaveBeenCalled();
      });
    });

    describe("loading state", () => {
      test("isLoading is true while signing up, false after", async () => {
        let resolveSignUp!: (value: { success: boolean }) => void;
        mockSignUp.mockReturnValue(new Promise((res) => { resolveSignUp = res; }));
        mockGetProjects.mockResolvedValue([
          { id: "p1", name: "P", createdAt: new Date(), updatedAt: new Date() },
        ]);

        const { result } = renderHook(() => useAuth());

        let signUpPromise: Promise<unknown>;
        act(() => {
          signUpPromise = result.current.signUp("newuser@example.com", "password123");
        });

        expect(result.current.isLoading).toBe(true);

        await act(async () => {
          resolveSignUp({ success: true });
          await signUpPromise;
        });

        expect(result.current.isLoading).toBe(false);
      });

      test("isLoading resets to false even when sign-up fails", async () => {
        mockSignUp.mockResolvedValue({ success: false, error: "Email already registered" });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signUp("existing@example.com", "password123");
        });

        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe("edge cases", () => {
    test("anon work with empty messages array skips anon migration path", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      // getAnonWorkData returns data but messages is empty
      mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
      mockGetProjects.mockResolvedValue([
        { id: "proj-1", name: "P", createdAt: new Date(), updatedAt: new Date() },
      ]);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      // Should fall through to existing projects, not create from anon data
      expect(mockGetProjects).toHaveBeenCalled();
      expect(mockClearAnonWork).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/proj-1");
    });

    test("getProjects throwing propagates the error", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockGetProjects.mockRejectedValue(new Error("Unauthorized"));

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.signIn("user@example.com", "password123");
        })
      ).rejects.toThrow("Unauthorized");

      expect(result.current.isLoading).toBe(false);
    });

    test("createProject throwing propagates the error", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockRejectedValue(new Error("DB error"));

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.signIn("user@example.com", "password123");
        })
      ).rejects.toThrow("DB error");

      expect(result.current.isLoading).toBe(false);
    });
  });
});
