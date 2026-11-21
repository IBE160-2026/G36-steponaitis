import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ApiError, INTERNAL_MESSAGE, parseErrorBody } from "@/lib/api/errors";
import { megabytesExact, megabytesOneDecimal, megabytesRoundedUp } from "@/lib/format";
import { planStepHref } from "@/lib/view-state/urls";
import { FileTile } from "@/modules/new-plan/file-tile";
import { ImportErrorPanel } from "@/modules/new-plan/import-error-panel";
import {
  type ChosenFiles,
  createdToast,
  emptyFiles,
  errorView,
  importErrorGroups,
  NAME_REQUIRED,
  oversizeMessage,
  progressText,
  tileStatesFrom,
  totalBytes,
  validateForm,
} from "@/modules/new-plan/selection";
import { isUploadCancelled, uploadPlan, type XhrLike } from "@/modules/new-plan/upload";

// Story 1.8: the New Plan screen (FR-1, FR-3, FR-4, UX-DR19, UX-DR20, NFR-10, AD-6, AD-11, AD-20).

const html = renderToStaticMarkup;

function files(sizes: [number, number, number]): ChosenFiles {
  return {
    locations: { name: "Locations.xlsx", size: sizes[0] },
    inventory: { name: "Inventory.xlsx", size: sizes[1] },
    transactions: { name: "transactions.xlsx", size: sizes[2] },
  };
}

function fileCheck(role: string, status: string, messages: string[] = [], moreCount = 0) {
  return {
    file_role: role,
    file_name: `${role}.csv`,
    status,
    errors: messages.map((message, index) => ({ row: index + 2, column: "Quantity", message })),
    more_count: moreCount,
  };
}

describe("megabyte formatting", () => {
  it("rounds up to one decimal without a trailing .0", () => {
    expect(megabytesRoundedUp(5_200_000)).toBe("5.2");
    expect(megabytesRoundedUp(4_000_001)).toBe("4.1");
    expect(megabytesRoundedUp(4_000_000)).toBe("4");
    expect(megabytesRoundedUp(1)).toBe("0.1");
  });

  it("rounds to the nearest tenth with one decimal always", () => {
    expect(megabytesOneDecimal(1_234_567)).toBe("1.2");
    expect(megabytesOneDecimal(2_850_000)).toBe("2.9");
    expect(megabytesOneDecimal(0)).toBe("0.0");
  });

  it("shows a limit with as many decimals as needed", () => {
    expect(megabytesExact(4_000_000)).toBe("4");
    expect(megabytesExact(1_500_000)).toBe("1.5");
    expect(megabytesExact(1_250_000)).toBe("1.25");
  });
});

describe("plan URLs", () => {
  it("builds /plans/<id>/<step> in one place", () => {
    expect(planStepHref("8d3c", "overview")).toBe("/plans/8d3c/overview");
    expect(planStepHref("a/b", "parts")).toBe("/plans/a%2Fb/parts");
  });
});

describe("fr1 new plan form", () => {
  it("fr1 asks for a name when it is blank", () => {
    const result = validateForm("   ", files([1, 1, 1]));
    expect(result.ok).toBe(false);
    expect(result.name).toBe(NAME_REQUIRED);
    expect(result.name).toBe("Give the plan a name.");
    expect(result.files).toEqual({});
  });

  it("fr1 asks for each missing file by role", () => {
    const chosen = { ...files([1, 1, 1]), transactions: null };
    const result = validateForm("Demo", chosen);
    expect(result.ok).toBe(false);
    expect(result.name).toBeNull();
    expect(result.files).toEqual({ transactions: "Choose the Transactions file." });
    expect(validateForm("Demo", emptyFiles()).files).toEqual({
      locations: "Choose the Locations file.",
      inventory: "Choose the Inventory file.",
      transactions: "Choose the Transactions file.",
    });
  });

  it("fr1 accepts a name and three files", () => {
    expect(validateForm("Demo", files([1, 1, 1])).ok).toBe(true);
  });

  it("fr1 blocks files over the upload limit with rounded sizes", () => {
    expect(totalBytes(files([2_000_000, 2_000_000, 1_200_000]))).toBe(5_200_000);
    expect(oversizeMessage(5_200_000, 4_000_000)).toBe(
      "These files are 5.2 MB together. One New Plan can upload at most 4 MB.",
    );
    expect(oversizeMessage(4_000_001, 4_000_000)).toBe(
      "These files are 4.1 MB together. One New Plan can upload at most 4 MB.",
    );
    expect(oversizeMessage(1_600_000, 1_500_000)).toContain("at most 1.5 MB.");
  });

  it("fr1 allows files at the limit and skips the check until the limit is known", () => {
    expect(oversizeMessage(4_000_000, 4_000_000)).toBeNull();
    expect(oversizeMessage(9_000_000, undefined)).toBeNull();
  });

  it("fr1 shows upload progress and the success toast text", () => {
    expect(progressText(1_200_000, 2_800_000)).toBe("Uploading 3 files · 1.2 of 2.8 MB");
    expect(createdToast("Demo", "2026-09-30")).toBe("Demo created. Data as of 2026-09-30.");
  });
});

describe("fr3_fr4 import errors", () => {
  it("fr3_fr4 lists failed files with their messages and the tile states", () => {
    const details = [
      fileCheck("locations", "passed"),
      fileCheck("inventory", "failed", ["inventory.csv · column Quantity: missing"]),
      fileCheck("transactions", "passed"),
    ];
    expect(importErrorGroups(details)).toEqual([
      {
        role: "inventory",
        fileName: "inventory.csv",
        lines: ["inventory.csv · column Quantity: missing"],
        more: null,
      },
    ]);
    expect(tileStatesFrom(details)).toEqual({ locations: "passed", inventory: "failed", transactions: "passed" });
  });

  it("fr3_fr4 keeps 20 lines and adds and N more with thousands separators", () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`);
    const [group] = importErrorGroups([fileCheck("transactions", "failed", lines, 37)]);
    expect(group.lines).toEqual(lines);
    expect(group.more).toBe("and 37 more in this file");
    expect(importErrorGroups([fileCheck("inventory", "failed", ["x"], 1234)])[0].more).toBe(
      "and 1,234 more in this file",
    );
  });

  it("fr3_fr4 marks the other files not checked", () => {
    const details = [
      fileCheck("locations", "failed", ["bad"]),
      fileCheck("inventory", "not_checked"),
      fileCheck("transactions", "not_checked"),
    ];
    expect(tileStatesFrom(details)).toEqual({
      locations: "failed",
      inventory: "not_checked",
      transactions: "not_checked",
    });
    const markup = html(<FileTile role="inventory" file={{ name: "i.csv", size: 10 }} state="not_checked" />);
    expect(markup).toContain("Not checked. Fix the other files first.");
  });

  it("fr3_fr4 ignores details that are not file checks", () => {
    expect(importErrorGroups([{ field: "name" }, fileCheck("nope", "failed", ["x"])])).toEqual([]);
  });
});

describe("nfr10 import error markup", () => {
  const groups = importErrorGroups([fileCheck("inventory", "failed", ["first", "second"], 3)]);

  it("nfr10 renders the panel as an alert with the stopped line first", () => {
    const markup = html(<ImportErrorPanel id="panel" content={{ kind: "import", groups }} />);
    expect(markup).toContain('id="panel"');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("bg-error-tint");
    expect(markup).toContain("border-error");
    expect(markup).toContain('data-icon="warning"');
    expect(markup).toMatch(/<p class="font-bold">Import stopped: nothing was saved\.<\/p>/);
    expect(markup.indexOf("first")).toBeLessThan(markup.indexOf("second"));
    expect(markup).toContain("and 3 more in this file");
  });

  it("nfr10 shows only the message for other errors", () => {
    const markup = html(<ImportErrorPanel id="p" content={{ kind: "message", message: "Too many rows." }} />);
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Too many rows.");
    expect(markup).not.toContain("Import stopped");
  });

  it("nfr10 describes the failing tile by the panel and marks it with text and an icon", () => {
    const markup = html(
      <FileTile role="inventory" file={{ name: "Inventory.csv", size: 2_000 }} state="failed" panelId="panel" />,
    );
    const describedBy = /<input[^>]*aria-describedby="([^"]+)"/.exec(markup)?.[1] ?? "";
    expect(describedBy.split(" ")).toContain("panel");
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain("border-error");
    expect(markup).toContain('data-icon="warning"');
    expect(markup).toContain("Failed. Choose a corrected file.");
    expect(markup).toContain('accept=".xlsx,.csv"');
    expect(markup).toContain("Inventory.csv");
    expect(markup).toContain("0.1 MB");
  });

  it("nfr10 shows a passed tile with a check and the word Passed", () => {
    const markup = html(<FileTile role="locations" file={{ name: "L.xlsx", size: 1 }} state="passed" panelId="p" />);
    expect(markup).toContain('data-icon="check"');
    expect(markup).toContain("Passed");
    const describedBy = /<input[^>]*aria-describedby="([^"]+)"/.exec(markup)?.[1] ?? "";
    expect(describedBy.split(" ")).not.toContain("p");
  });

  it("nfr10 links a missing-file error to the tile's input", () => {
    const markup = html(<FileTile role="transactions" file={null} missingError="Choose the Transactions file." />);
    const describedBy = /<input[^>]*aria-describedby="([^"]+)"/.exec(markup)?.[1];
    expect(markup).toContain(`id="${describedBy}"`);
    expect(markup).toContain("Choose the Transactions file.");
  });
});

describe("fr1 error envelope", () => {
  it("fr1 reads the AD-11 envelope", () => {
    const body = JSON.stringify({ error: { code: "limit_reached", message: "Too big.", details: [{ a: 1 }] } });
    const error = parseErrorBody(413, body);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 413, code: "limit_reached", message: "Too big.", details: [{ a: 1 }] });
  });

  it("fr1 turns anything else into internal", () => {
    for (const body of ["<html>Bad gateway</html>", "{}", '{"error":{"message":"x"}}', ""]) {
      expect(parseErrorBody(502, body)).toMatchObject({ code: "internal", message: INTERNAL_MESSAGE });
    }
    expect(INTERNAL_MESSAGE).toBe("Something went wrong. Try again.");
  });
});

class FakeXhr implements XhrLike {
  status = 0;
  responseText = "";
  method = "";
  url = "";
  body: FormData | null = null;
  aborted = false;
  upload: XhrLike["upload"] = { onprogress: null, onload: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  ontimeout: (() => void) | null = null;

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  send(body: FormData) {
    this.body = body;
  }
  abort() {
    this.aborted = true;
    this.onabort?.();
  }
  respond(status: number, text: string) {
    this.status = status;
    this.responseText = text;
    this.onload?.();
  }
}

function startUpload(signal?: AbortSignal) {
  const xhrs: FakeXhr[] = [];
  const events: string[] = [];
  const form = {
    name: "Demo",
    files: {
      locations: new File(["a"], "Locations.xlsx"),
      inventory: new File(["b"], "Inventory.xlsx"),
      transactions: new File(["c"], "transactions.xlsx"),
    },
  };
  const promise = uploadPlan(form, {
    signal,
    onProgress: (loaded, total) => events.push(progressText(loaded, total)),
    onServerStep: () => events.push("server"),
    createXhr: () => {
      const xhr = new FakeXhr();
      xhrs.push(xhr);
      return xhr;
    },
  });
  return { promise, xhr: xhrs[0], xhrs, events };
}

describe("fr1_upload with XMLHttpRequest", () => {
  it("fr1_upload posts one multipart request with the name and three files", async () => {
    const { promise, xhr, xhrs } = startUpload();
    expect(xhrs).toHaveLength(1);
    expect([xhr.method, xhr.url]).toEqual(["POST", "/api/plans"]);
    expect(xhr.body?.get("name")).toBe("Demo");
    expect((xhr.body?.get("locations") as File).name).toBe("Locations.xlsx");
    expect((xhr.body?.get("inventory") as File).name).toBe("Inventory.xlsx");
    expect((xhr.body?.get("transactions") as File).name).toBe("transactions.xlsx");
    const plan = { id: "p1", name: "Demo", data_as_of: "2026-09-30" };
    xhr.respond(201, JSON.stringify(plan));
    await expect(promise).resolves.toMatchObject(plan);
  });

  it("fr1_upload reports progress then switches to the server step", async () => {
    const { promise, xhr, events } = startUpload();
    xhr.upload.onprogress?.({ loaded: 1_200_000, total: 2_800_000, lengthComputable: true });
    xhr.upload.onprogress?.({ loaded: 5, total: 0, lengthComputable: false });
    xhr.upload.onload?.();
    expect(events).toEqual(["Uploading 3 files · 1.2 of 2.8 MB", "server"]);
    xhr.respond(201, "{}");
    await promise;
  });

  it("fr1_upload aborts on Cancel and rejects as cancelled", async () => {
    const abort = new AbortController();
    const { promise, xhr } = startUpload(abort.signal);
    abort.abort();
    expect(xhr.aborted).toBe(true);
    const error = await promise.catch((e: unknown) => e);
    expect(isUploadCancelled(error)).toBe(true);
  });

  it("fr1_upload rejects with the envelope error", async () => {
    const { promise, xhr } = startUpload();
    const details = [fileCheck("inventory", "failed", ["x"])];
    xhr.respond(422, JSON.stringify({ error: { code: "import_invalid", message: "Import stopped: nothing was saved.", details } }));
    await expect(promise).rejects.toMatchObject({ code: "import_invalid", details });
  });

  it("fr1_upload turns a non-envelope response or a network error into internal", async () => {
    const first = startUpload();
    first.xhr.respond(502, "<html>Bad gateway</html>");
    await expect(first.promise).rejects.toMatchObject({ code: "internal", message: INTERNAL_MESSAGE });

    const second = startUpload();
    second.xhr.onerror?.();
    await expect(second.promise).rejects.toMatchObject({ code: "internal", message: INTERNAL_MESSAGE });
    expect(isUploadCancelled(await second.promise.catch((e: unknown) => e))).toBe(false);
  });
});

describe("fr1 error view branches on the code", () => {
  it("fr1 shows a server name error under the name field", () => {
    const error = new ApiError(422, "validation_failed", "Give the plan a name.", [
      { field: "name", message: "Give the plan a name." },
    ]);
    expect(errorView(error)).toEqual({ kind: "name", message: "Give the plan a name." });
  });

  it("fr1 shows limit_reached and other codes as one message panel", () => {
    const rows = "transactions.xlsx has more than 25,000 rows. One file can hold at most 25,000.";
    expect(errorView(new ApiError(413, "limit_reached", rows))).toEqual({ kind: "message", message: rows });
    expect(errorView(new ApiError(422, "validation_failed", "Bad.", [{ field: "transactions" }]))).toEqual({
      kind: "message",
      message: "Bad.",
    });
    expect(errorView(parseErrorBody(502, "<html></html>"))).toEqual({ kind: "message", message: INTERNAL_MESSAGE });
  });

  it("fr3_fr4 turns import_invalid into tile states and error groups", () => {
    const details = [fileCheck("locations", "failed", ["bad"]), fileCheck("inventory", "not_checked")];
    expect(errorView(new ApiError(422, "import_invalid", "Import stopped: nothing was saved.", details))).toEqual({
      kind: "import",
      tiles: { locations: "failed", inventory: "not_checked" },
      groups: [{ role: "locations", fileName: "locations.csv", lines: ["bad"], more: null }],
    });
  });
});
