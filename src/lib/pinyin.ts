import { pinyin } from "pinyin-pro";

const ASCII_LETTER = /^[A-Za-z]$/;
const HAN_CHARACTER = /^\p{Script=Han}$/u;

export function normalizePinyinQuery(value: string) {
  return value.trim().toLocaleLowerCase();
}

function getPinyinSyllables(value: string) {
  return pinyin(value, { toneType: "none", type: "array" }).map((syllable) =>
    syllable.toLocaleLowerCase(),
  );
}

/** Matches original text, full pinyin, and pinyin initials. */
export function matchesPinyinQuery(value: string, query: string) {
  const normalizedQuery = normalizePinyinQuery(query);
  if (!normalizedQuery) return true;

  const syllables = getPinyinSyllables(value);
  return [
    normalizePinyinQuery(value),
    syllables.join(""),
    syllables.map((syllable) => syllable[0] ?? "").join(""),
  ].some((candidate) => candidate.includes(normalizedQuery));
}

/**
 * Keeps Latin-named spaces together first, then Chinese-named spaces, then
 * every other script. Chinese names are compared by their tone-free pinyin.
 */
export function compareSpaceNames(left: string, right: string) {
  const leftValue = getSpaceNameSortValue(left);
  const rightValue = getSpaceNameSortValue(right);
  if (leftValue.group !== rightValue.group) {
    return leftValue.group - rightValue.group;
  }

  return (
    leftValue.key.localeCompare(rightValue.key, "en", { sensitivity: "base" }) ||
    leftValue.original.localeCompare(rightValue.original, "en", {
      sensitivity: "base",
    })
  );
}

function getSpaceNameSortValue(value: string) {
  const original = value.trim();
  const initial = Array.from(original)[0] ?? "";
  if (ASCII_LETTER.test(initial)) {
    return { group: 0, key: original.toLocaleLowerCase(), original };
  }
  if (HAN_CHARACTER.test(initial)) {
    return { group: 1, key: getPinyinSyllables(original).join(""), original };
  }
  return { group: 2, key: original.toLocaleLowerCase(), original };
}
