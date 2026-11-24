"use client";

// Keyword rules tab (FR-43, NFR-10, UX-DR16, UX-DR18, Story 13.2): the add form and the rules in
// server order in the shared DataTable (one tab stop, ↑/↓ between rows). Each row has Edit (a
// dialog), Delete… (the confirm, Cancel focused) and Move up / Move down, the keyboard path for
// reordering. Every change goes to the 13.1 API and the table changes only after the refetch; a
// field error shows under its input, any other error as a toast.

import { Dialog } from "radix-ui";
import { type FormEvent, type ReactNode, type Ref, useCallback, useId, useMemo, useRef, useState } from "react";

import { Button } from "@/components/common/button";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { type CellContext, DataTable, type DataTableColumn } from "@/components/common/data-table";
import { Input, InputError } from "@/components/common/input";
import { showToast } from "@/components/common/toast";
import { ApiError, internalError } from "@/lib/api/errors";
import {
  ADD_RULE,
  CATEGORY_LABEL,
  DELETE_RULE_CONFIRM,
  DELETE_RULE_ITEM,
  DELETE_RULE_TITLE,
  deleteRuleQuestion,
  EDIT_RULE_ITEM,
  EDIT_RULE_TITLE,
  FIRST_RULE_REASON,
  KEYWORD_LABEL,
  KEYWORD_RULES_NOTE,
  KEYWORD_RULES_TAB,
  LAST_RULE_REASON,
  MOVE_DOWN,
  MOVE_UP,
  NO_KEYWORD_RULES,
  POSITION_LABEL,
  ruleButtonLabel,
  SAVE_RULE,
  SAVING_CATEGORIES,
} from "@/lib/copy";
import { formatNumber } from "@/lib/format";

import { categoriesApi, fieldErrors, type KeywordRule, movedIds, useCategoriesWrite } from "./api";

type RuleFields = { keyword: string; category: string };
type RuleErrors = Partial<Record<keyof RuleFields, string>>;

const FADE =
  "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-150";

/** The field errors of a rejected rule write; null when the error is not about the fields. */
export function ruleErrors(error: ApiError): RuleErrors | null {
  if (error.code !== "validation_failed") return null;
  const byField = fieldErrors(error.details);
  const found: RuleErrors = {};
  if (byField.keyword) found.keyword = byField.keyword;
  if (byField.category) found.category = byField.category;
  return found.keyword || found.category ? found : null;
}

function asApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : internalError();
}

export function RuleFieldsInputs({
  idPrefix,
  values,
  errors,
  onChange,
  keywordRef,
}: {
  idPrefix: string;
  values: RuleFields;
  errors: RuleErrors;
  onChange: (field: keyof RuleFields, value: string) => void;
  keywordRef?: Ref<HTMLInputElement>;
}) {
  const field = (name: keyof RuleFields, label: string, ref?: Ref<HTMLInputElement>): ReactNode => {
    const id = `${idPrefix}-${name}`;
    const errorId = errors[name] ? `${id}-error` : undefined;
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor={id} className="type-body-strong text-ink">
          {label}
        </label>
        <Input
          ref={ref}
          id={id}
          name={name}
          autoComplete="off"
          spellCheck={false}
          value={values[name]}
          errorId={errorId}
          onChange={(event) => onChange(name, event.currentTarget.value)}
        />
        {errors[name] && errorId && <InputError id={errorId}>{errors[name]}</InputError>}
      </div>
    );
  };
  return (
    <>
      {field("keyword", KEYWORD_LABEL, keywordRef)}
      {field("category", CATEGORY_LABEL)}
    </>
  );
}

const ADD_RULE_ID_PREFIX = "add-rule";
export const ADD_RULE_KEYWORD_ID = `${ADD_RULE_ID_PREFIX}-keyword`;

/** The add form: Keyword, Category and Add rule. Cleared after the server confirms the rule. */
export function AddRuleForm({
  pendingReason,
  onAdd,
}: {
  pendingReason?: string;
  onAdd: (fields: RuleFields) => Promise<RuleErrors | null>;
}) {
  // One add form per page: a fixed id lets a finished delete put focus on its Keyword input.
  const idPrefix = ADD_RULE_ID_PREFIX;
  const keywordRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<RuleFields>({ keyword: "", category: "" });
  const [errors, setErrors] = useState<RuleErrors>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingReason !== undefined) return;
    const result = await onAdd(values);
    if (result === null) {
      setValues({ keyword: "", category: "" });
      setErrors({});
      keywordRef.current?.focus();
    } else {
      setErrors(result);
    }
  }

  return (
    <form
      aria-label={ADD_RULE}
      onSubmit={(event) => void submit(event)}
      className="grid items-start gap-3 sm:grid-cols-[minmax(0,240px)_minmax(0,240px)_auto]"
    >
      <RuleFieldsInputs
        idPrefix={idPrefix}
        values={values}
        errors={errors}
        keywordRef={keywordRef}
        onChange={(field, value) => setValues((current) => ({ ...current, [field]: value }))}
      />
      <div className="flex flex-col gap-1">
        {/* Keeps the button on the inputs' line under their labels. */}
        <span aria-hidden="true" className="hidden type-body-strong sm:block">
          &nbsp;
        </span>
        <Button type="submit" variant="primary" disabledReason={pendingReason}>
          {ADD_RULE}
        </Button>
      </div>
    </form>
  );
}

/** The Edit dialog: both fields, Cancel and Save; closes after the server confirms the change. */
function EditRuleDialog({
  rule,
  open,
  onOpenChange,
  pendingReason,
  onSave,
}: {
  rule: KeywordRule;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingReason?: string;
  onSave: (rule: KeywordRule, fields: RuleFields) => Promise<RuleErrors | null>;
}) {
  const idPrefix = useId();
  const [values, setValues] = useState<RuleFields>({ keyword: rule.keyword, category: rule.category });
  const [errors, setErrors] = useState<RuleErrors>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingReason !== undefined) return;
    const result = await onSave(rule, values);
    if (result === null) onOpenChange(false);
    else setErrors(result);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={`fixed inset-0 z-50 bg-ink/45 ${FADE}`} />
        <Dialog.Content
          aria-modal="true"
          aria-describedby={undefined}
          className={`fixed top-1/2 left-1/2 z-50 w-[calc(100vw-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-surface p-5 text-ink shadow-overlay ${FADE}`}
        >
          <Dialog.Title className="type-rank">{EDIT_RULE_TITLE}</Dialog.Title>
          <form onSubmit={(event) => void submit(event)} className="mt-4 flex flex-col gap-3">
            <RuleFieldsInputs
              idPrefix={idPrefix}
              values={values}
              errors={errors}
              onChange={(field, value) => setValues((current) => ({ ...current, [field]: value }))}
            />
            <div className="mt-2 flex flex-wrap justify-end gap-2">
              <Dialog.Close asChild>
                <Button variant="tertiary">Cancel</Button>
              </Dialog.Close>
              <Button type="submit" variant="primary" disabledReason={pendingReason}>
                {SAVE_RULE}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** The Delete… confirm (UX-DR16): destructive, Cancel first and focused (ConfirmDialog). */
export function deleteRuleConfirm(rule: Pick<KeywordRule, "keyword" | "category">) {
  return {
    title: DELETE_RULE_TITLE,
    description: deleteRuleQuestion(rule.keyword, rule.category),
    confirmLabel: DELETE_RULE_CONFIRM,
  };
}

export type RuleRowActions = {
  pendingReason?: string;
  onEdit: (rule: KeywordRule) => void;
  onDelete: (rule: KeywordRule) => void;
  onMove: (rule: KeywordRule, delta: -1 | 1) => void;
};

export function deleteButtonId(ruleId: string): string {
  return `rule-${ruleId}-delete`;
}

export function moveButtonId(ruleId: string, delta: -1 | 1): string {
  return `rule-${ruleId}-${delta === -1 ? "up" : "down"}`;
}

/** The rules table's columns: Position (1-based, right-aligned), Keyword, Category and the row's actions. */
export function ruleColumns(count: number, actions: RuleRowActions): readonly DataTableColumn<KeywordRule>[] {
  return [
    {
      key: "position",
      header: POSITION_LABEL,
      align: "end",
      className: "w-px",
      cell: (rule) => formatNumber(rule.position + 1),
    },
    { key: "keyword", header: KEYWORD_LABEL, cell: (rule) => <span className="type-body-strong">{rule.keyword}</span> },
    { key: "category", header: CATEGORY_LABEL, cell: (rule) => rule.category },
    {
      key: "actions",
      header: "Actions",
      className: "w-px",
      cell: (rule, { isActive }: CellContext) => {
        const tabIndex = isActive ? 0 : -1;
        const first = rule.position === 0;
        const last = rule.position === count - 1;
        return (
          <div className="flex flex-nowrap items-center gap-1">
            <Button
              variant="tertiary"
              size="sm"
              tabIndex={tabIndex}
              aria-label={ruleButtonLabel(EDIT_RULE_ITEM, rule.keyword)}
              disabledReason={actions.pendingReason}
              onClick={() => actions.onEdit(rule)}
            >
              {EDIT_RULE_ITEM}
            </Button>
            <Button
              variant="tertiary"
              size="sm"
              tabIndex={tabIndex}
              id={deleteButtonId(rule.id)}
              aria-label={ruleButtonLabel(DELETE_RULE_ITEM, rule.keyword)}
              disabledReason={actions.pendingReason}
              onClick={() => actions.onDelete(rule)}
            >
              {DELETE_RULE_ITEM}
            </Button>
            <Button
              id={moveButtonId(rule.id, -1)}
              variant="tertiary"
              size="sm"
              tabIndex={tabIndex}
              aria-label={ruleButtonLabel(MOVE_UP, rule.keyword)}
              disabledReason={first ? FIRST_RULE_REASON : actions.pendingReason}
              onClick={() => actions.onMove(rule, -1)}
            >
              {MOVE_UP}
            </Button>
            <Button
              id={moveButtonId(rule.id, 1)}
              variant="tertiary"
              size="sm"
              tabIndex={tabIndex}
              aria-label={ruleButtonLabel(MOVE_DOWN, rule.keyword)}
              disabledReason={last ? LAST_RULE_REASON : actions.pendingReason}
              onClick={() => actions.onMove(rule, 1)}
            >
              {MOVE_DOWN}
            </Button>
          </div>
        );
      },
    },
  ];
}

/** The tab's view: the note, the add form and the table (or the empty line). */
export function KeywordRulesView({
  rules,
  pendingReason,
  onAdd,
  actions,
  focusKey,
}: {
  rules: readonly KeywordRule[];
  pendingReason?: string;
  onAdd: (fields: RuleFields) => Promise<RuleErrors | null>;
  actions: RuleRowActions;
  focusKey?: string;
}) {
  const columns = useMemo(() => ruleColumns(rules.length, actions), [rules.length, actions]);
  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-[720px] type-body text-ink-secondary">{KEYWORD_RULES_NOTE}</p>
      <AddRuleForm pendingReason={pendingReason} onAdd={onAdd} />
      {rules.length === 0 ? (
        <p className="type-body text-ink-secondary">{NO_KEYWORD_RULES}</p>
      ) : (
        <DataTable
          label={KEYWORD_RULES_TAB}
          columns={columns}
          rows={rules}
          rowKey={(rule) => rule.id}
          focusKey={focusKey}
          className="max-w-[960px] bg-surface"
        />
      )}
    </div>
  );
}

/** The tab with its writes: every change waits for the server and the refetch before it shows. */
export function KeywordRulesTab({ rules }: { rules: readonly KeywordRule[] }) {
  const write = useCategoriesWrite();
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState<KeywordRule | null>(null);
  // A new key per opening, so the dialog starts from the rule's stored values every time.
  const [editSession, setEditSession] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState<KeywordRule | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [focusKey, setFocusKey] = useState<string | undefined>(undefined);
  const deleteConfirmed = useRef(false);
  const pendingReason = pending ? SAVING_CATEGORIES : undefined;

  /** Runs one write; resolves with the field errors, null on success, `{}` after a toast. */
  const run = useCallback(
    async (change: () => Promise<unknown>): Promise<RuleErrors | null> => {
      setPending(true);
      try {
        await write(change);
        return null;
      } catch (error) {
        const apiError = asApiError(error);
        const errors = ruleErrors(apiError);
        if (errors) return errors;
        showToast(apiError.message);
        return {};
      } finally {
        setPending(false);
      }
    },
    [write],
  );

  const actions = useMemo<RuleRowActions>(
    () => ({
      pendingReason,
      onEdit: (rule) => {
        setEditing(rule);
        setEditSession((session) => session + 1);
        setEditOpen(true);
      },
      onDelete: (rule) => {
        deleteConfirmed.current = false;
        setDeleting(rule);
        setDeleteOpen(true);
      },
      onMove: (rule, delta) => {
        const ids = movedIds(
          rules.map((r) => r.id),
          rules.findIndex((r) => r.id === rule.id),
          delta,
        );
        void run(() => categoriesApi.reorderRules(ids)).then((result) => {
          if (result !== null) return;
          // The moved rule keeps the focus: its button in the same direction, which may now be disabled.
          requestAnimationFrame(() => document.getElementById(moveButtonId(rule.id, delta))?.focus());
        });
      },
    }),
    [pendingReason, rules, run],
  );

  async function confirmDelete(rule: KeywordRule) {
    deleteConfirmed.current = true;
    const index = rules.findIndex((r) => r.id === rule.id);
    const neighbour = rules[index + 1] ?? rules[index - 1];
    setFocusKey(undefined);
    const result = await run(() => categoriesApi.deleteRule(rule.id));
    if (result === null && neighbour) {
      setFocusKey(neighbour.id);
      return;
    }
    // Failed: back to the row's Delete… if the rule is still there. Deleted the last rule: the add
    // form's Keyword. Either way after the refetch has rendered, so focus never stays on <body>.
    requestAnimationFrame(() => {
      const target = result === null ? null : document.getElementById(deleteButtonId(rule.id));
      (target ?? document.getElementById(ADD_RULE_KEYWORD_ID))?.focus();
    });
  }

  return (
    <>
      <KeywordRulesView
        rules={rules}
        pendingReason={pendingReason}
        onAdd={(fields) => run(() => categoriesApi.createRule(fields.keyword, fields.category))}
        actions={actions}
        focusKey={focusKey}
      />
      {editing && (
        <EditRuleDialog
          key={editSession}
          rule={editing}
          open={editOpen}
          onOpenChange={setEditOpen}
          pendingReason={pendingReason}
          onSave={(rule, fields) => run(() => categoriesApi.editRule(rule.id, fields.keyword, fields.category))}
        />
      )}
      {deleting && (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          {...deleteRuleConfirm(deleting)}
          onConfirm={() => void confirmDelete(deleting)}
          onCloseAutoFocus={(event) => {
            // A deleted rule's row is gone: the table focuses its neighbour after the refetch.
            if (deleteConfirmed.current) event.preventDefault();
          }}
        />
      )}
    </>
  );
}
