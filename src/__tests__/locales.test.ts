import { describe, expect, it } from "vitest";
import { APP_LANGUAGES } from "@jordiorriols/ui";
import i18n from "@/i18n";
import en from "@/locales/en.json";

type Messages = { [key: string]: string | Messages };

const flatten = (messages: Messages, prefix = ""): [string, string][] =>
  Object.entries(messages).flatMap(([key, value]) =>
    typeof value === "string" ? [[prefix + key, value]] : flatten(value, `${prefix}${key}.`)
  );
const placeholders = (value: string) => (value.match(/{{\s*\w+\s*}}/g) ?? []).sort();
const english = flatten(en);

describe("locales", () => {
  it.each(APP_LANGUAGES.map((language) => language.code))(
    "%s translates every English message with the same placeholders",
    (code) => {
      const bundle = i18n.getResourceBundle(code, "translation") as Messages | undefined;
      expect(bundle, `missing ${code} resources`).toBeDefined();
      const messages = new Map(flatten(bundle!));
      for (const [key, value] of english) {
        expect(messages.get(key), `${code}: ${key}`).toBeTruthy();
        expect(placeholders(messages.get(key)!), `${code}: ${key}`).toEqual(placeholders(value));
      }
    }
  );
});
