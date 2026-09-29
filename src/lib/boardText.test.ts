import { test } from "node:test";
import assert from "node:assert/strict";
import { splitBoardText } from "./boardText.ts";

test("a letter keeps its word before and its punctuation after", () => {
  assert.deepEqual(splitBoardText("Which is the first question with answer D?"), [
    { kind: "text", text: "Which is the first question with " },
    { kind: "letter", letter: "D", lead: "answer ", tail: "?" },
  ]);
});

test("each question number glues to its own neighbors", () => {
  assert.deepEqual(splitBoardText("Which is the closest question after #2 that has answer D?"), [
    { kind: "text", text: "Which is the closest question " },
    { kind: "question", number: "2", lead: "after ", tail: "" },
    { kind: "text", text: " that has " },
    { kind: "letter", letter: "D", lead: "answer ", tail: "?" },
  ]);
  assert.deepEqual(splitBoardText("What is the answer to question #7?"), [
    { kind: "text", text: "What is the answer to " },
    { kind: "question", number: "7", lead: "question ", tail: "?" },
  ]);
});

test("text with no tokens is one run", () => {
  assert.deepEqual(splitBoardText("Which is the least common answer?"), [
    { kind: "text", text: "Which is the least common answer?" },
  ]);
});
